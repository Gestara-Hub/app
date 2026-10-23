import type { GatewayAccountFees, LinkPaymentMethodName } from "@gestarahub/contracts";
import {
  areGatewayFeesStale,
  effectiveGatewayFees,
  isGatewayFeeDivergent,
  parseAsaasAccountFees,
} from "@gestarahub/core/payment-fees";
import { createWebhook, getAccountFees, getAccountInfo, listWebhooks, updateWebhook } from "@/lib/asaas";
import type { AsaasWebhookConfig } from "@/lib/asaas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError, logWarn } from "@/lib/log";

/**
 * Subconta do espaco no Asaas: tarifas e webhook (doc 19, secao 4, decisao de
 * 21/10/2026). So roda no servidor, chamado por server actions e pela rota do
 * webhook; nao e "use server" de proposito, para nao virar acao chamavel pelo
 * navegador com um organizationId qualquer.
 *
 * Tarifas: buscadas na aprovacao da subconta, de novo quando passam de 24 horas
 * (no uso) e quando um pagamento real diverge da tabela. A conta principal nunca
 * e consultada aqui.
 */

/**
 * Subconta no Asaas: tarifas, webhook do GestaraHub e atualizacao do status.
 */

/** Nome do webhook do GestaraHub em cada subconta (para achar e atualizar, nao duplicar). */
export const GESTARAHUB_WEBHOOK_NAME = "GestaraHub";

/** Eventos de cobranca que a rota app/api/webhooks/asaas trata. */
const WEBHOOK_EVENTS = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_OVERDUE", "PAYMENT_DELETED"];

/** Chave de subconta de verdade (as do modo de demonstracao comecam com "mock_"). */
export function realSubaccountKey(key: unknown): string | null {
  return typeof key === "string" && key.length > 0 && !key.startsWith("mock_") ? key : null;
}

/** Busca as tarifas da subconta no Asaas e grava em organizations.gateway_fees. */
export async function syncGatewayFees(organizationId: string): Promise<GatewayAccountFees | null> {
  const admin = createSupabaseAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("gateway_api_key")
    .eq("id", organizationId)
    .maybeSingle();
  const key = realSubaccountKey(org?.gateway_api_key);
  if (!key || !process.env.ASAAS_API_KEY) return null;

  try {
    const syncedAt = new Date().toISOString();
    const fees = parseAsaasAccountFees(await getAccountFees(key), syncedAt);
    const { error } = await admin
      .from("organizations")
      .update({ gateway_fees: fees, gateway_fees_synced_at: syncedAt })
      .eq("id", organizationId);
    if (error) throw error;
    return fees;
  } catch (err) {
    logError("[gatewayAccount] Não foi possível buscar as tarifas da subconta:", err);
    return null;
  }
}

/** E-mail da conta principal (chave ASAAS_API_KEY), guardado depois da primeira leitura. */
let cachedMasterEmail: string | undefined;

async function masterAccountEmail(): Promise<string | undefined> {
  if (cachedMasterEmail) return cachedMasterEmail;
  try {
    const info = await getAccountInfo();
    cachedMasterEmail = typeof info.email === "string" && info.email ? info.email : undefined;
  } catch (err) {
    logError("[gatewayAccount] Não foi possível ler o e-mail da conta principal:", err);
  }
  return cachedMasterEmail;
}

/**
 * Cadastra (ou atualiza) o webhook do GestaraHub na subconta, com a URL de
 * ASAAS_WEBHOOK_URL e o token de ASAAS_WEBHOOK_SECRET. Sem as duas variaveis,
 * nao faz nada e avisa no log: a subconta segue funcionando, so sem baixa
 * automatica (resta o "Simular liquidacao" no sandbox).
 */
