import type { FinancialEntryType, PaymentMethod } from "@gestarahub/contracts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PAYMENT_METHODS } from "@/lib/labels";
import { apiError } from "@/services/world/ops";

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function currentCompetence(): string {
  return format(new Date(), "yyyy-MM");
}

/** "2026-09-10" -> "10/09/2026" (sem passar por Date, evita UTC). */
export function dateLabel(date: string): string {
  return date.split("-").reverse().join("/");
}

/** "2026-10" -> "outubro". */
export function monthName(competence: string): string {
  return format(parseISO(`${competence}-01`), "MMMM", { locale: ptBR });
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function isEntryType(value: unknown): value is FinancialEntryType {
  return value === "income" || value === "expense";
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod);
}

export function conflict(message: string) {
  return apiError("VALIDATION", message, { httpStatus: 409 });
}
