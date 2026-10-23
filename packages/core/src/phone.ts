import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
  type PhoneNumber,
} from "libphonenumber-js";

/**
 * Telefone com pais (decisao de 18/10/2026). Guardado em E.164
 * ("+5511977770000"); a mascara de digitacao e a exibicao seguem o pais.
 * Dado antigo, so com digitos ("11977770000"), vale como Brasil.
 */

export type PhoneCountry = CountryCode;

/** Pais padrao do seletor: Brasil. */
export const DEFAULT_PHONE_COUNTRY: PhoneCountry = "BR";

/** Le o telefone guardado: E.164 ou, sem "+", numero brasileiro antigo. */
export function parsePhone(value: string | null | undefined): PhoneNumber | undefined {
  const text = (value ?? "").trim();
  if (!text) return undefined;
  if (text.startsWith("+")) return parsePhoneNumberFromString(text);
  const digits = text.replace(/\D/g, "").replace(/^0+/, "");
  // Ja com o 55 na frente (12 ou 13 digitos): numero brasileiro com DDI.
  if (digits.length > 11 && digits.startsWith("55")) return parsePhoneNumberFromString(`+${digits}`);
  return parsePhoneNumberFromString(digits, DEFAULT_PHONE_COUNTRY);
}

/** Numero com DDI ("+1 415 555 2671"): pais e digitos no pais, se der para saber. */
export function parseInternational(text: string): { country: PhoneCountry; nationalDigits: string } | undefined {
  const parsed = parsePhoneNumberFromString(text.trim());
  return parsed?.country ? { country: parsed.country, nationalDigits: parsed.nationalNumber } : undefined;
}

/** Pais do telefone guardado (Brasil quando nao da para saber). */
export function phoneCountryOf(value: string | null | undefined): PhoneCountry {
  return parsePhone(value)?.country ?? DEFAULT_PHONE_COUNTRY;
}

/** Digitos do numero no pais, sem o DDI (o que vai no campo depois do seletor). */
export function nationalDigitsOf(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  const parsed = parsePhone(text);
  if (parsed) return parsed.nationalNumber;
  if (!text.startsWith("+")) return text.replace(/\D/g, "");
  return "";
}

/**
 * Celular brasileiro como os gateways de pagamento esperam: so DDD + numero,
 * sem o 55 ("+5592991844219" -> "92991844219"). Numero de outro pais ou
 * invalido: undefined (o Asaas so aceita telefone do Brasil).
 */
export function brazilNationalDigits(value: string | null | undefined): string | undefined {
  const parsed = parsePhone(value);
  if (!parsed || parsed.country !== "BR") return undefined;
  return parsed.nationalNumber || undefined;
}

/** DDI do pais: "55", "1", "351". */
export function callingCodeOf(country: PhoneCountry): string {
  return getCountryCallingCode(country);
}

/**
 * Monta o valor guardado (E.164) a partir do pais e dos digitos digitados.
 * Numero incompleto tambem vira "+DDI digitos" (a validacao do formulario
 * acusa); vazio fica vazio.
 */
export function toStoredPhone(country: PhoneCountry, nationalDigits: string): string {
  const digits = nationalDigits.replace(/\D/g, "");
  if (!digits) return "";
  const parsed = parsePhoneNumberFromString(digits, country);
  return parsed?.number ?? `+${callingCodeOf(country)}${digits}`;
}

/** Mascara do pais durante a digitacao: "(11) 97777-0000", "(415) 555-2671". */
export function formatAsYouType(country: PhoneCountry, nationalDigits: string): string {
  const digits = nationalDigits.replace(/\D/g, "");
  if (!digits) return "";
  return new AsYouType(country).input(digits);
}

/** Brasil precisa do DDD (10 ou 11 digitos); os outros paises, o tamanho do pais. */
function isUsable(parsed: PhoneNumber | undefined): parsed is PhoneNumber {
  if (!parsed || !parsed.isPossible()) return false;
  return parsed.country !== DEFAULT_PHONE_COUNTRY || parsed.nationalNumber.length >= 10;
}

/** Telefone que existe (tamanho certo para o pais; no Brasil, com DDD). */
export function isPossiblePhone(value: string | null | undefined): boolean {
  return isUsable(parsePhone(value));
}

/**
 * Exibicao: Brasil no formato nacional "(11) 97777-0000"; outros paises no
 * internacional "+1 415 555 2671". Texto que nao e telefone volta como veio.
 */
export function displayPhone(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  const parsed = parsePhone(text);
  if (!parsed) return text;
  return parsed.country === DEFAULT_PHONE_COUNTRY ? parsed.formatNational() : parsed.formatInternational();
}

/** Numero para o WhatsApp (DDI + numero, so digitos). `null` se nao for telefone possivel. */
export function whatsappDigits(value: string | null | undefined): string | null {
  const parsed = parsePhone(value);
  if (!isUsable(parsed)) return null;
  return parsed.number.replace(/\D/g, "");
}

/** Paises do seletor (codigo ISO), Brasil primeiro e o resto pelo nome em pt-BR. */
export function phoneCountries(): PhoneCountry[] {
  const names = new Intl.DisplayNames(["pt-BR"], { type: "region" });
  return [
    DEFAULT_PHONE_COUNTRY,
    ...getCountries()
      .filter((c) => c !== DEFAULT_PHONE_COUNTRY)
      .sort((a, b) => (names.of(a) ?? a).localeCompare(names.of(b) ?? b, "pt-BR")),
  ];
}

/** Nome do pais em pt-BR ("Estados Unidos"). */
export function phoneCountryName(country: PhoneCountry): string {
  return new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(country) ?? country;
}

/** Bandeira do pais pelo codigo ISO (emoji). */
export function countryFlag(country: PhoneCountry): string {
  return String.fromCodePoint(...[...country].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
