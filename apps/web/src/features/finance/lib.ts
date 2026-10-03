import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Abas do Financeiro (valor do `?tab=`). */
export type FinanceTab = "resumo" | "lancamentos" | "professores" | "configuracoes";

export const FINANCE_TABS: readonly FinanceTab[] = ["resumo", "lancamentos", "professores", "configuracoes"];

export const DEFAULT_FINANCE_TAB: FinanceTab = "resumo";

export function isFinanceTab(value: string | null | undefined): value is FinanceTab {
  return (FINANCE_TABS as readonly string[]).includes(value ?? "");
}

/** Competencia atual "YYYY-MM" (data local). */
export function currentCompetence(): string {
  return format(new Date(), "yyyy-MM");
}

export function isCompetence(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** "2026-09" -> "Setembro de 2026". */
export function competenceLabel(competence: string): string {
  const label = format(parseISO(`${competence}-01`), "MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "2026-09" -> "set/26" (eixo do grafico). */
export function competenceShortLabel(competence: string): string {
  return format(parseISO(`${competence}-01`), "MMM/yy", { locale: ptBR });
}

/**
 * Link da rota do Financeiro numa aba (mantem a competencia, se houver).
 * `type`/`status` abrem Lancamentos ja filtrado (lidos so ao montar a aba).
 */
export function financeHref(
  tab: FinanceTab,
  competence?: string,
  filter?: { type?: "income" | "expense"; status?: "paid" | "pending" | "overdue" | "canceled" },
): string {
  const params = new URLSearchParams({ tab });
  if (competence) params.set("month", competence);
  if (filter?.type) params.set("type", filter.type);
  if (filter?.status) params.set("status", filter.status);
  return `/finance?${params.toString()}`;
}
