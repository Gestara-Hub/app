"use server";

import type { Id, MessageLogStatus, MessageTrigger, OnlinePayment } from "@gestarahub/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { forbiddenError, notFoundError } from "@gestarahub/core/api-error";
import { dateInSpace } from "@gestarahub/core/date";
import { cancelGatewayPayment, expireDueOnlinePayments, subaccountKeyOf } from "./gateway";
import { notAfterAsaasToday, receiveInCash } from "@/lib/asaas";
import { isDemoOrganization } from "@/lib/demo";
import { serverPaymentsTestMode } from "@/lib/payments-test-mode";
import { requireSameOrganization, requireTenant } from "../server/tenant";
import { mapRowToOnlinePayment } from "./onlinePaymentsRows";
import type { OnlineChargeMessageInfo } from "./onlinePaymentRules";
import { logError, logWarn } from "@/lib/log";

/**
 * Codigos de pagamento online no banco: gravar, listar, simular o pago e cancelar (aqui e no Asaas).
 */

export async function insertOnlinePaymentInDb(payment: OnlinePayment): Promise<OnlinePayment> {
  // Grava pelo servidor depois de conferir a sessao (o banco nao aceita escrita
  // direta do usuario, migracao 78): espaco da sessao, cobranca e aluno desse
  // espaco e sempre um codigo novo em aberto.
  const ctx = await requireTenant();
  ctx.require("billing:manage");
  const admin = createSupabaseAdminClient();
  const { data: charge } = await admin
    .from("charges")
    .select("id, student_id")
    .eq("id", payment.chargeId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!charge) throw notFoundError("Cobrança não encontrada.");
  const { data, error } = await admin
    .from("online_payments")
    .insert({
      id: payment.id,
      organization_id: ctx.organizationId,
      charge_id: charge.id,
      client_id: charge.student_id ?? null,
      method: payment.method,
      status: "awaiting",
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
      paid_at: null,
    })
    .select()
    .single();

  if (error) {
    logError(
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
  // O espaco do pedido precisa ser o da sessao: a expiracao abaixo grava pelo servidor.
  const { client } = await requireSameOrganization(organizationId);
  // A modal Cobrar online mostra o codigo em aberto: o vencido expira antes (e sai do Asaas).
  await expireDueOnlinePayments(organizationId).catch((err) =>
    logError("[listOnlinePaymentsForChargeFromDb] Erro ao expirar cobranças vencidas:", err),
  );
  const { data, error } = await client
    .from("online_payments")
    .select("*")
    .eq("charge_id", chargeId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    logError(
      "[onlinePaymentsBackend] Erro ao listar pagamentos da cobrança:",
      error,
    );
    return [];
  }

  return (data || []).map(mapRowToOnlinePayment);
}

/** Resultado da liquidacao simulada: pago, nao achado ou recusado pelo parceiro. */
export type SimulateOnlinePaidResult =
  | { ok: true; payment: OnlinePayment; chargeId: string }
  | { ok: false; reason: "not_found" | "gateway_refused" };

/**
 * Simula a liquidação de um pagamento online no Sandbox/banco local.
 * Com o Asaas, pede a baixa ao parceiro **primeiro**, com a data de hoje no
 * fuso do espaco (achado 76: a data em UTC depois das 21h era "futura" para o
 * Asaas, que recusava); so marca pago no app se o parceiro aceitar. Sem
 * parceiro (demonstracao), marca pago direto.
 */
export async function simulateOnlinePaidAction(onlinePaymentId: string): Promise<SimulateOnlinePaidResult> {
  const ctx = await requireTenant();
  ctx.require("billing:manage");
  // Fora do Asaas de testes, so o pagamento de verdade (webhook) marca pago.
  if (!serverPaymentsTestMode() && !isDemoOrganization(ctx.organizationId)) throw forbiddenError();
  const adminClient = createSupabaseAdminClient();

  // 1. Busca o pagamento online pelo ID
  const { data: row, error: fetchErr } = await adminClient
    .from("online_payments")
    .select("*")
    .eq("id", onlinePaymentId)
    .maybeSingle();

  if (row && row.organization_id !== ctx.organizationId) throw forbiddenError();
  if (fetchErr || !row) {
    logError("[simulateOnlinePaidAction] Pagamento online não encontrado:", onlinePaymentId, fetchErr);
    return { ok: false, reason: "not_found" };
  }

  // 2. Asaas: a baixa no parceiro vem antes. Recusou, nada muda no app.
  if (row.gateway_payment_id && row.gateway_provider === "asaas") {
    const { data: org } = await adminClient
      .from("organizations")
      .select("gateway_api_key")
      .eq("id", ctx.organizationId)
      .maybeSingle();
    try {
      await receiveInCash(
        String(row.gateway_payment_id),
        notAfterAsaasToday(dateInSpace()),
        (Number(row.amount_cents) || 0) / 100,
        org?.gateway_api_key ?? undefined,
      );
    } catch (asaasErr) {
      logWarn("[simulateOnlinePaidAction] O Asaas recusou a baixa; a cobrança continua em aberto:", asaasErr);
      return { ok: false, reason: "gateway_refused" };
    }
  }

  const paidAtISO = new Date().toISOString();

  // 3. Atualiza o status para pago
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
    logError("[simulateOnlinePaidAction] Erro ao atualizar status do online_payment:", paymentError);
    return { ok: false, reason: "not_found" };
  }

  // 4. Cancela outros pagamentos da mesma cobrança ainda em aberto
  await adminClient
    .from("online_payments")
    .update({ status: "canceled", canceled_reason: "Pago por outro código" })
    .eq("charge_id", row.charge_id)
    .neq("id", row.id)
    .eq("status", "awaiting");

  // 5. Atualiza a cobrança para paga
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
    logError("[simulateOnlinePaidAction] Erro ao atualizar charge após simulação:", chargeError);
  }

  const payment = mapRowToOnlinePayment(updatedPayment);
  return { ok: true, payment, chargeId: String(row.charge_id) };
}

