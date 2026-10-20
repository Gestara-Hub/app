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
 * Calcula a data de vencimento compatível com o Asaas a partir do tempo de expiração (em minutos).
 * Se configurado para 24h (1440 min), vence no dia seguinte (amanhã).
 * O Asaas exige que dueDate seja hoje ou no futuro.
 */
function calculateAsaasDueDate(expiresInMinutes: number): string {
  const expirationMs = (expiresInMinutes || 1440) * 60 * 1000;
  const validUntil = new Date(Date.now() + expirationMs);
  const todayDate = new Date().toISOString().slice(0, 10);
  const targetDueDate = validUntil.toISOString().slice(0, 10);
  return targetDueDate >= todayDate ? targetDueDate : todayDate;
}

/**
 * Formata uma descrição detalhada para a fatura do Asaas, incluindo o tipo da cobrança,
 * competência, plano, nome do aluno e da academia.
 */
export function formatPaymentDescription(input: {
  description?: string;
  chargeKind?: string;
  competence?: string;
  planName?: string;
  studentName?: string;
  merchantName?: string;
}): string {
  const parts: string[] = [];

  if (input.description) {
    parts.push(input.description);
  } else if (input.chargeKind === "membership") {
    if (input.competence) {
      const [year, month] = input.competence.split("-");
      parts.push(`Mensalidade ${month}/${year}`);
    } else {
      parts.push("Mensalidade");
    }
  } else if (input.chargeKind === "dropin") {
    parts.push("Aula avulsa");
  } else if (input.chargeKind === "package") {
    parts.push("Pacote de créditos");
  } else if (input.chargeKind === "course") {
    parts.push("Curso / Workshop");
  } else {
    parts.push("Cobrança");
  }

  if (input.planName) {
    parts.push(`Plano: ${input.planName}`);
  }

  if (input.studentName) {
    parts.push(`Aluno(a): ${input.studentName}`);
  }

  if (input.merchantName) {
    parts.push(input.merchantName);
  }

  return parts.join(" · ");
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

    // 2. Data de vencimento alinhada com o tempo configurado (ex: 24h = amanhã)
    const dueDate = calculateAsaasDueDate(input.expiresInMinutes);

    // 3. Descrição rica e detalhada do que está sendo pago
    const description = formatPaymentDescription(input);

    // 4. Split de pagamento do marketplace GestaraHub se houver Master Wallet configurada
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

    // 5. Cria a cobrança Pix no Asaas
    const payment = await createPixPayment(
      {
        customer: customer.id,
        billingType: "PIX",
        value: input.amountCents / 100,
        dueDate,
        description,
        externalReference: input.chargeId,
        split: splitSettings,
      },
      input.subaccountApiKey,
    );

    // 6. Busca o QR Code e código Copia e Cola
    const qrCode = await getPixQrCode(payment.id, input.subaccountApiKey);

    return {
      providerId: payment.id,
      pixCopyPaste: qrCode.payload,
      pixQrCodeBase64: qrCode.encodedImage,
      // Validade no GestaraHub respeita o tempo configurado pelo usuário (ex: 24h),
      // em vez do padrão de 1 ano retornado tecnicamente pelo SPI/BACEN no QR Code
      expiresAt: addMinutes(input.expiresInMinutes || 1440),
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

    // Vencimento do link de pagamento calculado pelo tempo configurado (ex: 24h = amanhã)
    const dueDate = calculateAsaasDueDate(input.expiresInMinutes);
    const description = formatPaymentDescription(input);

    const payment = await createPixPayment(
      {
        customer: customer.id,
        billingType: "UNDEFINED", // Permite Pix, Cartão e Boleto na fatura do cliente
        value: input.amountCents / 100,
        dueDate,
        description,
        externalReference: input.chargeId,
      },
      input.subaccountApiKey,
    );

    return {
      providerId: payment.id,
      linkUrl: payment.invoiceUrl || `https://sandbox.asaas.com/i/${payment.id}`,
      expiresAt: addMinutes(input.expiresInMinutes || 1440),
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
