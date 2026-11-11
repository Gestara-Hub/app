import type { ChargeKind, FinanceOverdueToDate, FinancialEntryDisplayStatus } from "@gestarahub/contracts";

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
 * Link para Cobrancas na competencia (e, opcional, no status/kind).
 * Obs.: a tela de Cobrancas ainda precisa ler estes parametros.
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

/** Cobrancas em atraso de todos os meses (a divida nao some na virada do mes). */
export const ALL_OVERDUE_BILLING_HREF = "/classes/billing?overdue=all";

/** Atrasos so de antes do mes (a linha "+ R$ X de meses anteriores" do Resumo). */
export function earlierOverdueBillingHref(competence: string): string {
  return `${ALL_OVERDUE_BILLING_HREF}&before=${competence}`;
}

/**
 * Onde esta o atraso acumulado, quando ha meses anteriores: "R$ 150,00 deste
 * mes · R$ 370,00 de outubro" (2+ meses anteriores: "de meses anteriores").
 * So o mes atual (ou nada atrasado antes dele): null.
 */
/** Atraso de meses anteriores ao mes de referencia (em centavos). */
export function overdueEarlierCents(overdue: FinanceOverdueToDate | undefined, competence: string): number {
  return (overdue?.incomeByCompetence ?? []).filter((m) => m.competence < competence).reduce((sum, m) => sum + m.amountCents, 0);
}


/** Classes do badge de status (tokens do tema). */
export const ENTRY_STATUS_CLASS: Record<FinancialEntryDisplayStatus, string> = {
  // Mesmas cores das cobrancas (10/11/2026): pendente ambar, cancelado cinza e sem riscado.
  pending: "border-warning/30 bg-warning/10 text-warning",
  paid: "border-success/25 bg-success/10 text-success",
  overdue: "border-destructive/25 bg-destructive/10 text-destructive",
  canceled: "border-border/60 bg-muted/50 text-muted-foreground",
};
