import type { ChargeKind, FinanceOverdueToDate, FinancialEntryDisplayStatus } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { competenceLabel } from "./lib";

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

/**
 * Onde esta o atraso acumulado, quando ha meses anteriores: "R$ 150,00 deste
 * mes · R$ 370,00 de outubro" (2+ meses anteriores: "de meses anteriores").
 * So o mes atual (ou nada atrasado antes dele): null.
 */
export function overdueBreakdownText(overdue: FinanceOverdueToDate, competence: string): string | null {
  const earlier = overdue.incomeByCompetence.filter((m) => m.competence < competence);
  if (earlier.length === 0) return null;
  const current = overdue.incomeByCompetence
    .filter((m) => m.competence === competence)
    .reduce((sum, m) => sum + m.amountCents, 0);
  const earlierCents = earlier.reduce((sum, m) => sum + m.amountCents, 0);
  const [year] = competence.split("-");
  const monthName = (c: string) => {
    const label = competenceLabel(c).toLowerCase();
    return c.startsWith(`${year}-`) ? label.replace(/ de \d{4}$/, "") : label;
  };
  const earlierText =
    earlier.length === 1
      ? `${formatCents(earlierCents)} de ${monthName(earlier[0].competence)}`
      : `${formatCents(earlierCents)} de meses anteriores`;
  return current > 0 ? `${formatCents(current)} deste mês · ${earlierText}` : earlierText;
}

/** Classes do badge de status (tokens do tema). */
export const ENTRY_STATUS_CLASS: Record<FinancialEntryDisplayStatus, string> = {
  pending: "border-border/60 bg-muted/50 text-muted-foreground",
  paid: "border-success/25 bg-success/10 text-success",
  overdue: "border-destructive/25 bg-destructive/10 text-destructive",
  canceled: "border-warning/30 bg-warning/10 text-warning line-through",
};
