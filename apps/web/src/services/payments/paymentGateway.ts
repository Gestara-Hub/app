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
} from "../onlinePaymentsBackend";

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
    try {
      const realPayment = await createOnlinePixPaymentAction(input);
      if (realPayment) {
        return realPayment;
      }
    } catch (err) {
      console.error(
        "[PaymentGateway] Falha ao processar Pix no gateway ativo, fallback para mock:",
        err,
      );
    }
    return mockPaymentGateway.createPix(input);
  },

  async createLink(input: CreateLinkInput): Promise<PaymentLinkPayment> {
    try {
      const realPayment = await createOnlineLinkPaymentAction(input);
      if (realPayment) {
        return realPayment;
      }
    } catch (err) {
      console.error(
        "[PaymentGateway] Falha ao processar link no gateway ativo, fallback para mock:",
        err,
      );
    }
    return mockPaymentGateway.createLink(input);
  },

  async requestRecurringAuthorization(input: {
    studentId: string;
    maxAmountCents: number;
  }): Promise<GatewayRecurringAuthorization> {
    return mockPaymentGateway.requestRecurringAuthorization(input);
  },
};
