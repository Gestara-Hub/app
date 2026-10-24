"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  PixNotReadyError,
  type CreateLinkInput,
  type CreatePixInput,
  type PaymentLinkPayment,
  type PixPayment,
} from "../payments/types";
import { getPaymentGateway } from "../payments/registry";
import { requireTenant } from "../server/tenant";
import { logError, logWarn } from "@/lib/log";

/**
 * Gera o Pix ou o link de pagamento de uma cobranca no gateway ativo.
 */

/**
 * Server Action agnóstica para criação de Pix online via gateway ativo.
 * Recupera de forma segura a subconta da organização e aplica a taxa de split correta.
 */
export async function createOnlinePixPaymentAction(
  input: CreatePixInput,
  provider?: string,
): Promise<PixPayment | { error: string; reason?: string }> {
  const ctx = await requireTenant();
  try {
    let subaccountApiKey = input.subaccountApiKey;
    let splitAmountCents = input.splitAmountCents;
    let enrichedInput = { ...input };
    // A cobranca da demonstracao nao esta no banco; a consulta nao pode derrubar a chamada ao gateway.
    try {

    // Se subaccountApiKey não foi fornecida, busca do tenant no banco
    if (input.chargeId) {
      const adminClient = createSupabaseAdminClient();
      const { data: charge } = await adminClient
        .from("charges")
        .select("organization_id, due_date, competence, kind, description")
        .eq("id", input.chargeId)
        .maybeSingle();

      if (charge && charge.organization_id !== ctx.organizationId) {
        return { error: "Cobrança de outro espaço." };
      }
      if (charge) {
        enrichedInput = {
          ...enrichedInput,
          chargeDueDate: enrichedInput.chargeDueDate || charge.due_date,
          competence: enrichedInput.competence || charge.competence,
          chargeKind: enrichedInput.chargeKind || charge.kind,
          description: enrichedInput.description || charge.description,
        };
      }

      if (charge?.organization_id) {
        const { data: org } = await adminClient
          .from("organizations")
          .select("gateway_api_key, subscription")
          .eq("id", charge.organization_id)
          .maybeSingle();

        if (org?.gateway_api_key) {
          subaccountApiKey = org.gateway_api_key;
        }

        // Determina o valor do split com base no plano (Pro = R$ 1,29, Free = R$ 1,99)
        if (splitAmountCents === undefined) {
          const tier = (org?.subscription as Record<string, unknown>)?.tier;
          splitAmountCents = tier === "pro" || tier === "scale" ? 129 : 199;
        }
      }
    }

    } catch (lookupError) {
      logWarn("[createOnlinePixPaymentAction] Cobrança não encontrada no banco; segue com a chave principal:", lookupError);
    }

    const gateway = getPaymentGateway(provider);
    const result = await gateway.createPix({
      ...enrichedInput,
      subaccountApiKey,
      splitAmountCents: splitAmountCents ?? 199,
    });
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
}

/**
 * Server Action agnóstica para criação de link de pagamento via gateway ativo.
 */
export async function createOnlineLinkPaymentAction(
  input: CreateLinkInput,
  provider?: string,
): Promise<PaymentLinkPayment | { error: string }> {
  const ctx = await requireTenant();
  try {
    let subaccountApiKey = input.subaccountApiKey;
    let splitAmountCents = input.splitAmountCents;
    let enrichedInput = { ...input };
    // A cobranca da demonstracao nao esta no banco; a consulta nao pode derrubar a chamada ao gateway.
    try {

    if (input.chargeId) {
      const adminClient = createSupabaseAdminClient();
      const { data: charge } = await adminClient
        .from("charges")
        .select("organization_id, due_date, competence, kind, description")
        .eq("id", input.chargeId)
        .maybeSingle();

      if (charge && charge.organization_id !== ctx.organizationId) {
        return { error: "Cobrança de outro espaço." };
      }
      if (charge) {
        enrichedInput = {
          ...enrichedInput,
          chargeDueDate: enrichedInput.chargeDueDate || charge.due_date,
          competence: enrichedInput.competence || charge.competence,
          chargeKind: enrichedInput.chargeKind || charge.kind,
          description: enrichedInput.description || charge.description,
        };
      }

      if (charge?.organization_id) {
        const { data: org } = await adminClient
          .from("organizations")
          .select("gateway_api_key, subscription")
          .eq("id", charge.organization_id)
          .maybeSingle();

        if (org?.gateway_api_key) {
          subaccountApiKey = org.gateway_api_key;
        }

        // Determina o valor do split com base no plano (Pro = R$ 1,29, Free = R$ 1,99)
        if (splitAmountCents === undefined) {
          const tier = (org?.subscription as Record<string, unknown>)?.tier;
          splitAmountCents = tier === "pro" || tier === "scale" ? 129 : 199;
        }
      }
    }

    } catch (lookupError) {
      logWarn("[createOnlineLinkPaymentAction] Cobrança não encontrada no banco; segue com a chave principal:", lookupError);
    }

    const gateway = getPaymentGateway(provider);
    const result = await gateway.createLink({
      ...enrichedInput,
      subaccountApiKey,
      splitAmountCents: splitAmountCents ?? 199,
    });
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
}
