import type {
  PaymentGateway,
  PixPayment,
  PaymentLinkPayment,
  GatewayRecurringAuthorization,
  CreatePixInput,
  CreateLinkInput,
} from "./types";
import { mockPaymentGateway } from "./adapters/mockAdapter";
import {
  createOnlinePixPaymentAction,
  createOnlineLinkPaymentAction,
} from "../onlinePayments/actions";
import { apiError } from "@gestarahub/core/api-error";
import { logError } from "@/lib/log";
import { PIX_NOT_READY, PIX_NOT_READY_MESSAGE } from "./types";

export * from "./types";
export { mockPaymentGateway } from "./adapters/mockAdapter";

/** Quem chama diz se pode cair na demonstracao (so o espaco de demonstracao e o e2e). */
export interface GatewayCallOptions {
  allowDemo?: boolean;
}

/**
 * Falha do parceiro: Pix ainda nao liberado vira a mensagem clara; conta real
 * nunca recebe codigo de demonstracao (achado 56), so a demonstracao cai nele.
 */
function failOrDemo(kind: "Pix" | "link", result: { error: string; reason?: string } | null, reason: string, options: GatewayCallOptions): void {
  if (result?.reason === PIX_NOT_READY) {
    throw apiError("CONFLICT", PIX_NOT_READY_MESSAGE, { httpStatus: 409 });
  }
  if (options.allowDemo === false) {
    throw apiError("NETWORK", `Não foi possível gerar ${kind === "Pix" ? "o Pix" : "o link"} no Asaas. ${reason}`.trim(), {
      httpStatus: 502,
    });
  }
  logError(`[PaymentGateway] ${kind} caiu na demonstração:`, reason);
}

/**
 * Gateway de pagamento unificado (Facade agnóstica).
 * Aciona o backend via Server Action para o gateway de pagamento configurado (Asaas, PagBank, etc.).
 * Sem resposta do parceiro, so a demonstracao cai no mock (`allowDemo`).
 */
export const paymentGateway = {
  provider: "facade",

  async createPix(input: CreatePixInput, options: GatewayCallOptions = {}): Promise<PixPayment> {
    let fallbackReason = "O servidor não respondeu.";
    let failed: { error: string; reason?: string } | null = null;
    try {
      const result = await createOnlinePixPaymentAction(input);
      if (!("error" in result)) return result;
      failed = result;
      fallbackReason = result.error;
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
    }
    failOrDemo("Pix", failed, fallbackReason, options);
    return { ...(await mockPaymentGateway.createPix(input)), provider: "mock", fallbackReason };
  },

  async createLink(input: CreateLinkInput, options: GatewayCallOptions = {}): Promise<PaymentLinkPayment> {
    let fallbackReason = "O servidor não respondeu.";
    try {
      const result = await createOnlineLinkPaymentAction(input);
      if (!("error" in result)) return result;
      fallbackReason = result.error;
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
    }
    failOrDemo("link", null, fallbackReason, options);
    return { ...(await mockPaymentGateway.createLink(input)), provider: "mock", fallbackReason };
  },

  async requestRecurringAuthorization(input: {
    studentId: string;
    maxAmountCents: number;
  }): Promise<GatewayRecurringAuthorization> {
    return mockPaymentGateway.requestRecurringAuthorization(input);
  },
} satisfies PaymentGateway;