export async function ensureSubaccountWebhook(
  organizationId: string,
): Promise<{ configured: boolean; reason?: string }> {
  const url = process.env.ASAAS_WEBHOOK_URL?.trim();
  const authToken = process.env.ASAAS_WEBHOOK_SECRET?.trim();
  if (!url || !authToken) {
    const reason = "ASAAS_WEBHOOK_URL ou ASAAS_WEBHOOK_SECRET não configuradas.";
    logWarn(`[gatewayAccount] Webhook da subconta não cadastrado: ${reason}`);
    return { configured: false, reason };
  }

  const admin = createSupabaseAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("gateway_api_key")
    .eq("id", organizationId)
    .maybeSingle();
  const key = realSubaccountKey(org?.gateway_api_key);
  if (!key) return { configured: false, reason: "Organização sem subconta no Asaas." };

  // O Asaas exige e-mail (avisa nele se o webhook falhar). Sem ASAAS_WEBHOOK_EMAIL,
  // usa o da conta principal: o aviso vai para o GestaraHub, nunca para o espaco.
  const email = process.env.ASAAS_WEBHOOK_EMAIL?.trim() || (await masterAccountEmail());
  if (!email) {
    const reason = "Sem e-mail para o webhook: defina ASAAS_WEBHOOK_EMAIL.";
    logWarn(`[gatewayAccount] Webhook da subconta não cadastrado: ${reason}`);
    return { configured: false, reason };
  }

  const config: AsaasWebhookConfig = {
    name: GESTARAHUB_WEBHOOK_NAME,
    url,
    email,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken,
    sendType: "SEQUENTIALLY",
    events: WEBHOOK_EVENTS,
  };

  try {
    const existing = (await listWebhooks(key)).find((w) => w.name === GESTARAHUB_WEBHOOK_NAME);
    if (existing) await updateWebhook(existing.id, config, key);
    else await createWebhook(config, key);
    await admin.from("organizations").update({ gateway_webhook_url: url }).eq("id", organizationId);
    return { configured: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logError("[gatewayAccount] Não foi possível cadastrar o webhook da subconta:", err);
    return { configured: false, reason };
  }
}

/**
 * Atualizacao por idade e por troca de URL, chamada quando o app le a
 * organizacao (em `after`, sem atrasar a resposta): tarifas com mais de 24
 * horas sao buscadas de novo; URL do webhook diferente da cadastrada e
 * recadastrada.
 */
export async function refreshGatewayIfNeeded(row: {
  id: string;
  gateway_api_key?: unknown;
  gateway_fees?: unknown;
  gateway_webhook_url?: unknown;
}): Promise<void> {
  if (!realSubaccountKey(row.gateway_api_key)) return;
  // Vencidos e cancelamentos pendentes ficam com o cron de hora em hora
  // (/api/cron/online-payments): aqui rodavam a cada leitura da organizacao.
  const fees = (row.gateway_fees ?? undefined) as GatewayAccountFees | undefined;
  if (areGatewayFeesStale(fees, new Date())) await syncGatewayFees(row.id);
  const url = process.env.ASAAS_WEBHOOK_URL?.trim();
  if (url && url !== row.gateway_webhook_url) await ensureSubaccountWebhook(row.id);
}

/**
 * Depois de um pagamento real: se a tarifa cobrada pelo Asaas nao bate com a
 * tabela gravada para aquele meio, a tarifa da subconta mudou; busca de novo.
 */
export async function recheckFeesAfterPayment(input: {
  organizationId: string;
  paidMethod?: LinkPaymentMethodName;
  chargedCents: number;
  realFeeCents?: number;
}): Promise<void> {
  if (!input.paidMethod || input.realFeeCents === undefined) return;
  const admin = createSupabaseAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("gateway_fees")
    .eq("id", input.organizationId)
    .maybeSingle();
  const fees = (org?.gateway_fees ?? undefined) as GatewayAccountFees | undefined;
  const table = effectiveGatewayFees(fees, new Date().toISOString().slice(0, 10));
  if (isGatewayFeeDivergent(table, input.paidMethod, input.chargedCents, input.realFeeCents)) {
    console.info("[gatewayAccount] Tarifa real diferente da tabela; buscando as tarifas da subconta de novo.");
    await syncGatewayFees(input.organizationId);
  }
}

// --- Cancelamento no Asaas ----------------------------------------------------
