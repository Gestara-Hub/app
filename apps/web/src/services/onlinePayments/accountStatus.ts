import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AsaasAccountStatus,
  AsaasApprovalStatus,
  AsaasDocumentStatus,
  SubaccountDocumentView,
  SubaccountOnboardingView,
} from "@gestarahub/contracts";
import { getAccountDocuments, getAccountStatus } from "@/lib/asaas";
import { afterResponse } from "@/lib/after-response";
import { logWarn } from "@/lib/log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureSubaccountPixKey, realSubaccountKey } from "./gatewaySetup";

/**
 * Analise da conta de recebimento no Asaas (25/11/2026; doc product/19). A
 * subconta nasce "Pendente" no Asaas: o titular cria a senha e envia os
 * documentos, e so com a aprovacao geral a conta esta pronta de verdade (saque,
 * Pix). Antes o GestaraHub mostrava "Conta ativa" logo depois de criar.
 * A situacao fica em `settings.onlinePayments.asaasStatus`; chega pelos avisos
 * ACCOUNT_STATUS_* e pela consulta do cartao "Deixe sua conta pronta".
 * Modulo so do servidor, sem "use server".
 */

const APPROVAL: readonly AsaasApprovalStatus[] = ["PENDING", "AWAITING_APPROVAL", "APPROVED", "REJECTED"];
const DOCUMENT: readonly AsaasDocumentStatus[] = ["NOT_SENT", "PENDING", "APPROVED", "REJECTED", "IGNORED"];

const approval = (value: unknown): AsaasApprovalStatus | undefined =>
  APPROVAL.includes(value as AsaasApprovalStatus) ? (value as AsaasApprovalStatus) : undefined;

export function toAccountStatus(raw: {
  general?: string;
  documentation?: string;
  commercialInfo?: string;
  bankAccountInfo?: string;
}): AsaasAccountStatus {
  return {
    general: approval(raw.general) ?? "PENDING",
    ...(approval(raw.documentation) ? { documentation: approval(raw.documentation) } : {}),
    ...(approval(raw.commercialInfo) ? { commercialInfo: approval(raw.commercialInfo) } : {}),
    ...(approval(raw.bankAccountInfo) ? { bankAccountInfo: approval(raw.bankAccountInfo) } : {}),
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Grava a situacao no espaco. Aprovada agora (antes nao): cria a chave Pix (o
 * Asaas pode recusar para conta pendente), registra na Auditoria e avisa o dono
 * e o gerente por e-mail.
 */
export async function saveAccountStatus(
  admin: SupabaseClient,
  organizationId: string,
  status: AsaasAccountStatus,
): Promise<void> {
  const { data: org } = await admin.from("organizations").select("settings").eq("id", organizationId).maybeSingle();
  const settings = (org?.settings as Record<string, unknown> | null) ?? {};
  const online = (settings.onlinePayments as Record<string, unknown> | undefined) ?? {};
  const before = (online.asaasStatus as AsaasAccountStatus | undefined)?.general;
  await admin
    .from("organizations")
    .update({ settings: { ...settings, onlinePayments: { ...online, asaasStatus: status } } })
    .eq("id", organizationId)
    .throwOnError();

  if (status.general !== "APPROVED" || before === "APPROVED") return;
  // Carregados so na aprovacao: o e-mail puxa o SDK da AWS, e este modulo entra
  // no barril de acoes de Recebimentos online (o teste do registro de servicos
  // passava do tempo importando tudo).
  const [{ recordSystemAudit }, { notifyPlanManagers, planEmailAppUrl }] = await Promise.all([
    import("../server/systemAudit"),
    import("../server/planEmails"),
  ]);
  await recordSystemAudit(admin, "webhook.asaas", {
    organizationId,
    action: "updated",
    target: { type: "settings", id: organizationId, label: "Recebimentos online" },
    predicate: "registrou a aprovação da conta de recebimento pelo parceiro de pagamentos",
  });
  await afterResponse("Conta de recebimento aprovada", async () => {
    await ensureSubaccountPixKey(organizationId).catch((err) =>
      logWarn("[accountStatus] Chave Pix depois da aprovação não criada:", err),
    );
    await notifyPlanManagers(admin, organizationId, {
      title: "Conta de recebimento aprovada",
      text: "O parceiro de pagamentos aprovou a sua conta. Pix, links de pagamento e saques já estão liberados.",
      action: "Abrir Recebimentos online",
      actionUrl: `${planEmailAppUrl()}/online-payments`,
    });
  });
}

/** Aviso ACCOUNT_STATUS_* da subconta: acha o espaco pela conta e grava. */
export async function recordAccountStatusFromWebhook(
  admin: SupabaseClient,
  accountId: string,
  raw: { general?: string; documentation?: string; commercialInfo?: string; bankAccountInfo?: string },
): Promise<string | null> {
  const { data: org } = await admin.from("organizations").select("id").eq("gateway_account_id", accountId).maybeSingle();
  if (!org) return null;
  const organizationId = String(org.id);
  await saveAccountStatus(admin, organizationId, toAccountStatus(raw));
  return organizationId;
}

function toDocument(raw: {
  id: string;
  status?: string;
  type?: string;
  title?: string;
  description?: string;
  onboardingUrl?: string | null;
}): SubaccountDocumentView {
  const status = DOCUMENT.includes(raw.status as AsaasDocumentStatus) ? (raw.status as AsaasDocumentStatus) : "NOT_SENT";
  const description = raw.description?.trim();
  return {
    id: raw.id,
    type: raw.type ?? "CUSTOM",
    title: raw.title?.trim() || "Documento",
    ...(description && description !== "Não possui descrição" ? { description } : {}),
    status,
    ...(raw.onboardingUrl ? { onboardingUrl: raw.onboardingUrl } : {}),
  };
}

/**
 * Le no Asaas a situacao e os documentos que faltam (com a chave da subconta),
 * grava a situacao e devolve o cartao. Sem subconta real: null.
 */
export async function loadSubaccountOnboarding(organizationId: string): Promise<SubaccountOnboardingView | null> {
  const admin = createSupabaseAdminClient();
  const { data: org } = await admin.from("organizations").select("gateway_api_key").eq("id", organizationId).maybeSingle();
  const key = realSubaccountKey(org?.gateway_api_key);
  if (!key) return null;

  const [rawStatus, rawDocuments] = await Promise.all([
    getAccountStatus(key),
    // Documentos falhando nao derruba o cartao: a situacao ainda aparece.
    getAccountDocuments(key).catch((err) => {
      logWarn("[accountStatus] Documentos da subconta não lidos:", err);
      return { data: [], rejectReasons: null };
    }),
  ]);
  const status = toAccountStatus(rawStatus);
  await saveAccountStatus(admin, organizationId, status);
  const rejectReasons = rawDocuments.rejectReasons?.trim();
  return {
    status,
    documents: (rawDocuments.data ?? []).map(toDocument).filter((d) => d.status !== "IGNORED"),
    ...(rejectReasons ? { rejectReasons } : {}),
  };
}