export async function cancelOnlinePaymentsForChargeInDb(
  chargeId: Id,
  organizationId: string,
  reason?: string,
): Promise<void> {
  // Grava pelo servidor (migracao 78): so quem cobra, no espaco da sessao.
  const ctx = await requireSameOrganization(organizationId, { permissions: ["billing:manage"] });
  const admin = createSupabaseAdminClient();
  const { data: rows } = await ctx.client
    .from("online_payments")
    .select("id, gateway_provider, gateway_payment_id")
    .eq("charge_id", chargeId)
    .eq("organization_id", ctx.organizationId)
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
  await admin.from("online_payments").update(updatePayload).eq("organization_id", ctx.organizationId).in("id", toCancel);
  // Falhou no Asaas: cancela aqui mesmo assim e marca para tentar de novo.
  if (pendingAtGateway.length > 0) {
    await admin
      .from("online_payments")
      .update({ gateway_cancel_pending: true })
      .eq("organization_id", ctx.organizationId)
      .in("id", pendingAtGateway);
  }
}

/**
 * Depois de o servidor gravar o cancelamento dos codigos (doc 15, fatia 2),
 * cancela tambem no Asaas. O espaco vem da sessao e as linhas sao lidas com o
 * RLS dela. Ja pago no Asaas fica para o webhook dar a baixa; falha no Asaas
 * marca para tentar de novo.
 *
 * Roda com quem fez a acao (o atendente que inativou o aluno, por exemplo), por
 * isso nao pede a permissao de cobrancas: so repassa ao Asaas o que o banco ja
 * marcou como cancelado. Chamada de fora, nao cancela codigo em aberto
 * (revisao geral de 31/10/2026, achado S7 e a sua correcao).
 */
export async function cancelGatewayPaymentsAction(paymentIds: Id[]): Promise<void> {
  if (paymentIds.length === 0) return;
  const ctx = await requireTenant();
  const { data: rows } = await ctx.client
    .from("online_payments")
    .select("id, gateway_provider, gateway_payment_id")
    .eq("organization_id", ctx.organizationId)
    .eq("status", "canceled")
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

/** Ultima mensagem disparada (automatica ou manual) para a cobranca no banco. */
export async function lastMessageForChargeFromDb(
  chargeId: Id,
  organizationId: string,
): Promise<OnlineChargeMessageInfo | undefined> {
  const { client } = await requireSameOrganization(organizationId);
  const { data, error } = await client
    .from("message_logs")
    .select("sent_at, trigger, status, recipient_phone, recipient_name")
    .eq("charge_id", chargeId)
    .eq("organization_id", organizationId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return undefined;
  return {
    sentAt: data.sent_at,
    trigger: data.trigger as MessageTrigger,
    status: data.status as MessageLogStatus,
    recipientPhone: data.recipient_phone,
    recipientName: data.recipient_name,
  };
}
