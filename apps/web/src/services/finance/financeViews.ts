import type {
  Charge,
  ChargeKind,
  FinanceEntryView,
  FinancialEntry,
  FinancialEntryDisplayStatus,
  TeacherPayout,
} from "@gestarahub/contracts";
import { entryDisplayStatus, lastDayOfCompetence } from "@gestarahub/core/finance";
import { store } from "@/services/world/store";
import { wasEverPaid } from "./financeAudit";
import { monthName } from "./financeHelpers";
import { categoryName, systemCategoryId } from "./financeStore";
import {
  chargeCategoryId,
  chargeStatus,
  isCashCharge,
  payoutStatus,
  professionalName,
} from "./cashFlowSources";

// --- Read-model da aba Lancamentos ------------------------------------------

export function toEntryView(e: FinancialEntry, today: string): FinanceEntryView {
  return {
    id: e.id,
    source: "entry",
    type: e.type,
    categoryId: e.categoryId,
    categoryName: categoryName(e.categoryId),
    description: e.description,
    amountCents: e.amountCents,
    dueDate: e.dueDate,
    status: entryDisplayStatus(e, today),
    paidAt: e.paidAt,
    method: e.method,
    entry: e,
    recurrenceId: e.recurrenceId,
    ...(e.eventId ? { eventId: e.eventId, eventName: (store.events ?? []).find((ev) => ev.id === e.eventId)?.name } : {}),
    everPaid: wasEverPaid(e),
    recurrenceActive: e.recurrenceId
      ? store.financialRecurrences.some((r) => r.id === e.recurrenceId && r.status === "active")
      : undefined,
  };
}

export const CHARGE_ROW_TITLE: Record<ChargeKind, string> = {
  membership: "Mensalidades",
  dropin: "Aulas avulsas",
  extra: "Cobranças avulsas",
  course: "Cursos",
  package: "Pacotes de aulas",
  event: "Eventos e seminários",
};

/** Linha agregada das cobrancas de um kind na competencia (D7). */
export function chargeAggregateRow(
  kind: ChargeKind,
  competence: string,
  charges: Charge[],
): FinanceEntryView | null {
  const active = charges.filter(isCashCharge);
  if (active.length === 0) return null;
  const counts = { paid: 0, pending: 0, overdue: 0 };
  let amountCents = 0;
  for (const c of active) {
    amountCents += c.amountCents;
    const status = chargeStatus(c);
    if (status === "paid") counts.paid += 1;
    else if (status === "overdue") counts.overdue += 1;
    else counts.pending += 1;
  }
  const open = active.filter((c) => chargeStatus(c) !== "paid");
  const status: FinancialEntryDisplayStatus =
    counts.overdue > 0 ? "overdue" : counts.pending > 0 ? "pending" : "paid";
  const dueDate =
    open.map((c) => c.dueDate).sort()[0] ??
    active.map((c) => c.dueDate).sort().at(-1) ??
    lastDayOfCompetence(competence);
  const categoryId = chargeCategoryId(kind);
  return {
    id: `charges:${kind}:${competence}`,
    source: "charge",
    type: "income",
    categoryId,
    categoryName: categoryName(categoryId, CHARGE_ROW_TITLE[kind]),
    description: `${CHARGE_ROW_TITLE[kind]} de ${monthName(competence)}`,
    amountCents,
    dueDate,
    status,
    chargeCounts: counts,
  };
}

export function payoutRow(p: TeacherPayout): FinanceEntryView | null {
  const status = p.status === "canceled" ? "canceled" : payoutStatus(p);
  if (!status) return null;
  const categoryId = systemCategoryId("teachers");
  return {
    id: p.id,
    source: "teacher_payout",
    type: "expense",
    categoryId,
    categoryName: categoryName(categoryId, "Professores"),
    description: `Pagamento de ${professionalName(p.professionalId)} (${monthName(p.competence)})`,
    amountCents: p.totalCents,
    dueDate: p.dueDate,
    status,
    paidAt: p.paidAt,
    method: p.method,
    professionalId: p.professionalId,
    payoutId: p.id,
  };
}
