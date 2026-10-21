import type { DateISO, Id, TeacherPayout, TeacherPayoutLine, TeacherPayRule } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { addMonths, format, parseISO } from "date-fns";
import { apiError, notFoundError } from "@/services/world/ops";
import { store } from "@/services/world/store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function todayISO(): DateISO {
  return format(new Date(), "yyyy-MM-dd");
}

export function currentCompetence(): string {
  return todayISO().slice(0, 7);
}

export function isCompetence(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** "2026-10" -> "10/2026". */
export function competenceLabel(competence: string): string {
  const [year, month] = competence.split("-");
  return `${month}/${year}`;
}

export function professionalName(id: Id): string {
  return store.professionals.find((p) => p.id === id)?.name ?? "";
}

export function classGroupName(id: Id): string {
  return store.classGroups.find((g) => g.id === id)?.name ?? "";
}

export function ruleOf(professionalId: Id): TeacherPayRule | undefined {
  return store.teacherPayRules.find((r) => r.professionalId === professionalId);
}

/** Registro do mes (qualquer status menos cancelado). */
export function payoutOf(professionalId: Id, competence: string): TeacherPayout | undefined {
  return store.teacherPayouts.find(
    (p) =>
      p.professionalId === professionalId &&
      p.competence === competence &&
      p.status !== "canceled",
  );
}

export function adjustmentLines(payout?: TeacherPayout): TeacherPayoutLine[] {
  return payout ? payout.lines.filter((l) => l.kind === "adjustment") : [];
}

export function payoutLabel(professionalId: Id, competence: string): string {
  return `${professionalName(professionalId)} · ${competenceLabel(competence)}`;
}

/** Meses fechados ou pagos do professor. */
export function closedPayoutsOf(professionalId: Id): TeacherPayout[] {
  return store.teacherPayouts.filter((p) => p.professionalId === professionalId && p.status !== "open");
}

export function nextCompetence(competence: string): string {
  return format(addMonths(parseISO(`${competence}-01`), 1), "yyyy-MM");
}

export function formatSignedCents(cents: number): string {
  return cents < 0 ? `− ${formatCents(-cents)}` : formatCents(cents);
}

/** Linhas de `a` que nao estao em `b` (mesma descricao e valor; conta repeticoes). */
export function lineDifference(a: TeacherPayoutLine[], b: TeacherPayoutLine[]): TeacherPayoutLine[] {
  const rest = [...b];
  return a.filter((line) => {
    const i = rest.findIndex((r) => r.label === line.label && r.amountCents === line.amountCents);
    if (i === -1) return true;
    rest.splice(i, 1);
    return false;
  });
}

export function findPayout(id: Id): TeacherPayout {
  const payout = store.teacherPayouts.find((p) => p.id === id);
  if (!payout) throw notFoundError("Pagamento do professor não encontrado.");
  return payout;
}

export function conflict(message: string) {
  return apiError("VALIDATION", message, { httpStatus: 409 });
}
