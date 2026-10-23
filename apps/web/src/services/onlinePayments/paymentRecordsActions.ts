"use server";

import type { Id, OnlinePayment } from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { forbiddenError } from "@gestarahub/core/api-error";
import { cancelGatewayPayment, expireDueOnlinePayments, subaccountKeyOf } from "./gateway";
import { receiveInCash } from "@/lib/asaas";
import { requireTenant } from "../server/tenant";
import { mapRowToOnlinePayment } from "./onlinePaymentsRows";

/**
 * Codigos de pagamento online no banco: gravar, listar, simular o pago e cancelar (aqui e no Asaas).
 */

export async function insertOnlinePaymentInDb(
  payment: OnlinePayment,
  clientId?: string,
): Promise<OnlinePayment> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("online_payments")
    .insert({
      id: payment.id,
      organization_id: payment.organizationId,
      charge_id: payment.chargeId,
      client_id: clientId ?? null,
      method: payment.method,
      status: payment.status,
      amount_cents: payment.amountCents,
      split_amount_cents: payment.splitAmountCents ?? 0,
      gateway_fee_cents: payment.gatewayFeeCents ?? 0,
      net_amount_cents: payment.netAmountCents ?? payment.amountCents,
      gateway_provider: payment.gatewayProvider ?? "asaas",
      gateway_payment_id: payment.gatewayPaymentId ?? null,
      pix_copy_paste: payment.pixCopyPaste ?? null,
      link_url: payment.linkUrl ?? null,
      public_code: payment.publicCode ?? null,
      fee_passed_to_customer: Boolean(payment.feePassedToCustomer),
      expires_at: payment.expiresAt,
      paid_at: payment.paidAt ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error(
      "[onlinePaymentsBackend] Erro ao inserir pagamento online:",
      error,
    );
    throw new Error("Erro ao registrar pagamento online no banco de dados.");
  }

  return mapRowToOnlinePayment(data);
}

export async function listOnlinePaymentsForChargeFromDb(
  chargeId: Id,
  organizationId: string,
): Promise<OnlinePayment[]> {
  const client = await getClientForTenant();
  // A modal Cobrar online mostra o codigo em aberto: o vencido expira antes (e sai do Asaas).
  await expireDueOnlinePayments(organizationId).catch((err) =>
    console.error("[listOnlinePaymentsForChargeFromDb] Erro ao expirar cobranças vencidas:", err),
  );
  const { data, error } = await client
    .from("online_payments")
    .select("*")
    .eq("charge_id", chargeId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "[onlinePaymentsBackend] Erro ao listar pagamentos da cobrança:",
      error,
    );
    return [];
  }

  return (data || []).map(mapRowToOnlinePayment);
}

/**
 * Simula a liquidação de um pagamento online no Sandbox/banco local.
 * Marca o online_payment e a cobrança correspondente como pagos no Supabase,
 * e notifica o Asaas via receiveInCash caso esteja em ambiente de testes.
 */
export async function simulateOnlinePaidAction(
  onlinePaymentId: string,
): Promise<{ payment: OnlinePayment; chargeId: string } | null> {
  const ctx = await requireTenant();
  ctx.require("billing:manage");
  const adminClient = createSupabaseAdminClient();

  // 1. Busca o pagamento online pelo ID
  const { data: row, error: fetchErr } = await adminClient
    .from("online_payments")
    .select("*")
    .eq("id", onlinePaymentId)
    .maybeSingle();

  if (row && row.organization_id !== ctx.organizationId) throw forbiddenError();
  if (fetchErr || !row) {
    console.error(
      "[simulateOnlinePaidAction] Pagamento online não encontrado:",
      onlinePaymentId,
      fetchErr,
    );
    return null;
  }

  const paidAtISO = new Date().toISOString();

  // 2. Atualiza o status para pago
  const { data: updatedPayment, error: paymentError } = await adminClient
    .from("online_payments")
    .update({
      status: "paid",
      paid_at: paidAtISO,
    })
    .eq("id", row.id)
    .select()
    .maybeSingle();

  if (paymentError || !updatedPayment) {
    console.error(
      "[simulateOnlinePaidAction] Erro ao atualizar status do online_payment:",
      paymentError,
    );
    return null;
  }

  // 3. Cancela outros pagamentos da mesma cobrança ainda em aberto
  await adminClient
    .from("online_payments")
    .update({ status: "canceled", canceled_reason: "Pago por outro código" })
    .eq("charge_id", row.charge_id)
    .neq("id", row.id)
    .eq("status", "awaiting");

  // 4. Atualiza a cobrança para paga
  const method = row.method === "link" ? "card" : "pix";
  const { error: chargeError } = await adminClient
    .from("charges")
    .update({
      status: "paid",
      method,
      paid_via: "online",
      paid_at: paidAtISO,
    })
    .eq("id", row.charge_id);

  if (chargeError) {
    console.error(
      "[simulateOnlinePaidAction] Erro ao atualizar charge após simulação:",
      chargeError,
    );
  }

  // 5. Se for Asaas Sandbox e tiver gateway_payment_id, liquida no gateway também
  if (row.gateway_payment_id && row.gateway_provider === "asaas") {
    try {
      const { data: charge } = await adminClient
        .from("charges")
        .select("organization_id")
        .eq("id", row.charge_id)
        .maybeSingle();

      let subaccountApiKey: string | undefined;
      if (charge?.organization_id) {
        const { data: org } = await adminClient
          .from("organizations")
          .select("gateway_api_key")
          .eq("id", charge.organization_id)
          .maybeSingle();
        subaccountApiKey = org?.gateway_api_key;
      }

      const todayDate = paidAtISO.split("T")[0];
      await receiveInCash(
        String(row.gateway_payment_id),
        todayDate,
        (Number(row.amount_cents) || 0) / 100,
        subaccountApiKey,
      );
      console.log(
        `[simulateOnlinePaidAction] Baixa confirmada no Asaas Sandbox para o pagamento ${row.gateway_payment_id}!`,
      );
    } catch (asaasErr) {
      console.warn(
        "[simulateOnlinePaidAction] Não foi possível liquidar no Asaas Sandbox (ignorado):",
        asaasErr,
      );
    }
  }

  const payment = mapRowToOnlinePayment(updatedPayment);
  return { payment, chargeId: String(row.charge_id) };
}

