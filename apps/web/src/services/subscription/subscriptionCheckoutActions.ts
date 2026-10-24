"use server";

import {
  AsaasApiError,
  asaasToday,
  cancelSubscription,
  createOrFindCustomer,
  createSubscription,
  getAsaasConfig,
  getPixQrCode,
  getSubscriptionPayments,
  notAfterAsaasToday,
  receiveInCash,
} from "@/lib/asaas";
import { dateInSpace } from "@gestarahub/core/date";
import { addPlanCycle } from "@gestarahub/core/subscription-plan";
import type { Subscription } from "@gestarahub/contracts";
import { SUBSCRIPTION_PRICES } from "@/config/subscription";
import { brazilNationalDigits } from "@gestarahub/core/phone";
import { serverPaymentsTestMode } from "@/lib/payments-test-mode";
import { encodeSubscriptionReference } from "@/lib/subscription";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  confirmSubscriptionPayment,
  readOrganizationSubscription,
  writeOrganizationSubscription,
  type SubscriptionPaymentCheck,
} from "../server/subscription";
import { requireSameOrganization, requireTenant } from "../server/tenant";
import { logError } from "@/lib/log";

/**
 * Pagamento do plano no Asaas: gerar o checkout, conferir e simular o pago.
 * O plano pago e gravado so aqui, no servidor, depois do pagamento (achado 66
 * do teste de 23/10). Sem chave do Asaas, o checkout simulado so roda fora de
 * producao.
 */

const mockCheckoutAllowed = () => process.env.NODE_ENV !== "production";

export interface CreateSubscriptionInput {
  organizationId: string;
  tier: "pro" | "scale";
  interval: "monthly" | "yearly";
  billingType: "PIX" | "CREDIT_CARD";
  customer: {
    name: string;
    email: string;
    cpfCnpj: string;
    phone?: string;
  };
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
}

export interface SubscriptionCheckoutResult {
  success: boolean;
  subscriptionId: string;
  customerId: string;
  paymentId?: string;
  billingType: "PIX" | "CREDIT_CARD";
  status: "active" | "pending";
  value: number;
  pixQrCode?: {
    encodedImage: string;
    payload: string;
    expirationDate: string;
  };
  error?: string;
  /** Plano gravado quando o pagamento ja foi aprovado (cartao). */
  subscription?: Subscription;
}

/**
 * Cria uma assinatura no Asaas (Master Account do GestaraHub) para a organização pagadora.
 */
