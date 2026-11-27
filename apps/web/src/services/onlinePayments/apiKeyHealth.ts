import type { SupabaseClient } from "@supabase/supabase-js";
import type { GatewayApiKeyStatus } from "@gestarahub/contracts";
import { AsaasApiError, getAccountStatus, type AsaasWebhookPayload } from "@/lib/asaas";
import { logWarn, reportError } from "@/lib/log";
import { realSubaccountKey } from "./gatewaySetup";

/**
 * Chave de API da subconta (27/11/2026, doc product/19 "Chave de API da
 * subconta"). O Asaas expira de vez a chave parada por 6 meses (subconta BaaS)
 * e o GestaraHub usa essa chave em tudo do espaco: Pix, link, saldo, saque,
 * estorno. Duas defesas:
 * 1. Manter viva: a rotina diaria usa a chave uma vez por semana (leitura leve
 *    da situacao da conta), e o aviso "vai expirar" usa na hora.
 * 2. Avisos ACCESS_TOKEN_*: expirada, desligada ou apagada trava o "Cobrar
 *    online" com aviso claro e registra um erro para o dono da plataforma
 *    (painel admin e resumo diario), que troca a chave pelo roteiro.
 * A situacao fica em `settings.onlinePayments.apiKeyStatus` (so o servidor grava).
 * Modulo so do servidor, sem "use server".
 */

export const KEEP_ALIVE_EVERY_MS = 7 * 24 * 60 * 60 * 1000;

/** Mensagem do espaco quando a chave nao vale: sem detalhe tecnico. */
export const API_KEY_INVALID_MESSAGE =
  "O recebimento online está indisponível no momento. Já estamos resolvendo; enquanto isso, registre o pagamento à mão.";

type KeyReason = NonNullable<GatewayApiKeyStatus["reason"]>;

export function apiKeyStatusOf(settings: unknown): GatewayApiKeyStatus | undefined {
  const online = (settings as { onlinePayments?: { apiKeyStatus?: GatewayApiKeyStatus } } | null)?.onlinePayments;
  return online?.apiKeyStatus;
}

export function isApiKeyInvalid(settings: unknown): boolean {
  return apiKeyStatusOf(settings)?.state === "invalid";
}

