import type {
  DateTimeISO,
  Id,
  RecurringAuthorization,
} from "@gestarahub/contracts";

/**
 * Adaptador do provedor de pagamento (docs/technical/05, secao 6.1). Isola o
 * gateway para trocar pelo real depois (Asaas, Mercado Pago, banco etc.). Nesta
 * fase so existe o mock: gera codigos ficticios, sem rede.
 */

export interface PixPayment {
  /** Id do pagamento no provedor (txid). */
  providerId: string;
  pixCopyPaste: string;
  expiresAt: DateTimeISO;
}

export interface PaymentLinkPayment {
  providerId: string;
  linkUrl: string;
  expiresAt: DateTimeISO;
}

/** Autorizacao do Pix Automatico devolvida pelo provedor (sem escopo do tenant). */
export type GatewayRecurringAuthorization = Omit<
  RecurringAuthorization,
  "organizationId"
>;

export interface PaymentGateway {
  createPix(input: {
    chargeId: Id;
    amountCents: number;
    expiresInMinutes: number;
    /** Chave Pix da academia (simulada) e nome exibido no pagamento. */
    pixKey?: string;
    merchantName?: string;
  }): Promise<PixPayment>;
  createLink(input: {
    chargeId: Id;
    amountCents: number;
    expiresInMinutes: number;
  }): Promise<PaymentLinkPayment>;
  requestRecurringAuthorization(input: {
    studentId: Id;
    maxAmountCents: number;
  }): Promise<GatewayRecurringAuthorization>;
}

// --- Mock --------------------------------------------------------------------

const DEMO_PIX_KEY = "demonstracao@gestarahub.com.br";

function randomToken(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Campo TLV do padrao EMV (id + tamanho com 2 digitos + valor). */
function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** Sem acento, maiusculo e cortado (o padrao aceita so ASCII curto). */
function asciiUpper(value: string, max: number): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .trim()
    .slice(0, max);
}

function addMinutes(minutes: number): DateTimeISO {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/**
 * "Copia e cola" com o formato do Pix (EMV), mas propositalmente INVALIDO: o
 * CRC final e "DEMO", entao nenhum app de banco aceita pagar este codigo, mesmo
 * que a chave digitada nas Configuracoes seja real.
 */
function fakePixCopyPaste(input: {
  amountCents: number;
  txid: string;
  pixKey?: string;
  merchantName?: string;
}): string {
  const account =
    tlv("00", "br.gov.bcb.pix") +
    tlv("01", input.pixKey?.trim() || DEMO_PIX_KEY);
  const payload =
    tlv("00", "01") +
    tlv("26", account) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", (input.amountCents / 100).toFixed(2)) +
    tlv("58", "BR") +
    tlv(
      "59",
      asciiUpper(input.merchantName || "GESTARAHUB DEMO", 25) ||
        "GESTARAHUB DEMO",
    ) +
    tlv("60", "DEMONSTRACAO") +
    tlv("62", tlv("05", input.txid));
  return `${payload}6304DEMO`;
}

export const mockPaymentGateway: PaymentGateway = {
  async createPix(input) {
    const txid = `DEMO${randomToken(21)}`;
    return {
      providerId: txid,
      pixCopyPaste: fakePixCopyPaste({ ...input, txid }),
      expiresAt: addMinutes(input.expiresInMinutes),
    };
  },

  async createLink(input) {
    const token = randomToken(10).toLowerCase();
    return {
      providerId: `link_${token}`,
      // Dominio .demo nao existe: o link e so ilustrativo.
      linkUrl: `https://pagar.gestarahub.demo/c/${token}`,
      expiresAt: addMinutes(input.expiresInMinutes),
    };
  },

  async requestRecurringAuthorization(input) {
    return {
      id: crypto.randomUUID(),
      studentId: input.studentId,
      maxAmountCents: input.maxAmountCents,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
  },
};

/** Gateway em uso. Na fase de backend a escolha sai daqui e vai para a API. */
export const paymentGateway: PaymentGateway = mockPaymentGateway;
