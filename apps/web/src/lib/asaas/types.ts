/**
 * Tipagens da API Asaas v3.
 * Referência: https://docs.asaas.com/
 */

export interface AsaasAccountRequest {
  name: string;
  email: string;
  cpfCnpj: string;
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
  apiKey: string;
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
  externalReference?: string;
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
  deleted?: boolean;
}

export interface AsaasPixQrCodeResponse {
  encodedImage: string; // Base64 da imagem PNG do QR Code
  payload: string; // Código Pix Copia e Cola
  expirationDate: string;
}

export interface AsaasWebhookPayload {
  event:
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
    | "PAYMENT_REFUND_IN_PROGRESS"
    | "PAYMENT_RECEIVED_IN_CASH_UNDONE"
    | "PAYMENT_CHARGEBACK_REQUESTED"
    | "PAYMENT_CHARGEBACK_DISPUTE"
    | "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
    | "PAYMENT_DUNNING_RECEIVED"
    | "PAYMENT_DUNNING_REQUESTED"
    | "PAYMENT_BANK_SLIP_VIEWED"
    | "PAYMENT_CHECKOUT_VIEWED";
  payment: AsaasPaymentResponse;
}

export interface AsaasBalanceResponse {
  balance: number;
  reservedBalance?: number;
  awaitingPayment?: number;
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
