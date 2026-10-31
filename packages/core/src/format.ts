import { displayPhone } from "@gestarahub/core/phone";

/** Formatadores de exibicao (UI em pt-BR). */

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Centavos -> "R$ 45,00". */
export function formatCents(cents: number): string {
  // -0 sairia "-R$ 0,00".
  return BRL.format(cents === 0 ? 0 : cents / 100);
}

/** Minutos -> "30 min", "1h", "1h 30min". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

/**
 * ISO -> "27/06/2026". Data pura ("2026-06-27") sai como esta: `new Date()`
 * a leria como meia-noite UTC e, no Brasil (UTC-3), mostraria o dia anterior.
 */
export function formatDate(iso: string): string {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (day) return `${day[3]}/${day[2]}/${day[1]}`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** ISO -> "27/06/2026 09:15". */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Telefone para exibicao: Brasil "(11) 99999-9999", outros paises no formato
 * internacional. Aceita E.164 e o dado antigo so com digitos (core/phone).
 */
export function formatPhone(value: string): string {
  return displayPhone(value);
}

/**
 * Plural pt-BR com o numero: `plural(1, "cobrança", "cobranças")` -> "1 cobrança",
 * `plural(5, ...)` -> "5 cobranças" (0 usa o plural). Evita o "cobrança(s)".
 */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${pluralWord(count, singular, pluralForm)}`;
}

/** So a palavra concordando com `count` (para frases como "3 aulas concluídas"). */
export function pluralWord(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

/**
 * Numero digitado com virgula ou ponto ("7,5", "7.5", "-3"); `null` se nao for
 * numero. Um so leitor para notas, pontos e medidas (revisao geral de 31/10/2026).
 */
export function parseDecimal(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const text = raw.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}
