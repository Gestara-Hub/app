"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  PIX_ACCOUNT_PENDING_MESSAGE,
  PIX_NOT_READY,
  PixNotReadyError,
  type CreateLinkInput,
  type CreatePixInput,
  type PaymentLinkPayment,
  type PixPayment,
} from "../payments/types";
import { getPaymentGateway } from "../payments/registry";
import { effectivePlatformSplitCents } from "../payments/platformSplit";
import { requireTenant } from "../server/tenant";
import { logError, logWarn, withErrorScope } from "@/lib/log";

/**
 * Gera o Pix ou o link de pagamento de uma cobranca no gateway ativo.
 *
 * Como actions, o navegador tambem chama estas funcoes direto, com o que quiser
 * (auditoria de 30/10/2026). Por isso so vale o que o servidor confere: permissao
 * de cobrar, cobranca do proprio espaco e em aberto, valor nunca abaixo do dela,
 * chave da subconta e taxa do GestaraHub lidas aqui (as do pedido sao ignoradas) e
 * nada na conta principal do GestaraHub. A demonstracao (cobranca fora do banco)
 * so usa o provedor de demonstracao.
 */
type Checked<T> = { input: T } | { error: string; reason?: string };

async function checkedInput<T extends CreatePixInput | CreateLinkInput>(
  input: T,
  realGateway: boolean,
  options: { pix?: boolean } = {},
): Promise<Checked<T>> {
  const ctx = await requireTenant();
  ctx.require("billing:manage");
  const admin = createSupabaseAdminClient();
  const { data: charge } = input.chargeId
    ? await admin
        .from("charges")
        .select("organization_id, status, amount_cents, due_date, competence, kind, description")
        .eq("id", input.chargeId)
        .maybeSingle()
    : { data: null };

  if (!charge) {
    // Demonstracao: a cobranca vive so no navegador; nunca no parceiro de verdade.
    return realGateway ? { error: "Cobrança não encontrada." } : { input: { ...input, subaccountApiKey: undefined } };
  }
  if (charge.organization_id !== ctx.organizationId) return { error: "Cobrança de outro espaço." };
  if (charge.status !== "pending" && charge.status !== "overdue") return { error: "Esta cobrança não está em aberto." };
  if (!Number.isInteger(input.amountCents) || input.amountCents < Number(charge.amount_cents)) {
    return { error: "O valor não pode ser menor que o da cobrança." };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("gateway_api_key, subscription, settings")
    .eq("id", ctx.organizationId)
    .maybeSingle();
  // Conta ainda em analise no Asaas (25/11/2026): o Asaas recusa a chave Pix ate a
  // aprovacao. Avisa antes de criar a cobranca la (que seria criada e apagada).
  // Sem leitura nenhuma (conta antiga), segue como antes.
  const asaasGeneral = (org?.settings as { onlinePayments?: { asaasStatus?: { general?: string } } } | null)?.onlinePayments
    ?.asaasStatus?.general;
  if (options.pix && realGateway && asaasGeneral && asaasGeneral !== "APPROVED") {
    return { error: PIX_ACCOUNT_PENDING_MESSAGE, reason: PIX_NOT_READY };
  }
  const tier = (org?.subscription as { tier?: "free" | "pro" | "scale" } | null)?.tier;
  const subaccountApiKey = (org?.gateway_api_key as string | null) ?? undefined;
  if (realGateway && !subaccountApiKey) return { error: "Ative a conta de recebimento em Recebimentos online." };
  return {
    input: {
      ...input,
      subaccountApiKey,
      splitAmountCents: effectivePlatformSplitCents(tier),
      chargeDueDate: input.chargeDueDate || (charge.due_date as string),
      competence: input.competence || (charge.competence as string | undefined),
      chargeKind: input.chargeKind || (charge.kind as string),
      description: input.description || ((charge.description as string | null) ?? undefined),
    },
  };
}

/** Pix da cobranca no gateway ativo, com a subconta e a taxa conferidas no servidor. */
export async function createOnlinePixPaymentAction(
  input: CreatePixInput,
  provider?: string,
): Promise<PixPayment | { error: string; reason?: string }> {
  return withErrorScope(async () => {
    try {
      const gateway = getPaymentGateway(provider);
      const checked = await checkedInput(input, gateway.provider !== "mock", { pix: true });
      if ("error" in checked) return checked;
      const result = await gateway.createPix(checked.input);
      if (gateway.provider === "mock") {
        return {
          ...result,
          provider: "mock",
          fallbackReason: process.env.ASAAS_API_KEY
            ? "Provedor de demonstração selecionado no servidor."
            : "ASAAS_API_KEY não configurada no servidor.",
        };
      }
      return { ...result, provider: gateway.provider };
    } catch (error) {
      // Conta recem-ativada sem chave Pix: esperado nos primeiros minutos.
      if (error instanceof PixNotReadyError) {
        logWarn("[createOnlinePixPaymentAction] Pix ainda não liberado na conta de recebimento.");
        return { error: error.message, reason: error.reason };
      }
      const message = error instanceof Error ? error.message : String(error);
      logError("[createOnlinePixPaymentAction] Erro ao gerar Pix no gateway:", error);
      return { error: message };
    }
  });
}

/** Link de pagamento da cobranca no gateway ativo, com a subconta e a taxa conferidas no servidor. */
export async function createOnlineLinkPaymentAction(
  input: CreateLinkInput,
  provider?: string,
): Promise<PaymentLinkPayment | { error: string }> {
  return withErrorScope(async () => {
    try {
      const gateway = getPaymentGateway(provider);
      const checked = await checkedInput(input, gateway.provider !== "mock");
      if ("error" in checked) return checked;
      const result = await gateway.createLink(checked.input);
      if (gateway.provider === "mock") {
        return {
          ...result,
          provider: "mock",
          fallbackReason: process.env.ASAAS_API_KEY
            ? "Provedor de demonstração selecionado no servidor."
            : "ASAAS_API_KEY não configurada no servidor.",
        };
      }
      return { ...result, provider: gateway.provider };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError("[createOnlineLinkPaymentAction] Erro ao gerar Link no gateway:", error);
      return { error: message };
    }
  });
}
