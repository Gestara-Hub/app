"use server";

import { resetRateLimit } from "@/lib/security/rate-limit";
import { selectAllRows } from "@/lib/supabase/select-all";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSubaccountBalance, createTransfer, listTransfers } from "@/lib/asaas";
import { requireSameOrganization } from "../server/tenant";
import { logError, withErrorScope } from "@/lib/log";

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
  return withErrorScope(async () => {
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
        logError("[getSubaccountBalanceAction] Erro no Asaas:", err);
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
  });
}

/** Saque igual (valor e chave) de novo so depois deste prazo. */
const SAME_TRANSFER_WINDOW_SECONDS = 30;

/**
 * Reserva uma chave uma vez no prazo (contador atomico do banco). Ao contrario
 * do limite de pedidos, falha no banco nao libera: e dinheiro.
 */
async function claimOnce(key: string, windowSeconds: number): Promise<"claimed" | "taken" | "unavailable"> {
  try {
    const { data, error } = await createSupabaseAdminClient().rpc("check_rate_limit", {
      p_key: key,
      p_max_points: 1,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      logError("[requestSubaccountTransferAction] Trava do saque indisponível:", error);
      return "unavailable";
    }
    return data ? "claimed" : "taken";
  } catch (err) {
    logError("[requestSubaccountTransferAction] Trava do saque indisponível:", err);
    return "unavailable";
  }
}

export interface TransferActionResult {
  success: boolean;
  transferId?: string;
  status?: string;
  /**
   * `false`: o Asaas criou o saque, mas ele so sai depois que o dono confirma
   * com o codigo no site ou no app do Asaas (evento critico, padrao em saque
   * pedido por integracao). O valor ja sai do saldo disponivel ate la.
   */
  needsConfirmation?: boolean;
  error?: string;
}

/**
 * Realiza transferência via Pix do saldo da subconta para a chave Pix do titular.
 */
export async function requestSubaccountTransferAction(input: {
  organizationId: string;
  amountCents: number;
  pixKey: string;
  /** Id do pedido, gerado pela tela: o mesmo pedido nunca vira dois saques. */
  requestId: string;
}): Promise<TransferActionResult> {
  return withErrorScope(async () => {
    // Tirar dinheiro da subconta: so o dono do espaco.
    await requireSameOrganization(input.organizationId, { profiles: ["owner"] });
    if (input.amountCents <= 0) {
      return { success: false, error: "O valor deve ser maior que zero." };
    }
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(input.requestId ?? "")) {
      return { success: false, error: "Pedido de saque inválido. Abra a tela de novo." };
    }

    // Saque em dobro (19/11/2026): o mesmo pedido (clique duplo, nova tentativa)
    // so passa uma vez; e o mesmo valor para a mesma chave, de outra aba, espera
    // alguns segundos. Sem o banco para conferir, nao saca.
    const sameKey = `transfer_same:${input.organizationId}:${input.amountCents}:${input.pixKey.trim().toLowerCase()}`;
    const requestClaim = await claimOnce(`transfer_request:${input.organizationId}:${input.requestId}`, 24 * 60 * 60);
    if (requestClaim !== "claimed") {
      return {
        success: false,
        error:
          requestClaim === "taken"
            ? "Este saque já foi pedido. Confira em Saques antes de pedir de novo."
            : "Não foi possível conferir o saque agora. Tente de novo em instantes.",
      };
    }
    const sameClaim = await claimOnce(sameKey, SAME_TRANSFER_WINDOW_SECONDS);
    if (sameClaim !== "claimed") {
      return {
        success: false,
        error:
          sameClaim === "taken"
            ? "Um saque igual acabou de ser pedido. Confira em Saques antes de pedir de novo."
            : "Não foi possível conferir o saque agora. Tente de novo em instantes.",
      };
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
          needsConfirmation: awaitsConfirmation(res),
        };
      } catch (err: unknown) {
        logError("[requestSubaccountTransferAction] Erro no Asaas:", err);
        // Recusado: libera o mesmo valor para tentar de novo (a tela gera outro id).
        await resetRateLimit(sameKey);
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
  });
}

export interface SubaccountTransferItem {
  id: string;
  dateCreated: string;
  valueCents: number;
  status: string;
  /** Esperando a confirmacao por codigo no Asaas (valor ja reservado). */
  needsConfirmation: boolean;
  receiptUrl?: string;
}

/** Saque criado e ainda sem a confirmacao por codigo no Asaas. */
function awaitsConfirmation(t: { status: string; authorized?: boolean }): boolean {
  return t.status === "PENDING" && t.authorized === false;
}

/**
 * Lista as transferências realizadas na subconta.
 */
export async function listSubaccountTransfersAction(
  organizationId: string,
): Promise<SubaccountTransferItem[]> {
  return withErrorScope(async () => {
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
          needsConfirmation: awaitsConfirmation(t),
          receiptUrl: t.transactionReceiptUrl,
        }));
      } catch (err) {
        logError("[listSubaccountTransfersAction] Erro no Asaas:", err);
      }
    }

    return [];
  });
}
