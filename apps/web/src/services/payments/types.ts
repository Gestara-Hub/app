import type {
  Address,
  DateTimeISO,
  Id,
  RecurringAuthorization,
} from "@gestarahub/contracts";

export interface PixPayment {
  /** Id do pagamento no provedor de gateway (txid / id). */
  providerId: string;
  pixCopyPaste: string;
  expiresAt: DateTimeISO;
  splitAmountCents?: number;
  /** Quem gerou de fato: "asaas" ou "mock" (demonstracao). */
  provider?: string;
  /** Preenchido quando caiu na demonstracao: o motivo, para a tela e o log. */
  fallbackReason?: string;
}

/**
 * O parceiro criou a cobranca, mas ainda nao entrega o QR do Pix: conta de
 * recebimento recem-ativada, com a chave Pix ainda sendo cadastrada (achado 56).
 * A cobranca ja foi cancelada no parceiro; basta tentar de novo em minutos.
 */
export const PIX_NOT_READY = "pix_not_ready";
export const PIX_NOT_READY_MESSAGE = "A conta ainda está liberando o Pix. Tente de novo em alguns minutos.";

/** Conta ainda em analise no Asaas: o Pix so libera com a aprovacao (25/11/2026). */
export const PIX_ACCOUNT_PENDING_MESSAGE =
  "O Pix libera quando o Asaas aprovar a sua conta de recebimento. Veja o que falta em Recebimentos online.";

export class PixNotReadyError extends Error {
  readonly reason = PIX_NOT_READY;
  constructor(message: string = PIX_NOT_READY_MESSAGE) {
    super(message);
    this.name = "PixNotReadyError";
  }
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
  /** Endereco do cadastro do aluno: preenche o checkout do parceiro. */
  studentAddress?: Address;
  subaccountApiKey?: string;
  splitAmountCents?: number;
  chargeDueDate?: string;
  competence?: string;
  planName?: string;
  chargeKind?: string;
  description?: string;
}

export interface CreateLinkInput {
  /** Forma da fatura no Asaas: cartao (padrao), boleto ou o aluno escolhe. */
  billingType?: "CREDIT_CARD" | "BOLETO" | "UNDEFINED";
  chargeId: Id;
  amountCents: number;
  expiresInMinutes: number;
  merchantName?: string;
  studentId?: Id;
  studentName?: string;
  studentPhone?: string;
  studentCpf?: string;
  studentEmail?: string;
  /** Endereco do cadastro do aluno: preenche o checkout do parceiro. */
  studentAddress?: Address;
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
