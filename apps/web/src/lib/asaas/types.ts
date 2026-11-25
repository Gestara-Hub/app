/**
 * Tipagens da API Asaas v3.
 * Referência: https://docs.asaas.com/
 */

export interface AsaasAccountRequest {
  name: string;
  email: string;
  cpfCnpj: string;
  /** Data de nascimento (so pessoa fisica), AAAA-MM-DD. */
  birthDate?: string;
  companyType?: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string; // Bairro
  postalCode?: string; // CEP
  incomeValue?: number; // Faturamento mensal estimado
}

export interface AsaasAccountResponse {
  object: "account";
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  /** Formato antigo: chave no topo. O atual vem em `accessToken.apiKey`. */
  apiKey?: string;
  accessToken?: { apiKey?: string };
  walletId: string;
  accountNumber?: {
    agency: string;
    account: string;
    accountDigit: string;
  };
}

export interface AsaasCustomerRequest {
  name: string;
  cpfCnpj?: string;
  email?: string;
  mobilePhone?: string;
  phone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  /** Bairro. */
  province?: string;
  postalCode?: string;
  externalReference?: string;
  /** true: o Asaas nao manda e-mail, SMS nem WhatsApp ao pagador (cobrados da conta). */
  notificationDisabled?: boolean;
}

export interface AsaasCustomerResponse {
  object: "customer";
  id: string;
  name: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
  externalReference?: string;
}

export interface AsaasSplitSetting {
  walletId: string;
  fixedValue?: number;
  percentualValue?: number;
}

export interface AsaasSubscriptionRequest {
  customer: string;
  billingType: "PIX" | "CREDIT_CARD" | "BOLETO" | "UNDEFINED";
  value: number;
  nextDueDate: string;
  cycle: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "YEARLY";
  description?: string;
  /** Espaco e plano da assinatura (lib/subscription, encodeSubscriptionReference). */
  externalReference?: string;
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo?: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode?: string;
    addressNumber?: string;
    phone?: string;
    mobilePhone?: string;
  };
}

export interface AsaasSubscriptionResponse {
  object: "subscription";
  id: string;
  dateCreated: string;
  customer: string;
  value: number;
  nextDueDate: string;
  cycle: string;
  description?: string;
  billingType: "PIX" | "CREDIT_CARD" | "BOLETO" | "UNDEFINED";
  status: "ACTIVE" | "EXPIRED" | "INACTIVE";
  deleted?: boolean;
  externalReference?: string;
}

export interface AsaasPaymentRequest {
  customer: string; // Asaas customer ID (cus_...)
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";
  value: number; // Valor em reais (ex: 150.00)
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string; // ID da cobrança no GestaraHub
  split?: AsaasSplitSetting[];
}

export interface AsaasPaymentResponse {
  object: "payment";
  id: string; // pay_...
  customer: string;
  value: number;
  netValue?: number;
  /** Dia previsto em que o valor fica disponivel (cartao: cerca de 32 dias). */
  estimatedCreditDate?: string | null;
  /** Dia em que o valor ficou disponivel (PAYMENT_RECEIVED). */
  creditDate?: string | null;
  /** Comprovante publico do pagamento no Asaas. */
  transactionReceiptUrl?: string | null;
  originalValue?: number;
  interestValue?: number;
  description?: string;
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";
  status:
    | "PENDING"
    | "RECEIVED"
    | "CONFIRMED"
    | "OVERDUE"
    | "REFUNDED"
    | "RECEIVED_IN_CASH"
    | "REFUND_REQUESTED"
    | "CHARGEBACK_REQUESTED"
    | "CHARGEBACK_DISPUTE"
    | "AWAITING_CHARGEBACK_REVERSAL"
    | "DUNNING_REQUESTED"
    | "DUNNING_RECEIVED"
    | "AWAITING_RISK_ANALYSIS";
  dueDate: string;
  originalDueDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  externalReference?: string;
  /** Assinatura que gerou a cobranca (sub_...). */
  subscription?: string;
  deleted?: boolean;
}

export interface AsaasPixQrCodeResponse {
  encodedImage: string; // Base64 da imagem PNG do QR Code
  payload: string; // Código Pix Copia e Cola
  expirationDate: string;
}

