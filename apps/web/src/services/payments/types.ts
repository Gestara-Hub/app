import type {
  DateTimeISO,
  Id,
  RecurringAuthorization,
} from "@gestarahub/contracts";

export interface PixPayment {
  /** Id do pagamento no provedor de gateway (txid / id). */
  providerId: string;
  pixCopyPaste: string;
  pixQrCodeBase64?: string;
  expiresAt: DateTimeISO;
  splitAmountCents?: number;
  /** Quem gerou de fato: "asaas" ou "mock" (demonstracao). */
  provider?: string;
  /** Preenchido quando caiu na demonstracao: o motivo, para a tela e o log. */
  fallbackReason?: string;
}

export interface PaymentLinkPayment {
  /** Id do pagamento no provedor de gateway. */
  providerId: string;
  linkUrl: string;
  expiresAt: DateTimeISO;
  splitAmountCents?: number;
  provider?: string;
  fallbackReason?: string;
}

/** Autorização do Pix Automático devolvida pelo provedor (sem escopo do tenant). */
export type GatewayRecurringAuthorization = Omit<
  RecurringAuthorization,
  "organizationId"
>;

export interface CreatePixInput {
  chargeId: Id;
  amountCents: number;
  expiresInMinutes: number;
  /** Chave Pix da academia (simulada) e nome exibido no pagamento. */
  pixKey?: string;
  merchantName?: string;
  studentId?: Id;
  studentName?: string;
  studentPhone?: string;
  studentCpf?: string;
  studentEmail?: string;
  subaccountApiKey?: string;
  splitAmountCents?: number;
  chargeDueDate?: string;
  competence?: string;
  planName?: string;
  chargeKind?: string;
  description?: string;
}

export interface CreateLinkInput {
  chargeId: Id;
  amountCents: number;
  expiresInMinutes: number;
  merchantName?: string;
  studentId?: Id;
  studentName?: string;
  studentPhone?: string;
  studentCpf?: string;
  studentEmail?: string;
  subaccountApiKey?: string;
  splitAmountCents?: number;
  chargeDueDate?: string;
  competence?: string;
  planName?: string;
  chargeKind?: string;
  description?: string;
}

/**
 * Contrato agnóstico de Gateway de Pagamento (Hexagonal Architecture / Port).
 * Qualquer provedor (Asaas, PagBank, Mercado Pago, Iugu, etc.) implementa este contrato.
 */
export interface PaymentGateway {
  readonly provider: string;
  createPix(input: CreatePixInput): Promise<PixPayment>;
  createLink(input: CreateLinkInput): Promise<PaymentLinkPayment>;
  requestRecurringAuthorization(input: {
    studentId: Id;
    maxAmountCents: number;
  }): Promise<GatewayRecurringAuthorization>;
}
