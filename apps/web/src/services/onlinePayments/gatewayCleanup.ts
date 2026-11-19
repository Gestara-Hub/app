import { AsaasApiError, type AsaasPaymentResponse, deletePayment, getPayment } from "@/lib/asaas";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapWithConcurrency } from "@/lib/concurrency";
import { settleAsaasPayment } from "./asaasSettlement";
import { auditOnlinePaymentConflict, auditOnlinePaymentPaid } from "./onlinePaymentAudit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { realSubaccountKey } from "./gatewaySetup";
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
 * Cancelamento no Asaas (com nova tentativa) e expiracao dos codigos vencidos, por espaco e para todos.
 */

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
 * Reconferir no Asaas antes da baixa de um webhook de aluno (auditoria 31/10):
 * um POST falso (mesmo com segredo) nao marca cobranca como paga sem o Asaas
 * confirmar o status e devolver os valores reais. Quando `ASAAS_API_KEY` nao
 * esta configurada ou a subconta nao usa chave real, segue com o payload.
 */
export async function verifyGatewayPaymentForWebhook(
  admin: SupabaseClient,
  payment: AsaasPaymentResponse,
): Promise<{ ok: true; payment: AsaasPaymentResponse } | { ok: false; status: string }> {
  if (!payment.id || !process.env.ASAAS_API_KEY?.trim() || typeof admin.from !== "function") {
    return { ok: true, payment };
  }
  const { data: op } = await admin
    .from("online_payments")
    .select("organization_id")
    .eq("gateway_payment_id", payment.id)
    .eq("gateway_provider", "asaas")
    .maybeSingle();
  if (!op?.organization_id) return { ok: true, payment };
  const apiKey = await subaccountKeyOf(String(op.organization_id));
  if (!apiKey) return { ok: true, payment };
  try {
    const remote = await getPayment(payment.id, apiKey);
    if (!PAID_STATUSES.has(remote.status)) {
      return { ok: false, status: remote.status };
    }
    return { ok: true, payment: remote };
  } catch (err) {
    if (err instanceof AsaasApiError && (err.status === 404 || err.status === 400)) {
      return { ok: false, status: "not_found" };
    }
    throw err;
  }
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
    logError("[gatewayAccount] Não foi possível cancelar a cobrança no Asaas:", deleteError);
    return "failed";
  }
}

/**
 * Tenta de novo os cancelamentos que falharam (gateway_cancel_pending) de um
 * espaco. O cron de hora em hora usa `retryAllPendingGatewayCancels`.
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
 * Falha no Asaas: expira aqui e marca para tentar de novo. Roda ao abrir o
 * "Cobrar online" e o historico de recebimentos (o cron de hora em hora cobre o
 * resto, `expireAllDueOnlinePayments`). Devolve quantas expirou.
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
  // Asaas em paralelo, com limite (antes um codigo por vez).
  await mapWithConcurrency(rows, GATEWAY_CONCURRENCY, async (row) => {
    if (row.gateway_provider === "asaas" && row.gateway_payment_id && key) {
      const result = await cancelGatewayPayment(String(row.gateway_payment_id), key);
      if (result === "paid") return;
      if (result === "failed") pendingAtGateway.push(String(row.id));
    }
    toExpire.push(String(row.id));
  });
  if (toExpire.length > 0) {
    await admin.from("online_payments").update({ status: "expired" }).in("id", toExpire).eq("status", "awaiting");
  }
  if (pendingAtGateway.length > 0) {
    await admin.from("online_payments").update({ gateway_cancel_pending: true }).in("id", pendingAtGateway);
  }
  return toExpire.length;
}

// --- Cron de hora em hora (todos os espacos) -------------------------------------

/** Chaves das subcontas dos espacos informados, numa consulta so. */
async function subaccountKeysOf(organizationIds: string[]): Promise<Map<string, string>> {
  const keys = new Map<string, string>();
  if (organizationIds.length === 0) return keys;
  const { data } = await createSupabaseAdminClient()
    .from("organizations")
    .select("id, gateway_api_key")
    .in("id", organizationIds);
  for (const org of data ?? []) {
    const key = realSubaccountKey(org.gateway_api_key);
    if (key) keys.set(String(org.id), key);
  }
  return keys;
}

