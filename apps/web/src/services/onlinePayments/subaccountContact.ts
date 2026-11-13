import type { Address } from "@gestarahub/contracts";
import { brazilNationalDigits } from "@gestarahub/core/phone";

/**
 * Topo da fatura do parceiro (13/11/2026): telefone e endereco do espaco saem
 * dos dados comerciais da subconta, digitados em "Ativar recebimentos". Ao
 * salvar Configuracoes, os dois seguem para la. So contato: nome do titular,
 * documento, nascimento, renda e e-mail financeiro ficam como estao (sao da
 * abertura da conta e o parceiro confere).
 *
 * Funcao pura: parte dos dados atuais no parceiro e troca so o que mudou.
 */

/** Campos da conta que o parceiro aceita no envio (os outros voltam so na leitura). */
const SENDABLE = [
  "personType",
  "cpfCnpj",
  "birthDate",
  "companyType",
  "companyName",
  "incomeValue",
  "taxRegime",
  "email",
  "phone",
  "mobilePhone",
  "site",
  "postalCode",
  "address",
  "addressNumber",
  "complement",
  "province",
] as const;

export interface SpaceContact {
  /** Telefone do espaco em Configuracoes (E.164, "+5592986224953"). */
  phone?: string;
  address?: Partial<Address> | null;
}

export interface CommercialInfoUpdate {
  /** Corpo do envio: os dados atuais com telefone e endereco novos. */
  payload: Record<string, unknown>;
  /** Campos que mudaram (vazio: nada a enviar). */
  changed: string[];
}

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : value);

export function buildCommercialInfoUpdate(current: Record<string, unknown>, contact: SpaceContact): CommercialInfoUpdate {
  const payload: Record<string, unknown> = {};
  for (const key of SENDABLE) {
    const value = current[key];
    if (value !== null && value !== undefined && value !== "") payload[key] = value;
  }
  const next: Record<string, string> = {};

  // Celular (11 digitos com o 9) vai em "mobilePhone"; fixo, em "phone". So telefone do Brasil.
  const digits = brazilNationalDigits(contact.phone);
  if (digits) {
    if (digits.length === 11) next.mobilePhone = digits;
    else next.phone = digits;
  }

  const a = contact.address;
  const postalCode = (a?.postalCode ?? "").replace(/\D/g, "");
  // Endereco so inteiro (o parceiro tira a cidade do CEP): faltando parte, fica o de la.
  if (postalCode.length === 8 && a?.street?.trim() && a?.number?.trim() && a?.neighborhood?.trim()) {
    next.postalCode = postalCode;
    next.address = a.street.trim();
    next.addressNumber = a.number.trim();
    // Vazio apaga o complemento de la.
    next.complement = a.complement?.trim() ?? "";
    next.province = a.neighborhood.trim();
  }

  const changed: string[] = [];
  for (const [key, value] of Object.entries(next)) {
    if ((clean(current[key]) ?? "") === value) continue;
    changed.push(key);
    payload[key] = value;
  }
  return { payload, changed };
}