/** Grava a situacao (mescla com a atual) e devolve a de antes. */
async function saveApiKeyStatus(
  admin: SupabaseClient,
  organizationId: string,
  patch: Partial<GatewayApiKeyStatus>,
): Promise<{ before?: GatewayApiKeyStatus; after: GatewayApiKeyStatus }> {
  const { data: org } = await admin.from("organizations").select("settings").eq("id", organizationId).maybeSingle();
  const settings = (org?.settings as Record<string, unknown> | null) ?? {};
  const online = (settings.onlinePayments as Record<string, unknown> | undefined) ?? {};
  const before = online.apiKeyStatus as GatewayApiKeyStatus | undefined;
  const after: GatewayApiKeyStatus = {
    ...(before ?? { state: "valid" }),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (after.state === "valid") delete after.reason;
  await admin
    .from("organizations")
    .update({ settings: { ...settings, onlinePayments: { ...online, apiKeyStatus: after } } })
    .eq("id", organizationId)
    .throwOnError();
  return { before, after };
}

const REASON_TEXT: Record<KeyReason, string> = {
  expired: "expirou",
  disabled: "foi desligada",
  deleted: "foi apagada",
  unauthorized: "foi recusada pelo parceiro",
};

/** Chave deixou de valer: trava o "Cobrar online", Auditoria do espaco e alerta ao dono da plataforma. */
async function markInvalid(
  admin: SupabaseClient,
  organizationId: string,
  reason: KeyReason,
  source: "webhook.asaas" | "cron.daily",
): Promise<void> {
  const { before } = await saveApiKeyStatus(admin, organizationId, { state: "invalid", reason });
  if (before?.state === "invalid") return;
  const { recordSystemAudit } = await import("../server/systemAudit");
  await recordSystemAudit(admin, source, {
    organizationId,
    action: "updated",
    target: { type: "settings", id: organizationId, label: "Recebimentos online" },
    predicate: `registrou que a chave da conta de recebimento ${REASON_TEXT[reason]} no parceiro de pagamentos`,
  });
  // O dono e o gerente sabem por e-mail (o sino e Recebimentos online tambem avisam).
  try {
    const { notifyPlanManagers, planEmailAppUrl } = await import("../server/planEmails");
    await notifyPlanManagers(admin, organizationId, {
      title: "Recebimento online parado",
      text:
        "A chave da sua conta de recebimento deixou de valer no parceiro de pagamentos. O Pix e o link de pagamento estão parados e já estamos resolvendo. Se precisar antes, cadastre uma chave nova em Recebimentos online.",
      action: "Abrir Recebimentos online",
      actionUrl: `${planEmailAppUrl()}/online-payments`,
    });
  } catch (error) {
    logWarn("[apiKeyHealth] E-mail da chave inválida não enviado:", error);
  }
  // Aviso urgente para quem troca a chave: entra no painel admin (Saude) e no resumo diario.
  await reportError("asaas.chave-da-subconta", new Error(`Chave de API da subconta ${REASON_TEXT[reason]}.`), {
    source: source === "webhook.asaas" ? "webhook" : "cron",
    organizationId,
    context: { reason },
  });
}

/**
 * Usa a chave numa leitura leve (situacao da conta): renova o prazo de falta de
 * uso. Recusada (401/403): a chave nao vale mais. Outra falha (rede, Asaas fora):
 * nao muda nada, a proxima rodada tenta de novo.
 */
export async function keepApiKeyAlive(
  admin: SupabaseClient,
  organizationId: string,
  apiKey: string,
  source: "webhook.asaas" | "cron.daily",
  /** Motivo gravado se a chave for recusada (aviso do Asaas: expirou, desligada, apagada). */
  reason: KeyReason = "unauthorized",
): Promise<"alive" | "invalid" | "failed"> {
  try {
    await getAccountStatus(apiKey);
  } catch (error) {
    if (error instanceof AsaasApiError && (error.status === 401 || error.status === 403)) {
      await markInvalid(admin, organizationId, reason, source);
      return "invalid";
    }
    logWarn("[apiKeyHealth] Chave da subconta não conferida agora:", error);
    return "failed";
  }
  await saveApiKeyStatus(admin, organizationId, { state: "valid", lastKeepAliveAt: new Date().toISOString() });
  return "alive";
}

/**
 * Rotina diaria do espaco: usa a chave se a ultima vez faz uma semana ou mais.
 * Sem subconta real ou chave ja invalida (espera a troca): nada.
 */
export async function keepSpaceApiKeyAlive(
  admin: SupabaseClient,
  organizationId: string,
  now = Date.now(),
): Promise<"alive" | "invalid" | "failed" | "skipped"> {
  const { data: org } = await admin
    .from("organizations")
    .select("gateway_api_key, settings")
    .eq("id", organizationId)
    .maybeSingle();
  const key = realSubaccountKey(org?.gateway_api_key);
  if (!key) return "skipped";
  const status = apiKeyStatusOf(org?.settings);
  if (status?.state === "invalid") return "skipped";
  const last = status?.lastKeepAliveAt ? Date.parse(status.lastKeepAliveAt) : 0;
  if (now - last < KEEP_ALIVE_EVERY_MS) return "skipped";
  return keepApiKeyAlive(admin, organizationId, key, "cron.daily");
}

/** Aviso ACCESS_TOKEN_* da subconta. Devolve o espaco e o que foi feito, ou null (conta desconhecida). */
export async function recordApiKeyEvent(
  admin: SupabaseClient,
  accountId: string,
  event: string,
  accessToken: AsaasWebhookPayload["accessToken"],
): Promise<{ organizationId: string; outcome: string } | null> {
  const { data: org } = await admin
    .from("organizations")
    .select("id, gateway_api_key")
    .eq("gateway_account_id", accountId)
    .maybeSingle();
  if (!org) return null;
  const organizationId = String(org.id);

  switch (event) {
    case "ACCESS_TOKEN_EXPIRING_SOON": {
      // Usar agora renova o prazo de falta de uso.
      await saveApiKeyStatus(admin, organizationId, { expiringNoticeAt: new Date().toISOString() });
      const key = realSubaccountKey(org.gateway_api_key);
      const result = key ? await keepApiKeyAlive(admin, organizationId, key, "webhook.asaas") : "failed";
      return { organizationId, outcome: `chave da subconta: aviso de expiração, uso na hora ${result === "alive" ? "feito" : "falhou"}` };
    }
    case "ACCESS_TOKEN_EXPIRED":
    case "ACCESS_TOKEN_DISABLED":
    case "ACCESS_TOKEN_DELETED": {
      // O aviso nao diz qual das chaves da conta foi (ate 10; o valor nunca vem):
      // pode ser uma antiga, ou chegar atrasado depois de o espaco cadastrar outra.
      // So trava se a chave em uso for recusada agora.
      const reason: KeyReason =
        event === "ACCESS_TOKEN_EXPIRED" ? "expired" : event === "ACCESS_TOKEN_DISABLED" ? "disabled" : "deleted";
      const key = realSubaccountKey(org.gateway_api_key);
      if (!key) {
        await markInvalid(admin, organizationId, reason, "webhook.asaas");
        return { organizationId, outcome: `chave da subconta: ${reason}` };
      }
      const result = await keepApiKeyAlive(admin, organizationId, key, "webhook.asaas", reason);
      const extra = event === "ACCESS_TOKEN_DISABLED" ? ` (${accessToken?.disableReason ?? "sem motivo"})` : "";
      return {
        organizationId,
        outcome:
          result === "alive"
            ? `chave da subconta: ${reason}${extra}, mas a chave em uso vale (outra chave)`
            : result === "invalid"
              ? `chave da subconta: ${reason}${extra}, chave em uso recusada`
              : `chave da subconta: ${reason}${extra}, não conferida agora`,
      };
    }
    case "ACCESS_TOKEN_ENABLED": {
      // Religada no Asaas: confere com um uso antes de liberar o "Cobrar online".
      const key = realSubaccountKey(org.gateway_api_key);
      const result = key ? await keepApiKeyAlive(admin, organizationId, key, "webhook.asaas") : "failed";
      return { organizationId, outcome: `chave da subconta religada (${result === "alive" ? "conferida" : "não conferida"})` };
    }
    default:
      // ACCESS_TOKEN_CREATED: chave nova criada no Asaas; o valor nunca vem no aviso.
      return { organizationId, outcome: `chave da subconta: ${event}` };
  }
}

/** Chave nova gravada (cadastrada pelo espaco ou trocada pelo GestaraHub): volta a valer. */
export async function markApiKeyReplaced(admin: SupabaseClient, organizationId: string): Promise<void> {
  const now = new Date().toISOString();
  await saveApiKeyStatus(admin, organizationId, { state: "valid", lastKeepAliveAt: now });
}