export interface AsaasWebhookPayload {
  event:
    | `ACCOUNT_STATUS_${string}`
    | "PAYMENT_CREATED"
    | "PAYMENT_AWAITING_RISK_ANALYSIS"
    | "PAYMENT_APPROVED_BY_RISK_ANALYSIS"
    | "PAYMENT_REPROVED_BY_RISK_ANALYSIS"
    | "PAYMENT_UPDATED"
    | "PAYMENT_CONFIRMED"
    | "PAYMENT_RECEIVED"
    | "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"
    | "PAYMENT_ANTICIPATED"
    | "PAYMENT_OVERDUE"
    | "PAYMENT_DELETED"
    | "PAYMENT_RESTORED"
    | "PAYMENT_REFUNDED"
    | "PAYMENT_PARTIALLY_REFUNDED"
    | "PAYMENT_REFUND_IN_PROGRESS"
    | "PAYMENT_RECEIVED_IN_CASH_UNDONE"
    | "PAYMENT_CHARGEBACK_REQUESTED"
    | "PAYMENT_CHARGEBACK_DISPUTE"
    | "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
    | "PAYMENT_DUNNING_RECEIVED"
    | "PAYMENT_DUNNING_REQUESTED"
    | "PAYMENT_BANK_SLIP_VIEWED"
    | "PAYMENT_CHECKOUT_VIEWED"
    | "SUBSCRIPTION_CREATED"
    | "SUBSCRIPTION_UPDATED"
    | "SUBSCRIPTION_INACTIVATED"
    | "SUBSCRIPTION_DELETED"
    | "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CREATED"
    | "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED"
    | "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED"
    | "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_EXPIRED"
    | "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_REFUSED"
    | "INVOICE_CREATED"
    | "INVOICE_UPDATED"
    | "INVOICE_SYNCHRONIZED"
    | "INVOICE_AUTHORIZED"
    | "INVOICE_PROCESSING_CANCELLATION"
    | "INVOICE_CANCELED"
    | "INVOICE_CANCELLATION_DENIED"
    | "INVOICE_ERROR";
  /** Eventos de cobranca (PAYMENT_*). */
  payment?: AsaasPaymentResponse;
  /** Eventos de assinatura (SUBSCRIPTION_*). */
  subscription?: AsaasSubscriptionResponse;
  /** Eventos de autorizacao do Pix Automatico (PIX_AUTOMATIC_RECURRING_AUTHORIZATION_*). */
  authorization?: AsaasPixAutomaticAuthorization;
  /** Eventos de nota fiscal (INVOICE_*). */
  invoice?: Pick<AsaasInvoiceResponse, "id" | "status" | "payment">;
  /** Avisos ACCOUNT_STATUS_* da subconta: a conta e a situacao cadastral atual. */
  account?: { id: string; ownerId?: string | null };
  accountStatus?: {
    general?: string;
    documentation?: string;
    commercialInfo?: string;
    bankAccountInfo?: string;
  };
}

/** Autorizacao de Pix Automatico (oferta na assinatura com Pix, Jornada 4). */
export interface AsaasPixAutomaticAuthorization {
  id: string;
  status: "CREATED" | "ACTIVE" | "CANCELLED" | "EXPIRED" | "REFUSED";
  customerId?: string;
  subscriptionId?: string | null;
  cancellationReason?: string | null;
}

/** Atualizacao da assinatura (PUT /subscriptions/{id}). */
export interface AsaasSubscriptionUpdate {
  value?: number;
  cycle?: AsaasSubscriptionRequest["cycle"];
  nextDueDate?: string;
  description?: string;
  externalReference?: string;
  /** Atualiza tambem as cobrancas pendentes ja geradas. */
  updatePendingPayments?: boolean;
}

export interface AsaasBalanceResponse {
  balance: number;
  reservedBalance?: number;
}

export interface AsaasTransferRequest {
  value: number;
  operationType: "PIX" | "TED";
  pixAddressKey?: string;
  pixAddressKeyType?: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
  description?: string;
}

export interface AsaasTransferResponse {
  object: "transfer";
  id: string;
  type: string;
  status: "PENDING" | "BANK_PROCESSING" | "DONE" | "CANCELLED" | "FAILED";
  dateCreated: string;
  value: number;
  netValue: number;
  transferFee: number;
  effectiveDate?: string;
  scheduleDate?: string;
  /** `false` enquanto espera a confirmacao por codigo (evento critico do Asaas). */
  authorized?: boolean;
  transactionReceiptUrl?: string;
}

/** Webhook de uma conta (principal ou subconta): POST/PUT /v3/webhooks. */
export interface AsaasWebhookConfig {
  name: string;
  url: string;
  email: string; // obrigatorio no Asaas
  enabled: boolean;
  interrupted: boolean;
  apiVersion: 3;
  authToken: string;
  sendType: "SEQUENTIALLY" | "NON_SEQUENTIALLY";
  events: string[];
}

export interface AsaasWebhookResponse extends Omit<AsaasWebhookConfig, "authToken"> {
  id: string;
}

/** Impostos da NFS-e. No Simples Nacional, so o ISS; os demais vao zerados. */
export interface AsaasInvoiceTaxes {
  retainIss: boolean;
  iss: number;
  pis: number;
  cofins: number;
  csll: number;
  inss: number;
  ir: number;
  /** Codigo de Tributacao Nacional (Portal Nacional da NFS-e). */
  federalServiceTaxCode?: string;
  nbsCode?: string;
}

/** Servico da nota: o id do cadastro no Asaas ou o par codigo + nome. */
export interface AsaasInvoiceService {
  municipalServiceId?: string;
  municipalServiceCode?: string;
  municipalServiceName: string;
}

/** POST /v3/invoices (nota de uma cobranca). */
export interface AsaasCreateInvoiceRequest extends AsaasInvoiceService {
  payment: string;
  serviceDescription: string;
  observations: string;
  value: number;
  deductions: number;
  effectiveDate: string;
  externalReference?: string;
  taxes: AsaasInvoiceTaxes;
}

export type AsaasInvoiceStatus =
  | "SCHEDULED"
  | "SYNCHRONIZED"
  | "AUTHORIZED"
  | "PROCESSING_CANCELLATION"
  | "CANCELED"
  | "CANCELLATION_DENIED"
  | "ERROR";

export interface AsaasInvoiceResponse {
  id: string; // inv_...
  status: AsaasInvoiceStatus;
  customer?: string;
  payment?: string | null;
  value: number;
  effectiveDate?: string;
  serviceDescription?: string;
  number?: string | null;
  validationCode?: string | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  statusDescription?: string | null;
  externalReference?: string | null;
}
