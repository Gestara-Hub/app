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
import { logError } from "@/lib/log";

export * from "./types";
export { mockPaymentGateway } from "./adapters/mockAdapter";

/**
 * Gateway de pagamento unificado (Facade agnóstica).
 * Aciona o backend via Server Action para o gateway de pagamento configurado (Asaas, PagBank, etc.).
 * Em caso de falha de conexão ou ausência de credenciais, realiza fallback automático para o mock.
 */
export const paymentGateway: PaymentGateway = {
  provider: "facade",

  async createPix(input: CreatePixInput): Promise<PixPayment> {
    let fallbackReason = "O servidor não respondeu.";
    try {
      const result = await createOnlinePixPaymentAction(input);
      if (!("error" in result)) return result;
      fallbackReason = result.error;
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
    }
    logError("[PaymentGateway] Pix caiu na demonstração:", fallbackReason);
    return { ...(await mockPaymentGateway.createPix(input)), provider: "mock", fallbackReason };
  },

  async createLink(input: CreateLinkInput): Promise<PaymentLinkPayment> {
    let fallbackReason = "O servidor não respondeu.";
    try {
      const result = await createOnlineLinkPaymentAction(input);
      if (!("error" in result)) return result;
      fallbackReason = result.error;
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
    }
    logError("[PaymentGateway] link caiu na demonstração:", fallbackReason);
    return { ...(await mockPaymentGateway.createLink(input)), provider: "mock", fallbackReason };
  },

  async requestRecurringAuthorization(input: {
    studentId: string;
    maxAmountCents: number;
  }): Promise<GatewayRecurringAuthorization> {
    return mockPaymentGateway.requestRecurringAuthorization(input);
  },
};
