import { AUDIT_ACTION_LABEL, AUDIT_GROUPS } from "./audit-labels";
import { brasiliaDay } from "./sla";
import { normalizeSearch, pickOne } from "./list-filters";

export const AUDIT_PERIODS = ["today", "7", "30"] as const;
export type AuditPeriod = (typeof AUDIT_PERIODS)[number];
export const AUDIT_PERIOD_LABEL: Record<AuditPeriod, string> = { today: "Hoje", "7": "Últimos 7 dias", "30": "Últimos 30 dias" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SPACE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Ações cujo rótulo em português (ou a própria chave) contém o termo, sem diferenciar acento nem caixa. */
export function actionsMatching(term: string | undefined): string[] {
  const needle = fold(normalizeSearch(term) ?? "");
  if (!needle) return [];
  return Object.entries(AUDIT_ACTION_LABEL)
    .filter(([action, label]) => fold(label).includes(needle) || action.includes(needle))
    .map(([action]) => action);
}

/** "AAAA-MM-DD" real (rejeita 2026-02-31); qualquer outra coisa vira undefined. */
export function validDay(value: string | undefined | null): string | undefined {
  if (!value || !DAY.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : value;
}

const shiftDay = (day: string, days: number) => new Date(new Date(`${day}T12:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Período em dias de Brasília (inclusive nas duas pontas). "de" e "até" escolhidos à mão
 * valem mais que a lista; se vierem invertidos, trocam de lugar.
 */
export function auditRange(input: { period?: string; from?: string; to?: string }, now: Date = new Date()): { from?: string; to?: string } {
  let from = validDay(input.from);
  let to = validDay(input.to);
  if (from || to) {
    if (from && to && from > to) [from, to] = [to, from];
    return { from, to };
  }
  const today = brasiliaDay(now);
  const period = pickOne(input.period, AUDIT_PERIODS);
  if (period === "today") return { from: today, to: today };
  if (period === "7") return { from: shiftDay(today, -6), to: today };
  if (period === "30") return { from: shiftDay(today, -29), to: today };
  return {};
}

export interface AuditFilters {
  group: string;
  q?: string;
  admin?: string;
  space?: string;
  period?: AuditPeriod;
  from?: string;
  to?: string;
  page: number;
}

/** Tudo que a tela aceita do endereço, já validado. `range` é o intervalo efetivo. */
export function parseAuditFilters(params: Record<string, string | undefined>, page: number, now: Date = new Date()) {
  const group = AUDIT_GROUPS.some((g) => g.value === params.group) ? (params.group as string) : "all";
  const range = auditRange(params, now);
  const filters: AuditFilters = {
    group,
    q: normalizeSearch(params.q),
    admin: params.admin && UUID.test(params.admin) ? params.admin : undefined,
    space: params.space && SPACE_ID.test(params.space) ? params.space : undefined,
    period: pickOne(params.period, AUDIT_PERIODS),
    from: validDay(params.from),
    to: validDay(params.to),
    page,
  };
  return { filters, range };
}
