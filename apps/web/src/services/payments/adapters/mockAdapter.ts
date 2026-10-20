import type { DateTimeISO } from "@gestarahub/contracts";
import { newId } from "@/mocks/helpers";
import type {
  PaymentGateway,
  PixPayment,
  PaymentLinkPayment,
  GatewayRecurringAuthorization,
  CreatePixInput,
  CreateLinkInput,
} from "../types";

const DEMO_PIX_KEY = "demonstracao@gestarahub.com.br";

function randomToken(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Campo TLV do padrão EMV (id + tamanho com 2 dígitos + valor). */
function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** Sem acento, maiúsculo e cortado (o padrão aceita só ASCII curto). */
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
 * "Copia e cola" com o formato do Pix (EMV), mas propositalmente INVÁLIDO: o
 * CRC final é "DEMO", então nenhum app de banco aceita pagar este código, mesmo
 * que a chave digitada nas Configurações seja real.
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

/**
 * Adaptador Mock de Gateway de Pagamento.
 * Usado em testes locais, demonstrações e como fallback offline.
 */
export const mockPaymentGateway: PaymentGateway = {
  provider: "mock",

  async createPix(input: CreatePixInput): Promise<PixPayment> {
    const txid = `DEMO${randomToken(21)}`;
    return {
      providerId: txid,
      pixCopyPaste: fakePixCopyPaste({ ...input, txid }),
      expiresAt: addMinutes(input.expiresInMinutes),
      splitAmountCents: input.splitAmountCents ?? 199,
    };
  },

  async createLink(input: CreateLinkInput): Promise<PaymentLinkPayment> {
    const token = randomToken(10).toLowerCase();
    return {
      providerId: `link_${token}`,
      linkUrl: `https://pagar.gestarahub.demo/c/${token}`,
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
