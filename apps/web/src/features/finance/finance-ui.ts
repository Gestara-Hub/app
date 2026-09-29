import type { ChargeKind, FinancialEntryDisplayStatus } from "@gestarahub/contracts";

/** "2026-09-10" -> "10/09" (sem Date, evita o bug de UTC). */
export function shortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

/** "2026-09-10" -> "10/09/2026". */
export function fullDate(date: string): string {
  return date.split("-").reverse().join("/");
}

/**
 * Link para Mensalidades na competencia (e, opcional, no status/kind).
 * Obs.: a tela de Mensalidades ainda precisa ler estes parametros.
 */
export function billingHref(
  competence: string,
  options?: { status?: "overdue" | "pending" | "paid"; kind?: ChargeKind },
): string {
  const params = new URLSearchParams({ month: competence });
  if (options?.status) params.set("status", options.status);
  if (options?.kind) params.set("kind", options.kind);
  return `/classes/billing?${params.toString()}`;
}

/** Classes do badge de status (tokens do tema). */
export const ENTRY_STATUS_CLASS: Record<FinancialEntryDisplayStatus, string> = {
  pending: "border-border/60 bg-muted/50 text-muted-foreground",
  paid: "border-success/25 bg-success/10 text-success",
  overdue: "border-destructive/25 bg-destructive/10 text-destructive",
  canceled: "border-warning/30 bg-warning/10 text-warning line-through",
};
