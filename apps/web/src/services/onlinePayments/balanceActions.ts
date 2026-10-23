"use server";

import { selectAllRows } from "@/lib/supabase/select-all";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSubaccountBalance, createTransfer, listTransfers } from "@/lib/asaas";
import { requireSameOrganization } from "../server/tenant";

/**
 * Saldo da subconta e saques via Pix.
 */

function detectPixKeyType(
  key: string,
): "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP" {
  const clean = key.trim();
  if (clean.includes("@")) return "EMAIL";
  const digits = clean.replace(/\D/g, "");
  if (digits.length === 11) {
    if (clean.startsWith("+") || clean.includes("(") || clean.includes(")")) {
      return "PHONE";
    }
    return "CPF";
  }
  if (digits.length === 14) return "CNPJ";
  return "EVP";
}

export interface SubaccountBalanceResult {
  balanceCents: number;
  /** Pago e ainda nao liberado (cartao), do banco do GestaraHub. */
  awaitingCents: number;
  /** Proximo dia em que algum valor a liberar fica disponivel. */
  nextCreditDate?: string;
  availableForTransferCents: number;
}

/**
 * A liberar: pagos pelo aluno com o saldo ainda nao disponivel (PAYMENT_CONFIRMED
 * sem o RECEIVED). O saldo do Asaas (`GET /finance/balance`) so traz o disponivel.
 */
async function pendingRelease(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  organizationId: string,
): Promise<{ awaitingCents: number; nextCreditDate?: string }> {
  const { data } = await selectAllRows(() =>
    adminClient
      .from("online_payments")
      .select("net_amount_cents, credit_date")
      .eq("organization_id", organizationId)
      .eq("status", "paid")
      .eq("funds_released", false),
  );
  const rows = data ?? [];
  const dates = rows.map((r) => (r.credit_date ? String(r.credit_date).slice(0, 10) : "")).filter(Boolean).sort();
  return {
    awaitingCents: rows.reduce((total, r) => total + (Number(r.net_amount_cents) || 0), 0),
    nextCreditDate: dates[0],
  };
}

/**
 * Consulta o saldo financeiro da subconta na Asaas ou fallback local.
 */
export async function getSubaccountBalanceAction(
  organizationId: string,
): Promise<SubaccountBalanceResult> {
  await requireSameOrganization(organizationId, { permissions: ["finance:view"] });
  const adminClient = createSupabaseAdminClient();
  const { data: org } = await adminClient
    .from("organizations")
    .select("gateway_api_key")
    .eq("id", organizationId)
    .maybeSingle();

  const pending = await pendingRelease(adminClient, organizationId);

  if (org?.gateway_api_key && process.env.ASAAS_API_KEY) {
    try {
      const res = await getSubaccountBalance(org.gateway_api_key);
      const balanceCents = Math.round((res.balance || 0) * 100);
      return {
        balanceCents,
        ...pending,
        availableForTransferCents: Math.max(0, balanceCents),
      };
    } catch (err) {
      console.error("[getSubaccountBalanceAction] Erro no Asaas:", err);
    }
  }

  // Fallback: calcula a partir dos pagamentos online pagos no banco
  const { data: payments } = await selectAllRows(() =>
    adminClient
      .from("online_payments")
      .select("net_amount_cents, status")
      .eq("organization_id", organizationId)
      .eq("status", "paid")
      .eq("funds_released", true),
  );

  const totalNet = (payments || []).reduce(
    (acc, p) => acc + (p.net_amount_cents || 0),
    0,
  );

  return {
    balanceCents: totalNet,
    ...pending,
    availableForTransferCents: totalNet,
  };
}

export interface TransferActionResult {
  success: boolean;
  transferId?: string;
  status?: string;
  error?: string;
}

/**
 * Realiza transferência via Pix do saldo da subconta para a chave Pix do titular.
 */
export async function requestSubaccountTransferAction(input: {
  organizationId: string;
  amountCents: number;
  pixKey: string;
}): Promise<TransferActionResult> {
  // Tirar dinheiro da subconta: so o dono do espaco.
  await requireSameOrganization(input.organizationId, { profiles: ["owner"] });
  if (input.amountCents <= 0) {
    return { success: false, error: "O valor deve ser maior que zero." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: org } = await adminClient
    .from("organizations")
    .select("gateway_api_key")
    .eq("id", input.organizationId)
    .maybeSingle();

  if (org?.gateway_api_key && process.env.ASAAS_API_KEY) {
    try {
      const keyType = detectPixKeyType(input.pixKey);
      const res = await createTransfer(
        {
          value: input.amountCents / 100,
          operationType: "PIX",
          pixAddressKey: input.pixKey.trim(),
          pixAddressKeyType: keyType,
          description: "Saque GestaraHub",
        },
        org.gateway_api_key,
      );

      return {
        success: true,
        transferId: res.id,
        status: res.status,
      };
    } catch (err: unknown) {
      console.error("[requestSubaccountTransferAction] Erro no Asaas:", err);
      const msg =
        err instanceof Error ? err.message : "Erro ao realizar transferência.";
      return { success: false, error: msg };
    }
  }

  // Mock transfer
  return {
    success: true,
    transferId: `mock_tr_${Date.now()}`,
    status: "DONE",
  };
}

export interface SubaccountTransferItem {
  id: string;
  dateCreated: string;
  valueCents: number;
  status: string;
  receiptUrl?: string;
}

/**
 * Lista as transferências realizadas na subconta.
 */
export async function listSubaccountTransfersAction(
  organizationId: string,
): Promise<SubaccountTransferItem[]> {
  await requireSameOrganization(organizationId, { permissions: ["finance:view"] });
  const adminClient = createSupabaseAdminClient();
  const { data: org } = await adminClient
    .from("organizations")
    .select("gateway_api_key")
    .eq("id", organizationId)
    .maybeSingle();

  if (org?.gateway_api_key && process.env.ASAAS_API_KEY) {
    try {
      const res = await listTransfers(org.gateway_api_key);
      return (res.data || []).map((t) => ({
        id: t.id,
        dateCreated: t.dateCreated,
        valueCents: Math.round(t.value * 100),
        status: t.status,
        receiptUrl: t.transactionReceiptUrl,
      }));
    } catch (err) {
      console.error("[listSubaccountTransfersAction] Erro no Asaas:", err);
    }
  }

  return [];
}
