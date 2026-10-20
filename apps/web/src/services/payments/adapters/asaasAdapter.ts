import type { DateTimeISO } from "@gestarahub/contracts";
import {
  createOrFindCustomer,
  createPixPayment,
  getPixQrCode,
  getAsaasConfig,
} from "@/lib/asaas";
import type {
  PaymentGateway,
  PixPayment,
  PaymentLinkPayment,
  GatewayRecurringAuthorization,
  CreatePixInput,
  CreateLinkInput,
} from "../types";
import { newId } from "@/mocks/helpers";

function addMinutes(minutes: number): DateTimeISO {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/**
 * Gera um CPF matematicamente válido para uso exclusivo no ambiente Sandbox do Asaas
 * caso o cadastro do aluno ainda não possua CPF informado.
 */
function generateSandboxTestCpf(): string {
  const rnd = (n: number) => Math.floor(Math.random() * n);
  const n = Array.from({ length: 9 }, () => rnd(10));
  let d1 = n.reduce((total, num, i) => total + num * (10 - i), 0);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  n.push(d1);
  let d2 = n.reduce((total, num, i) => total + num * (11 - i), 0);
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  n.push(d2);
  return n.join("");
}

/**
 * Adaptador de Pagamento para o gateway Asaas (https://docs.asaas.com).
 * Implementa o contrato neutro PaymentGateway.
 */
export const asaasPaymentGateway: PaymentGateway = {
  provider: "asaas",

  async createPix(input: CreatePixInput): Promise<PixPayment> {
    const config = getAsaasConfig();
    const isSandbox = config.apiUrl.includes("sandbox");

    // 1. Obtém ou cria o cliente pagador no Asaas
    const cpf =
      input.studentCpf?.replace(/\D/g, "") ||
      (isSandbox ? generateSandboxTestCpf() : undefined);

    const customer = await createOrFindCustomer(
      {
        name: input.studentName || "Aluno GestaraHub",
        email: input.studentEmail || undefined,
        mobilePhone: input.studentPhone?.replace(/\D/g, "") || undefined,
        cpfCnpj: cpf,
        externalReference: input.studentId,
      },
      input.subaccountApiKey,
    );

    // 2. Data de vencimento
    const dueDate = new Date(Date.now() + 86400000 * 3)
      .toISOString()
      .slice(0, 10);

    // 3. Split de pagamento do marketplace GestaraHub se houver Master Wallet configurada
    const splitAmountCents = input.splitAmountCents ?? 199; // R$ 1,99 por padrão
    const splitSettings =
      config.masterWalletId && input.subaccountApiKey
        ? [
            {
              walletId: config.masterWalletId,
              fixedValue: splitAmountCents / 100,
            },
          ]
        : undefined;

    // 4. Cria a cobrança Pix no Asaas
    const payment = await createPixPayment(
      {
        customer: customer.id,
        billingType: "PIX",
        value: input.amountCents / 100,
        dueDate,
        description: `Mensalidade GestaraHub - ${input.merchantName || "Espaço"}`,
        externalReference: input.chargeId,
        split: splitSettings,
      },
      input.subaccountApiKey,
    );

    // 5. Busca o QR Code e código Copia e Cola
    const qrCode = await getPixQrCode(payment.id, input.subaccountApiKey);

    return {
      providerId: payment.id,
      pixCopyPaste: qrCode.payload,
      pixQrCodeBase64: qrCode.encodedImage,
      expiresAt: qrCode.expirationDate || addMinutes(input.expiresInMinutes),
      splitAmountCents,
    };
  },

  async createLink(input: CreateLinkInput): Promise<PaymentLinkPayment> {
    const config = getAsaasConfig();
    const isSandbox = config.apiUrl.includes("sandbox");
    const cpf =
      input.studentCpf?.replace(/\D/g, "") ||
      (isSandbox ? generateSandboxTestCpf() : undefined);

    const customer = await createOrFindCustomer(
      {
        name: input.studentName || "Aluno GestaraHub",
        email: input.studentEmail || undefined,
        mobilePhone: input.studentPhone?.replace(/\D/g, "") || undefined,
        cpfCnpj: cpf,
        externalReference: input.studentId,
      },
      input.subaccountApiKey,
    );

    const dueDate = new Date(Date.now() + 86400000 * 3)
      .toISOString()
      .slice(0, 10);

    const payment = await createPixPayment(
      {
        customer: customer.id,
        billingType: "UNDEFINED", // Permite Pix, Cartão e Boleto na fatura do cliente
        value: input.amountCents / 100,
        dueDate,
        description: `Mensalidade GestaraHub - ${input.merchantName || "Espaço"}`,
        externalReference: input.chargeId,
      },
      input.subaccountApiKey,
    );

    return {
      providerId: payment.id,
      linkUrl: payment.invoiceUrl || `https://sandbox.asaas.com/i/${payment.id}`,
      expiresAt: addMinutes(input.expiresInMinutes),
    };
  },

  async requestRecurringAuthorization(input: {
    studentId: string;
    maxAmountCents: number;
  }): Promise<GatewayRecurringAuthorization> {
    return {
      id: newId(),
      studentId: input.studentId,
      maxAmountCents: input.maxAmountCents,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
  },
};