export async function createAsaasSubscriptionCheckoutAction(
  input: CreateSubscriptionInput,
): Promise<SubscriptionCheckoutResult> {
  await requireSameOrganization(input.organizationId, { permissions: ["subscription:manage"] });
  const priceConfig = SUBSCRIPTION_PRICES[input.tier][input.interval];
  const config = getAsaasConfig();

  // Modo Simulado se não houver chave Master real
  if (!config.masterApiKey) {
    if (!mockCheckoutAllowed()) {
      return {
        success: false,
        subscriptionId: "",
        customerId: "",
        billingType: input.billingType,
        status: "pending",
        value: priceConfig.value,
        error: "O pagamento do plano está indisponível no momento.",
      };
    }
    const mockSubId = `sub_mock_${Date.now()}`;
    const mockPayId = `pay_mock_${Date.now()}`;

    if (input.billingType === "CREDIT_CARD") {
      const subscription: Subscription = {
        tier: input.tier,
        interval: input.interval,
        status: "active",
        paymentMethod: "credit_card",
        priceCents: priceConfig.priceCents,
        asaasSubscriptionId: mockSubId,
        asaasCustomerId: "cus_mock_local",
        renewsOn: addPlanCycle(asaasToday(), input.interval),
        changedAt: new Date().toISOString(),
      };
      await writeOrganizationSubscription(createSupabaseAdminClient(), input.organizationId, subscription);

      return {
        success: true,
        subscriptionId: mockSubId,
        customerId: "cus_mock_local",
        billingType: "CREDIT_CARD",
        status: "active",
        value: priceConfig.value,
        subscription,
      };
    }

    return {
      success: true,
      subscriptionId: mockSubId,
      customerId: "cus_mock_local",
      paymentId: mockPayId,
      billingType: "PIX",
      status: "pending",
      value: priceConfig.value,
      pixQrCode: {
        encodedImage:
          "iVBORw0KGgoAAAANSUhEUgAAAcIAAAHCAQAAAABUY/ToAAADFElEQVR4Xu2UQbLbMAxDs/P9b9RjeecaD6SctNNRp5syM2DyZRHEQxaS/+v6x/rx+lX52wq5q5C7CrmrkLsKuav/Rp4v6kC5m+O8t+ehz9Pe41t4nCHnkjC2yrF86jDXhozyhxxMlsoXtlAgpo5bzpBfQMJ0L6UWkio65PeQMrxtu3ry4Qw5mbysynHAaK2koxb6coYcTa4T337KGfKPnwHkKgY+eZ8396JP39egK+RYsgF58PpWoGrqhUB/Qo4mL3dl0Uq1isDQ9yHkcFIqgsd2Q3hTpDO0kRByLNlnjl6vs8feSPS8dqqQc0kDBV116I9feF+EFRpyMFkGzYBMnJDSQEx5GnIwiRkK4lxXQr71LEaJEkPOJSWj48Fupp5Y3fUPhBxNNu8dV4FVeU7UhzFCyMHkYstOU/2Kq2iy1IWcS3LIp5CyfbTsWMWIlyfkWFI+tHppa3GeH0VyT5weci5JoxGQ/DKwFuEEEfaFHEyCgi1ImibydX8qZk1CDif7pV1bP7ALWyajIQeTCMvCUKseYrGUEnI86Tme09dBoFdJAK13VsjBZP+xlsEAEWw6wmDIwSRy/19maUVPhXixwK+EHExKQ2mMVUmk4dRSfyHHkzhlwl6ENWWSQ7hnISeTdcJwt0qQVneleN7TkIPJ045FleV3UDrzkJNJ4L4MTNVJU/dMnkfIyaR2fRGIkV9YbWmrJy3kbFKDmrMzzred1fo2aB5yLGm9YLlMt6dW5rcDPuRgUpwaVMZYyug0D8njt0LOJS98ntgABqCGqcrBTgo5mbR0eHv4xCXVZXj6moYcTl592raj1uXAzNgkWsjJpDy92sa5O0aq3Y4JOZx8B2kN+17Qcgs+L0rIsWRX+XXU2ipNinzqrAiVOeRYEv+Lsy5Zc5+5094e5IUcTdrNDSieJGf2FdCMTJlDjiZxg0mnd1VbiShqQ34H6Xnzl1bTlBN1YUJ+B6lvmbwY532u0enckJPJd8l7myVJ7VS3+ELOJV+URoaODycxvOAg9a6HHEv+U4XcVchdhdxVyF2F3NWXkT8BJ/TIZEYhdiAAAAAASUVORK5CYII=",
        payload:
          "00020101021226820014br.gov.bcb.pix2560pix-h.asaas.com/qr/cobv/simuladogestarahub5204000053039865802BR5925GESTARAHUB ASSINATURA6009Sao Paulo62070503***6304E8A1",
        expirationDate: new Date(Date.now() + 86400000).toISOString(),
      },
    };
  }

  try {
    // Uma assinatura por espaco (doc product/13 §6): plano pago troca pela
    // troca de plano; a que ficou de quem voltou ao Gratis sai do Asaas antes.
    const admin = createSupabaseAdminClient();
    const previous = await readOrganizationSubscription(admin, input.organizationId);
    if (previous && previous.tier !== "free") {
      return {
        success: false,
        subscriptionId: "",
        customerId: "",
        billingType: input.billingType,
        status: "pending",
        value: priceConfig.value,
        error: "Você já tem um plano pago. Troque de plano em Planos.",
      };
    }
    if (previous?.asaasSubscriptionId && !previous.asaasSubscriptionId.startsWith("sub_mock_")) {
      await cancelSubscription(previous.asaasSubscriptionId).catch((error: unknown) => {
        if (!(error instanceof AsaasApiError && error.status === 404)) throw error;
      });
    }

    // 1. Cria ou localiza o cliente da plataforma GestaraHub no Asaas
    const customer = await createOrFindCustomer({
      name: input.customer.name,
      email: input.customer.email,
      cpfCnpj: input.customer.cpfCnpj,
      mobilePhone: brazilNationalDigits(input.customer.phone),
      externalReference: input.organizationId,
    });

    // Primeiro vencimento: hoje, no calendario do Asaas.
    const todayIso = asaasToday();

    // 2. Prepara o payload da assinatura
    const subscriptionPayload = {
      customer: customer.id,
      billingType: input.billingType,
      value: priceConfig.value,
      nextDueDate: todayIso,
      cycle: (input.interval === "yearly" ? "YEARLY" : "MONTHLY") as "MONTHLY" | "YEARLY",
      description: priceConfig.description,
      externalReference: encodeSubscriptionReference(input.organizationId, input.tier, input.interval),
      creditCard: input.creditCard,
      creditCardHolderInfo: input.creditCard
        ? {
            name: input.creditCard.holderName,
            email: input.customer.email,
            cpfCnpj: input.customer.cpfCnpj,
            mobilePhone: brazilNationalDigits(input.customer.phone),
          }
        : undefined,
    };

    const asaasSub = await createSubscription(subscriptionPayload);

    // Se for Cartão de Crédito: o Asaas cobra ao criar; a assinatura so
    // nasce com o cartao aprovado (recusado da erro acima).
    if (input.billingType === "CREDIT_CARD") {
      const subscription: Subscription = {
        tier: input.tier,
        interval: input.interval,
        status: "active",
        paymentMethod: "credit_card",
        priceCents: priceConfig.priceCents,
        asaasSubscriptionId: asaasSub.id,
        asaasCustomerId: customer.id,
        renewsOn: addPlanCycle(asaasToday(), input.interval),
        changedAt: new Date().toISOString(),
      };
      await writeOrganizationSubscription(createSupabaseAdminClient(), input.organizationId, subscription);

      return {
        success: true,
        subscriptionId: asaasSub.id,
        customerId: customer.id,
        billingType: "CREDIT_CARD",
        status: "active",
        value: priceConfig.value,
        subscription,
      };
    }

    // Se for Pix: busca a cobrança gerada para obter o QR Code
    const paymentsRes = await getSubscriptionPayments(asaasSub.id);
    const firstPayment = paymentsRes.data?.[0];

    if (!firstPayment) {
      throw new Error("Cobrança inicial não encontrada na assinatura Asaas.");
    }

    const pixQr = await getPixQrCode(firstPayment.id);

    return {
      success: true,
      subscriptionId: asaasSub.id,
      customerId: customer.id,
      paymentId: firstPayment.id,
      billingType: "PIX",
      status: "pending",
      value: priceConfig.value,
      pixQrCode: {
        encodedImage: pixQr.encodedImage,
        payload: pixQr.payload,
        expirationDate: pixQr.expirationDate,
      },
    };
  } catch (err: unknown) {
    logError("[createAsaasSubscriptionCheckoutAction] Erro:", err);
    return {
      success: false,
      subscriptionId: "",
      customerId: "",
      billingType: input.billingType,
      status: "pending",
      value: priceConfig.value,
      error:
        err instanceof Error
          ? err.message
          : "Não foi possível gerar a assinatura no Asaas.",
    };
  }
}

