import type { GatewayAccountFees, LinkPaymentMethodName } from "@gestarahub/contracts";
import {
  areGatewayFeesStale,
  effectiveGatewayFees,
  isGatewayFeeDivergent,
  parseAsaasAccountFees,
} from "@gestarahub/core/payment-fees";
import {
  createWebhook,
  deletePayment,
  getAccountFees,
  getAccountInfo,
  getPayment,
  listWebhooks,
  updateWebhook,
} from "@/lib/asaas";
import type { AsaasWebhookConfig } from "@/lib/asaas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

/** Nome do webhook do GestaraHub em cada subconta (para achar e atualizar, nao duplicar). */
export const GESTARAHUB_WEBHOOK_NAME = "GestaraHub";

/** Eventos de cobranca que a rota app/api/webhooks/asaas trata. */
const WEBHOOK_EVENTS = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_OVERDUE", "PAYMENT_DELETED"];

/** Chave de subconta de verdade (as do modo de demonstracao comecam com "mock_"). */
function realSubaccountKey(key: unknown): string | null {
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
    console.error("[gatewayAccount] Não foi possível buscar as tarifas da subconta:", err);
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
    console.error("[gatewayAccount] Não foi possível ler o e-mail da conta principal:", err);
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
    console.warn(`[gatewayAccount] Webhook da subconta não cadastrado: ${reason}`);
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
    console.warn(`[gatewayAccount] Webhook da subconta não cadastrado: ${reason}`);
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
    console.error("[gatewayAccount] Não foi possível cadastrar o webhook da subconta:", err);
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
  await expireDueOnlinePayments(row.id);
  await retryPendingGatewayCancels(row.id);
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

/** Status do Asaas em que o dinheiro ja entrou: nao cancelar, o pagamento vale. */
const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
/** Status em que a cobranca ja nao pode ser paga: conta como cancelada. */
const GONE_STATUSES = new Set(["DELETED", "REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED"]);

export type GatewayCancelResult = "canceled" | "paid" | "failed";

/** Chave da subconta do espaco (so as de verdade). */
export async function subaccountKeyOf(organizationId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("gateway_api_key")
    .eq("id", organizationId)
    .maybeSingle();
  return realSubaccountKey(data?.gateway_api_key);
}

/**
 * Cancela a cobranca no Asaas (DELETE /v3/payments/{id}). Se o Asaas recusar,
 * consulta o status: ja paga, o pagamento vale ("paid", nao cancelar aqui);
 * ja removida ou estornada, conta como cancelada; o resto e falha, para tentar
 * de novo depois.
 */
export async function cancelGatewayPayment(gatewayPaymentId: string, apiKey: string): Promise<GatewayCancelResult> {
  try {
    await deletePayment(gatewayPaymentId, apiKey);
    return "canceled";
  } catch (deleteError) {
    try {
      const payment = await getPayment(gatewayPaymentId, apiKey);
      const status = String((payment as { status?: unknown }).status ?? "");
      if (PAID_STATUSES.has(status)) return "paid";
      if (GONE_STATUSES.has(status) || (payment as { deleted?: unknown }).deleted === true) return "canceled";
    } catch (lookupError) {
      if ((lookupError as { status?: number }).status === 404) return "canceled";
    }
    console.error("[gatewayAccount] Não foi possível cancelar a cobrança no Asaas:", deleteError);
    return "failed";
  }
}

/**
 * Tenta de novo os cancelamentos que falharam (gateway_cancel_pending). Roda
 * junto com a atualizacao das tarifas, quando o app le a organizacao.
 */
export async function retryPendingGatewayCancels(organizationId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from("online_payments")
    .select("id, gateway_payment_id")
    .eq("organization_id", organizationId)
    .eq("gateway_cancel_pending", true)
    .limit(50);
  if (!rows?.length) return;
  const key = await subaccountKeyOf(organizationId);
  if (!key) return;
  for (const row of rows) {
    if (!row.gateway_payment_id) continue;
    const result = await cancelGatewayPayment(String(row.gateway_payment_id), key);
    // "paid": o webhook de pagamento da a baixa; aqui so para de tentar.
    if (result !== "failed") {
      await admin.from("online_payments").update({ gateway_cancel_pending: false }).eq("id", row.id);
    }
  }
}

// --- Expiracao ------------------------------------------------------------------

/**
 * Cobrancas online em aberto que passaram da validade (expires_at): marca como
 * expiradas aqui e exclui no Asaas, para que "Expirado" signifique que nao da
 * mais para pagar nos dois lados (antes o Asaas so vencia a cobranca, que
 * seguia pagavel). Ja paga no Asaas: fica em aberto aqui e o webhook da a baixa.
 * Falha no Asaas: expira aqui e marca para tentar de novo. Roda quando o app le
 * a organizacao, o historico ou a cobranca. Devolve quantas expirou.
 */
export async function expireDueOnlinePayments(organizationId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from("online_payments")
    .select("id, gateway_provider, gateway_payment_id")
    .eq("organization_id", organizationId)
    .eq("status", "awaiting")
    .lte("expires_at", new Date().toISOString())
    .limit(50);
  if (!rows?.length) return 0;

  const key = rows.some((r) => r.gateway_provider === "asaas") ? await subaccountKeyOf(organizationId) : null;
  const toExpire: string[] = [];
  const pendingAtGateway: string[] = [];
  for (const row of rows) {
    if (row.gateway_provider === "asaas" && row.gateway_payment_id && key) {
      const result = await cancelGatewayPayment(String(row.gateway_payment_id), key);
      if (result === "paid") continue;
      if (result === "failed") pendingAtGateway.push(String(row.id));
    }
    toExpire.push(String(row.id));
  }
  if (toExpire.length > 0) {
    await admin.from("online_payments").update({ status: "expired" }).in("id", toExpire).eq("status", "awaiting");
  }
  if (pendingAtGateway.length > 0) {
    await admin.from("online_payments").update({ gateway_cancel_pending: true }).in("id", pendingAtGateway);
  }
  return toExpire.length;
}
