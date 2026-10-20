"use server";

import type { Id, OnlinePayment } from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  CreateLinkInput,
  CreatePixInput,
  PaymentLinkPayment,
  PixPayment,
} from "./payments/types";
import { getPaymentGateway } from "./payments/registry";

function mapRowToOnlinePayment(row: Record<string, unknown>): OnlinePayment {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    chargeId: String(row.charge_id),
    method: (row.method as OnlinePayment["method"]) || "pix",
    status: (row.status as OnlinePayment["status"]) || "awaiting",
    amountCents: typeof row.amount_cents === "number" ? row.amount_cents : 0,
    splitAmountCents:
      typeof row.split_amount_cents === "number" ? row.split_amount_cents : 0,
    netAmountCents:
      typeof row.net_amount_cents === "number" ? row.net_amount_cents : 0,
    gatewayProvider: row.gateway_provider
      ? String(row.gateway_provider)
      : undefined,
    gatewayPaymentId: row.gateway_payment_id
      ? String(row.gateway_payment_id)
      : undefined,
    pixCopyPaste: row.pix_copy_paste ? String(row.pix_copy_paste) : undefined,
    pixQrCodeBase64: row.pix_qr_code_base64
      ? String(row.pix_qr_code_base64)
      : undefined,
    linkUrl: row.link_url ? String(row.link_url) : undefined,
    expiresAt: row.expires_at
      ? new Date(String(row.expires_at)).toISOString()
      : new Date().toISOString(),
    paidAt: row.paid_at
      ? new Date(String(row.paid_at)).toISOString()
      : undefined,
    createdAt: row.created_at
      ? new Date(String(row.created_at)).toISOString()
      : new Date().toISOString(),
  };
}

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
      net_amount_cents: payment.netAmountCents ?? payment.amountCents,
      gateway_provider: payment.gatewayProvider ?? "asaas",
      gateway_payment_id: payment.gatewayPaymentId ?? null,
      pix_copy_paste: payment.pixCopyPaste ?? null,
      pix_qr_code_base64: payment.pixQrCodeBase64 ?? null,
      link_url: payment.linkUrl ?? null,
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

export async function getOnlinePaymentByGatewayIdFromDb(
  gatewayPaymentId: string,
  provider?: string,
): Promise<OnlinePayment | null> {
  const adminClient = createSupabaseAdminClient();
  let query = adminClient
    .from("online_payments")
    .select("*")
    .eq("gateway_payment_id", gatewayPaymentId);

  if (provider) {
    query = query.eq("gateway_provider", provider);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapRowToOnlinePayment(data);
}

export async function markOnlinePaymentPaidInDb(
  gatewayPaymentId: string,
  paidAtISO: string,
  provider?: string,
): Promise<{ payment: OnlinePayment; chargeId: string } | null> {
  const adminClient = createSupabaseAdminClient();

  // 1. Atualiza online_payments
  let query = adminClient
    .from("online_payments")
    .update({
      status: "paid",
      paid_at: paidAtISO,
    })
    .eq("gateway_payment_id", gatewayPaymentId);

  if (provider) {
    query = query.eq("gateway_provider", provider);
  }

  const { data: updatedPayment, error: paymentError } = await query
    .select()
    .maybeSingle();

  if (paymentError || !updatedPayment) {
    console.error(
      "[onlinePaymentsBackend] Erro ao marcar online_payment como pago:",
      paymentError,
    );
    return null;
  }

  const payment = mapRowToOnlinePayment(updatedPayment);

  // 2. Atualiza a charge correspondente
  const { error: chargeError } = await adminClient
    .from("charges")
    .update({
      status: "paid",
      method: "pix",
      paid_via: "online",
      paid_at: paidAtISO,
    })
    .eq("id", payment.chargeId);

  if (chargeError) {
    console.error(
      "[onlinePaymentsBackend] Erro ao atualizar charge após pagamento online:",
      chargeError,
    );
  }

  return { payment, chargeId: payment.chargeId };
}

export async function expireOnlinePaymentInDb(
  gatewayPaymentId: string,
  provider?: string,
): Promise<boolean> {
  const adminClient = createSupabaseAdminClient();
  let query = adminClient
    .from("online_payments")
    .update({ status: "expired" })
    .eq("gateway_payment_id", gatewayPaymentId)
    .eq("status", "awaiting");

  if (provider) {
    query = query.eq("gateway_provider", provider);
  }

  const { error } = await query;
  return !error;
}

export async function cancelOnlinePaymentByGatewayIdInDb(
  gatewayPaymentId: string,
  provider?: string,
): Promise<boolean> {
  const adminClient = createSupabaseAdminClient();
  let query = adminClient
    .from("online_payments")
    .update({ status: "canceled" })
    .eq("gateway_payment_id", gatewayPaymentId)
    .eq("status", "awaiting");

  if (provider) {
    query = query.eq("gateway_provider", provider);
  }

  const { error } = await query;
  return !error;
}

export async function cancelOnlinePaymentsForChargeInDb(
  chargeId: Id,
  organizationId: string,
): Promise<void> {
  const client = await getClientForTenant();
  await client
    .from("online_payments")
    .update({ status: "canceled" })
    .eq("charge_id", chargeId)
    .eq("organization_id", organizationId)
    .eq("status", "awaiting");
}

/**
 * Server Action agnóstica para criação de Pix online via gateway ativo.
 */
export async function createOnlinePixPaymentAction(
  input: CreatePixInput,
  provider?: string,
): Promise<PixPayment | null> {
  try {
    const gateway = getPaymentGateway(provider);
    return await gateway.createPix(input);
  } catch (error) {
    console.error(
      "[createOnlinePixPaymentAction] Erro ao gerar Pix no gateway:",
      error,
    );
    return null;
  }
}

/**
 * Server Action agnóstica para criação de link de pagamento via gateway ativo.
 */
export async function createOnlineLinkPaymentAction(
  input: CreateLinkInput,
  provider?: string,
): Promise<PaymentLinkPayment | null> {
  try {
    const gateway = getPaymentGateway(provider);
    return await gateway.createLink(input);
  } catch (error) {
    console.error(
      "[createOnlineLinkPaymentAction] Erro ao gerar Link no gateway:",
      error,
    );
    return null;
  }
}

// --- Aliases de compatibilidade para código legado --------------------------

export async function getOnlinePaymentByAsaasIdFromDb(
  asaasPaymentId: string,
): Promise<OnlinePayment | null> {
  return getOnlinePaymentByGatewayIdFromDb(asaasPaymentId, "asaas");
}

export async function createAsaasPixPaymentAction(
  input: CreatePixInput,
): Promise<PixPayment | null> {
  return createOnlinePixPaymentAction(input, "asaas");
}

export async function createAsaasLinkPaymentAction(
  input: CreateLinkInput,
): Promise<PaymentLinkPayment | null> {
  return createOnlineLinkPaymentAction(input, "asaas");
}