/**
 * Confere o pagamento do plano no Asaas (polling do Pix) e, pago, ativa o
 * plano no servidor.
 */
export async function checkAsaasSubscriptionPaymentAction(
  paymentId: string,
): Promise<SubscriptionPaymentCheck> {
  const ctx = await requireTenant();
  ctx.require("subscription:manage");
  const config = getAsaasConfig();
  if (!config.masterApiKey || paymentId.startsWith("pay_mock_")) {
    return { status: "PENDING", isPaid: false };
  }

  try {
    return await confirmSubscriptionPayment(createSupabaseAdminClient(), ctx.organizationId, paymentId);
  } catch (err) {
    logError("[checkAsaasSubscriptionPaymentAction] Erro:", err);
    return { status: "ERROR", isPaid: false };
  }
}

/**
 * Simula o Pix pago no Asaas de testes (receiveInCash) e ativa o plano pela
 * mesma conferencia do pagamento real. Fora do sandbox e recusado. Sem chave
 * do Asaas (checkout simulado, so fora de producao) usa o plano escolhido.
 */
export async function simulateAsaasSubscriptionPaymentAction(
  paymentId: string,
  tier: "pro" | "scale",
  interval: "monthly" | "yearly",
  subscriptionId?: string,
): Promise<{ success: boolean; error?: string; subscription?: Subscription }> {
  const ctx = await requireTenant();
  ctx.require("subscription:manage");
  if (!serverPaymentsTestMode()) {
    return { success: false, error: "A simulação só funciona no ambiente de testes." };
  }
  const config = getAsaasConfig();
  const priceConfig = SUBSCRIPTION_PRICES[tier][interval];
  const admin = createSupabaseAdminClient();

  try {
    if (!config.masterApiKey || paymentId.startsWith("pay_mock_")) {
      if (!mockCheckoutAllowed()) return { success: false, error: "A simulação só funciona no ambiente de testes." };
      const subscription: Subscription = {
        tier,
        interval,
        status: "active",
        paymentMethod: "pix",
        priceCents: priceConfig.priceCents,
        asaasSubscriptionId: subscriptionId,
        renewsOn: addPlanCycle(asaasToday(), interval),
        changedAt: new Date().toISOString(),
      };
      await writeOrganizationSubscription(admin, ctx.organizationId, subscription);
      return { success: true, subscription };
    }

    await receiveInCash(paymentId, notAfterAsaasToday(dateInSpace()), priceConfig.value);
    const check = await confirmSubscriptionPayment(admin, ctx.organizationId, paymentId);
    return check.isPaid
      ? { success: true, subscription: check.subscription }
      : { success: false, error: "O Asaas ainda não confirmou o pagamento." };
  } catch (err) {
    logError("[simulateAsaasSubscriptionPaymentAction] Erro:", err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Erro ao simular liquidação.",
    };
  }
}