/**
 * Expira os pagamentos online vencidos de todos os espacos (cron por hora,
 * /api/cron/online-payments). Uma consulta so, pelo indice parcial da migracao
 * 34: o custo acompanha quantos venceram, nao quantos espacos existem. Mesma
 * regra de `expireDueOnlinePayments`. Devolve quantos expirou.
 */
export async function expireAllDueOnlinePayments(limit = 500): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from("online_payments")
    .select("id, organization_id, gateway_provider, gateway_payment_id")
    .eq("status", "awaiting")
    .lte("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(limit);
  if (!rows?.length) return 0;

  const asaasOrgs = [...new Set(rows.filter((r) => r.gateway_provider === "asaas").map((r) => String(r.organization_id)))];
  const keys = await subaccountKeysOf(asaasOrgs);
  const toExpire: string[] = [];
  const pendingAtGateway: string[] = [];
  // Asaas em paralelo, com limite (em sequencia, 500 codigos passavam do tempo da rotina).
  await mapWithConcurrency(rows, GATEWAY_CONCURRENCY, async (row) => {
    const key = keys.get(String(row.organization_id));
    if (row.gateway_provider === "asaas" && row.gateway_payment_id && key) {
      const result = await cancelGatewayPayment(String(row.gateway_payment_id), key);
      // Ja paga no Asaas: da a baixa aqui com os dados dele (sem esperar o webhook),
      // senao a linha volta primeiro em toda rodada e trava a fila.
      if (result === "paid") {
        await settlePaidAtGateway(String(row.gateway_payment_id), key);
        return;
      }
      if (result === "failed") pendingAtGateway.push(String(row.id));
    }
    toExpire.push(String(row.id));
  });
  if (toExpire.length > 0) {
    await admin.from("online_payments").update({ status: "expired" }).in("id", toExpire).eq("status", "awaiting");
  }
  if (pendingAtGateway.length > 0) {
    await admin.from("online_payments").update({ gateway_cancel_pending: true }).in("id", pendingAtGateway);
  }
  return toExpire.length;
}

/** Chamadas ao Asaas ao mesmo tempo nas rotinas de todos os espacos. */
const GATEWAY_CONCURRENCY = 5;

/** Pago no Asaas e ainda em aberto aqui: baixa com o status e os valores do Asaas. */
async function settlePaidAtGateway(gatewayPaymentId: string, apiKey: string): Promise<void> {
  try {
    const payment = await getPayment(gatewayPaymentId, apiKey);
    const result = await settleAsaasPayment(payment, payment.status === "RECEIVED" || payment.status === "RECEIVED_IN_CASH");
    // Pago de cobranca que nao estava mais em aberto: o mesmo aviso do webhook.
    if (result?.conflict) {
      logWarn(`[gatewayAccount] Pagamento ${gatewayPaymentId} recebido de cobrança que não estava em aberto (${result.conflict}).`);
      await auditOnlinePaymentConflict(createSupabaseAdminClient(), result.payment, result.conflict);
      return;
    }
    // A baixa feita aqui (antes de o webhook chegar) tambem entra na Auditoria, como a do webhook (01/11/2026).
    if (result?.newlyPaid) await auditOnlinePaymentPaid(createSupabaseAdminClient(), result.payment);
  } catch (error) {
    logError("[gatewayAccount] Não foi possível dar baixa no pagamento já pago no Asaas:", error);
  }
}

/** Tenta de novo os cancelamentos que falharam, de todos os espacos (cron por hora). */
export async function retryAllPendingGatewayCancels(limit = 200): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from("online_payments")
    .select("id, organization_id, gateway_payment_id")
    .eq("gateway_cancel_pending", true)
    .limit(limit);
  if (!rows?.length) return 0;
  const keys = await subaccountKeysOf([...new Set(rows.map((r) => String(r.organization_id)))]);
  const settled: string[] = [];
  await mapWithConcurrency(rows, GATEWAY_CONCURRENCY, async (row) => {
    const key = keys.get(String(row.organization_id));
    if (!row.gateway_payment_id || !key) return;
    const result = await cancelGatewayPayment(String(row.gateway_payment_id), key);
    if (result !== "failed") settled.push(String(row.id));
  });
  // Uma gravacao so para todos os que resolveram.
  if (settled.length > 0) {
    await admin.from("online_payments").update({ gateway_cancel_pending: false }).in("id", settled);
  }
  return settled.length;
}