export async function cancelOnlinePaymentsForChargeInDb(
  chargeId: Id,
  organizationId: string,
  reason?: string,
): Promise<void> {
  const client = await getClientForTenant();
  const { data: rows } = await client
    .from("online_payments")
    .select("id, gateway_provider, gateway_payment_id")
    .eq("charge_id", chargeId)
    .eq("organization_id", organizationId)
    .eq("status", "awaiting");
  if (!rows?.length) return;

  // Cancela tambem no Asaas, senao o aluno ainda paga o link ou o QR antigo.
  const key = rows.some((r) => r.gateway_provider === "asaas") ? await subaccountKeyOf(organizationId) : null;
  const toCancel: string[] = [];
  const pendingAtGateway: string[] = [];
  for (const row of rows) {
    if (row.gateway_provider === "asaas" && row.gateway_payment_id && key) {
      const result = await cancelGatewayPayment(String(row.gateway_payment_id), key);
      // Ja paga no Asaas: nao cancela aqui; o webhook de pagamento da a baixa.
      if (result === "paid") continue;
      if (result === "failed") pendingAtGateway.push(String(row.id));
    }
    toCancel.push(String(row.id));
  }
  if (toCancel.length === 0) return;

  const updatePayload: Record<string, unknown> = { status: "canceled" };
  if (reason) updatePayload.canceled_reason = reason;
  await client.from("online_payments").update(updatePayload).in("id", toCancel);
  // Falhou no Asaas: cancela aqui mesmo assim e marca para tentar de novo.
  if (pendingAtGateway.length > 0) {
    await client.from("online_payments").update({ gateway_cancel_pending: true }).in("id", pendingAtGateway);
  }
}

/**
 * Depois de o servidor gravar o cancelamento dos codigos (doc 15, fatia 2),
 * cancela tambem no Asaas. O espaco vem da sessao e as linhas sao lidas com o
 * RLS dela. Ja pago no Asaas fica para o webhook dar a baixa; falha no Asaas
 * marca para tentar de novo.
 */
export async function cancelGatewayPaymentsAction(paymentIds: Id[]): Promise<void> {
  if (paymentIds.length === 0) return;
  const { requireTenant } = await import("../server/tenant");
  const ctx = await requireTenant();
  const { data: rows } = await ctx.client
    .from("online_payments")
    .select("id, gateway_provider, gateway_payment_id")
    .eq("organization_id", ctx.organizationId)
    .in("id", paymentIds);
  const asaasRows = (rows ?? []).filter((r) => r.gateway_provider === "asaas" && r.gateway_payment_id);
  if (asaasRows.length === 0) return;
  const key = await subaccountKeyOf(ctx.organizationId);
  if (!key) return;
  const pending: string[] = [];
  for (const row of asaasRows) {
    const result = await cancelGatewayPayment(String(row.gateway_payment_id), key);
    if (result === "failed") pending.push(String(row.id));
  }
  if (pending.length > 0) {
    await createSupabaseAdminClient()
      .from("online_payments")
      .update({ gateway_cancel_pending: true })
      .eq("organization_id", ctx.organizationId)
      .in("id", pending);
  }
}
