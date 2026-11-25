import type { DateTimeISO } from "@gestarahub/contracts";
import { dateInSpace } from "@gestarahub/core/date";
import {
  AsaasApiError,
  asaasToday,
  createOrFindCustomer,
  createPixAddressKey,
  deletePayment,
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
import { PIX_ACCOUNT_PENDING_MESSAGE, PixNotReadyError } from "../types";
import { newId } from "@/services/world/ops";
import { logWarn } from "@/lib/log";
import { brazilNationalDigits } from "@gestarahub/core/phone";
import type { Address } from "@gestarahub/contracts";

/** O Asaas recusa o QR porque a conta ainda nao tem chave Pix (recem-ativada). */
/**
 * Subconta sem chave Pix (o primeiro Pix depois de ativar, 01/11/2026): cria a
 * chave aleatoria e pede o QR de novo uma vez; se ainda falhar, o erro segue.
 */
async function getPixQrCodeCreatingKey(paymentId: string, apiKey?: string): ReturnType<typeof getPixQrCode> {
  try {
    return await getPixQrCode(paymentId, apiKey);
  } catch (error) {
    if (!isPixKeyMissing(error)) throw error;
    try {
      await createPixAddressKey(apiKey);
    } catch (keyError) {
      // Conta ainda em analise no Asaas: o Pix so libera com a aprovacao.
      if (isAccountNotApproved(keyError)) throw new PixNotReadyError(PIX_ACCOUNT_PENDING_MESSAGE);
      throw keyError;
    }
    return getPixQrCode(paymentId, apiKey);
  }
}

function isPixKeyMissing(error: unknown): boolean {
  if (!(error instanceof AsaasApiError)) return false;
  const texts = [error.message, ...(error.errors ?? []).map((e) => e.description)];
  return texts.some((t) => /chave pix/i.test(t ?? ""));
}

/** "A sua conta ainda não está totalmente aprovada para utilizar o Pix." */
function isAccountNotApproved(error: unknown): boolean {
  if (!(error instanceof AsaasApiError)) return false;
  const texts = [error.message, ...(error.errors ?? []).map((e) => e.description)];
  return texts.some((t) => /n[aã]o est[aá] totalmente aprovada/i.test(t ?? ""));
}

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
  // Vence no dia do espaco, nunca antes do "hoje" do Asaas.
  const todayDate = asaasToday();
  const targetDueDate = dateInSpace(validUntil);
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
/** Endereco do aluno nos campos do cliente do Asaas (so o que esta preenchido). */
function customerAddress(address: Address | undefined) {
  if (!address) return {};
  const postalCode = address.postalCode?.replace(/\D/g, "");
  return {
    address: address.street?.trim() || undefined,
    addressNumber: address.number?.trim() || undefined,
    complement: address.complement?.trim() || undefined,
    province: address.neighborhood?.trim() || undefined,
    postalCode: postalCode && postalCode.length === 8 ? postalCode : undefined,
  };
}

/**
 * Adaptador de Pagamento para o gateway Asaas (https://docs.asaas.com).
 * Implementa o contrato neutro PaymentGateway.
 */
export const asaasPaymentGateway: PaymentGateway = {
  provider: "asaas",

  async createPix(input: CreatePixInput): Promise<PixPayment> {
    const config = getAsaasConfig();

    // 1. Obtém ou cria o cliente pagador no Asaas
    // O parceiro exige o CPF de quem paga (aluno maior ou responsavel financeiro).
    const cpf = input.studentCpf?.replace(/\D/g, "");
    if (!cpf) throw new Error("Falta o CPF de quem paga a cobrança.");

    const customer = await createOrFindCustomer(
      {
        name: input.studentName || "Aluno GestaraHub",
        email: input.studentEmail || undefined,
        mobilePhone: brazilNationalDigits(input.studentPhone),
        cpfCnpj: cpf,
        ...customerAddress(input.studentAddress),
        externalReference: input.studentId,
        // Avisos ao aluno saem do GestaraHub; os do Asaas (SMS e WhatsApp sao
        // cobrados da subconta) duplicariam a mensagem.
        notificationDisabled: true,
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
      config.masterWalletId && input.subaccountApiKey && splitAmountCents > 0
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

    // 6. Busca o QR Code e código Copia e Cola. Sem QR, a cobranca nao serve
    // para nada: cancela no parceiro (nao fica orfa) antes de avisar.
    let qrCode: Awaited<ReturnType<typeof getPixQrCode>>;
    try {
      qrCode = await getPixQrCodeCreatingKey(payment.id, input.subaccountApiKey);
    } catch (qrError) {
      try {
        await deletePayment(payment.id, input.subaccountApiKey);
      } catch (cancelError) {
        logWarn("[asaasAdapter] Pix sem QR não foi cancelado no Asaas:", { paymentId: payment.id, cancelError });
      }
      if (isPixKeyMissing(qrError)) throw new PixNotReadyError();
      throw qrError;
    }

    return {
      provider: "asaas",
      providerId: payment.id,
      pixCopyPaste: qrCode.payload,
      // Validade no GestaraHub respeita o tempo configurado pelo usuário (ex: 24h),
      // em vez do padrão de 1 ano retornado tecnicamente pelo SPI/BACEN no QR Code
      expiresAt: addMinutes(input.expiresInMinutes || 1440),
      splitAmountCents,
    };
  },

  async createLink(input: CreateLinkInput): Promise<PaymentLinkPayment> {
    const config = getAsaasConfig();
    // O parceiro exige o CPF de quem paga (aluno maior ou responsavel financeiro).
    const cpf = input.studentCpf?.replace(/\D/g, "");
    if (!cpf) throw new Error("Falta o CPF de quem paga a cobrança.");

    const customer = await createOrFindCustomer(
      {
        name: input.studentName || "Aluno GestaraHub",
        email: input.studentEmail || undefined,
        mobilePhone: brazilNationalDigits(input.studentPhone),
        cpfCnpj: cpf,
        ...customerAddress(input.studentAddress),
        externalReference: input.studentId,
        // Avisos ao aluno saem do GestaraHub; os do Asaas (SMS e WhatsApp sao
        // cobrados da subconta) duplicariam a mensagem.
        notificationDisabled: true,
      },
      input.subaccountApiKey,
    );

    // Vencimento do link de pagamento calculado pelo tempo configurado (ex: 24h = amanhã)
    const dueDate = calculateAsaasDueDate(input.expiresInMinutes);
    const description = formatPaymentDescription(input);

    // Split de pagamento do marketplace GestaraHub se houver Master Wallet configurada
    const splitAmountCents = input.splitAmountCents ?? 199; // R$ 1,99 por padrão
    const splitSettings =
      config.masterWalletId && input.subaccountApiKey && splitAmountCents > 0
        ? [
            {
              walletId: config.masterWalletId,
              fixedValue: splitAmountCents / 100,
            },
          ]
        : undefined;

    const payment = await createPixPayment(
      {
        customer: customer.id,
        // Cartao (padrao): a fatura oferece credito e debito. BOLETO: boleto.
        // UNDEFINED: o aluno escolhe Pix, boleto ou cartao na fatura.
        billingType: input.billingType ?? "CREDIT_CARD",
        value: input.amountCents / 100,
        dueDate,
        description,
        externalReference: input.chargeId,
        split: splitSettings,
      },
      input.subaccountApiKey,
    );

    return {
      provider: "asaas",
      providerId: payment.id,
      linkUrl: payment.invoiceUrl || `https://sandbox.asaas.com/i/${payment.id}`,
      expiresAt: addMinutes(input.expiresInMinutes || 1440),
      splitAmountCents,
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
