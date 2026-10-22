"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Subscription, SubscriptionTier } from "@gestarahub/contracts";
import {
  cancelSubscription,
  createOrFindCustomer,
  createSubscription,
  getAsaasConfig,
  getPayment,
  getPixQrCode,
  getSubscriptionPayments,
  receiveInCash,
} from "@/lib/asaas";
import { SUBSCRIPTION_PRICES } from "@/config/subscription";
import { requireSameOrganization } from "./server/tenant";

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
}

/**
 * Atualiza o plano de assinatura da organização no Supabase.
 * Suporta tanto o objeto Subscription completo quanto apenas o tier (retrocompatibilidade).
 */
export async function updateOrganizationSubscriptionAction(
  organizationId: string,
  subscriptionOrTier: SubscriptionTier | Subscription,
): Promise<boolean> {
  await requireSameOrganization(organizationId, { permissions: ["subscription:manage"] });
  try {
    const adminClient = createSupabaseAdminClient();
    const payload =
      typeof subscriptionOrTier === "string"
        ? {
            tier: subscriptionOrTier,
            changedAt: new Date().toISOString(),
          }
        : {
            ...subscriptionOrTier,
            changedAt: subscriptionOrTier.changedAt || new Date().toISOString(),
          };

    const { error } = await adminClient
      .from("organizations")
      .update({
        subscription: payload,
      })
      .eq("id", organizationId);

    if (error) {
      console.error("[updateOrganizationSubscriptionAction] Erro no Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[updateOrganizationSubscriptionAction] Exceção:", err);
    return false;
  }
}

/**
 * Cria uma assinatura no Asaas (Master Account do GestaraHub) para a organização pagadora.
 */
export async function createAsaasSubscriptionCheckoutAction(
  input: CreateSubscriptionInput,
): Promise<SubscriptionCheckoutResult> {
  const priceConfig = SUBSCRIPTION_PRICES[input.tier][input.interval];
  const config = getAsaasConfig();

  // Modo Simulado se não houver chave Master real
  if (!config.masterApiKey) {
    const mockSubId = `sub_mock_${Date.now()}`;
    const mockPayId = `pay_mock_${Date.now()}`;

    if (input.billingType === "CREDIT_CARD") {
      await updateOrganizationSubscriptionAction(input.organizationId, {
        tier: input.tier,
        interval: input.interval,
        status: "active",
        paymentMethod: "credit_card",
        priceCents: priceConfig.priceCents,
        asaasSubscriptionId: mockSubId,
        asaasCustomerId: "cus_mock_local",
        changedAt: new Date().toISOString(),
      });

      return {
        success: true,
        subscriptionId: mockSubId,
        customerId: "cus_mock_local",
        billingType: "CREDIT_CARD",
        status: "active",
        value: priceConfig.value,
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
    // 1. Cria ou localiza o cliente da plataforma GestaraHub no Asaas
    const customer = await createOrFindCustomer({
      name: input.customer.name,
      email: input.customer.email,
      cpfCnpj: input.customer.cpfCnpj,
      mobilePhone: input.customer.phone,
      externalReference: input.organizationId,
    });

    const todayIso = new Date().toISOString().split("T")[0];

    // 2. Prepara o payload da assinatura
    const subscriptionPayload = {
      customer: customer.id,
      billingType: input.billingType,
      value: priceConfig.value,
      nextDueDate: todayIso,
      cycle: (input.interval === "yearly" ? "YEARLY" : "MONTHLY") as "MONTHLY" | "YEARLY",
      description: priceConfig.description,
      creditCard: input.creditCard,
      creditCardHolderInfo: input.creditCard
        ? {
            name: input.creditCard.holderName,
            email: input.customer.email,
            cpfCnpj: input.customer.cpfCnpj,
            mobilePhone: input.customer.phone,
          }
        : undefined,
    };

    const asaasSub = await createSubscription(subscriptionPayload);

    // Se for Cartão de Crédito: ativação imediata
    if (input.billingType === "CREDIT_CARD") {
      await updateOrganizationSubscriptionAction(input.organizationId, {
        tier: input.tier,
        interval: input.interval,
        status: "active",
        paymentMethod: "credit_card",
        priceCents: priceConfig.priceCents,
        asaasSubscriptionId: asaasSub.id,
        asaasCustomerId: customer.id,
        nextDueDate: asaasSub.nextDueDate,
        changedAt: new Date().toISOString(),
      });

      return {
        success: true,
        subscriptionId: asaasSub.id,
        customerId: customer.id,
        billingType: "CREDIT_CARD",
        status: "active",
        value: priceConfig.value,
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
    console.error("[createAsaasSubscriptionCheckoutAction] Erro:", err);
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
 * Consulta o status de um pagamento específico de assinatura no Asaas.
 */
export async function checkAsaasSubscriptionPaymentAction(
  paymentId: string,
): Promise<{ status: string; isPaid: boolean }> {
  const config = getAsaasConfig();
  if (!config.masterApiKey || paymentId.startsWith("pay_mock_")) {
    return { status: "PENDING", isPaid: false };
  }

  try {
    const payment = await getPayment(paymentId);
    const isPaid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(
      payment.status,
    );
    return { status: payment.status, isPaid };
  } catch (err) {
    console.error("[checkAsaasSubscriptionPaymentAction] Erro:", err);
    return { status: "ERROR", isPaid: false };
  }
}

/**
 * Simula a liquidação do Pix no Asaas Sandbox (receiveInCash) e ativa o plano.
 */
export async function simulateAsaasSubscriptionPaymentAction(
  paymentId: string,
  organizationId: string,
  tier: "pro" | "scale",
  interval: "monthly" | "yearly",
  subscriptionId?: string,
): Promise<{ success: boolean; error?: string }> {
  const config = getAsaasConfig();
  const priceConfig = SUBSCRIPTION_PRICES[tier][interval];
  const todayIso = new Date().toISOString().split("T")[0];

  try {
    if (config.masterApiKey && !paymentId.startsWith("pay_mock_")) {
      try {
        await receiveInCash(paymentId, todayIso, priceConfig.value);
      } catch (asaasErr) {
        console.warn(
          "[simulateAsaasSubscriptionPaymentAction] Aviso no receiveInCash:",
          asaasErr,
        );
      }
    }

    await updateOrganizationSubscriptionAction(organizationId, {
      tier,
      interval,
      status: "active",
      paymentMethod: "pix",
      priceCents: priceConfig.priceCents,
      asaasSubscriptionId: subscriptionId,
      changedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    console.error("[simulateAsaasSubscriptionPaymentAction] Erro:", err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Erro ao simular liquidação.",
    };
  }
}

/**
 * Cancela a assinatura atual no Asaas caso exista.
 */
export async function cancelAsaasSubscriptionAction(
  subscriptionId: string,
): Promise<boolean> {
  const config = getAsaasConfig();
  if (!config.masterApiKey || subscriptionId.startsWith("sub_mock_")) {
    return true;
  }

  try {
    await cancelSubscription(subscriptionId);
    return true;
  } catch (err) {
    console.error("[cancelAsaasSubscriptionAction] Erro ao cancelar:", err);
    return false;
  }
}

