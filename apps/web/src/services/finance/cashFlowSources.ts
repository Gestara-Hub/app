import type {
  Charge,
  ChargeKind,
  FinancialEntryDisplayStatus,
  FinancialSystemCategoryKey,
  Id,
  TeacherPayout,
} from "@gestarahub/contracts";
import { teamWords } from "@/services/world/nouns";
import { competenceOf, type CashFlowItem } from "@gestarahub/core/finance";
import { store } from "@/services/world/store";
import { currentCompetence, todayISO } from "./financeHelpers";
import { systemCategoryId } from "./financeStore";
import { openPayoutPreviews } from "./teacherPayViews";

/** Competencias com previa de professor que ainda pode vencer: mes anterior e atual. */
export function previewCompetences(): string[] {
  const current = currentCompetence();
  const [y, m] = current.split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  return [prev, current];
}

/** Previas abertas de pagamento de professor (entram no "A pagar"). */
export function openPreviews() {
  return previewCompetences().flatMap((c) => openPayoutPreviews(c));
}

// --- Fontes de caixa --------------------------------------------------------

/** Status efetivo da cobranca (atraso derivado, como em Cobrancas). */
export function chargeStatus(c: Charge): FinancialEntryDisplayStatus {
  if (c.status === "pending" || c.status === "overdue") {
    return c.dueDate < todayISO() ? "overdue" : "pending";
  }
  // Isento (bolsa integral) nunca chega aqui: `isCashCharge` o deixa de fora.
  return c.status === "waived" ? "canceled" : c.status;
}

/** Cobranca que conta no caixa: nem cancelada nem isenta (bolsa integral). */
export function isCashCharge(c: Charge): boolean {
  return c.status !== "canceled" && c.status !== "waived";
}

export function chargeCompetence(c: Charge): string {
  return c.competence ?? competenceOf(c.dueDate);
}

export const CHARGE_CATEGORY_KEY: Record<ChargeKind, FinancialSystemCategoryKey> = {
  membership: "memberships",
  dropin: "dropins",
  extra: "extras",
  course: "courses",
  package: "packages",
};

export function chargeCategoryId(kind: ChargeKind): Id {
  return systemCategoryId(CHARGE_CATEGORY_KEY[kind]);
}

/** Pagamento de professor persistido (fechado/pago) como item de caixa. */
export function payoutStatus(p: TeacherPayout): FinancialEntryDisplayStatus | null {
  if (p.status === "paid") return "paid";
  if (p.status === "closed") return p.dueDate < todayISO() ? "overdue" : "pending";
  return null; // previa aberta ou cancelado nao entram
}

export function professionalName(id: Id): string {
  return store.professionals.find((p) => p.id === id)?.name ?? teamWords().title;
}

/** Todos os itens de caixa do tenant (cobrancas, lancamentos, professores). */
export function cashFlowItems(): CashFlowItem[] {
  const items: CashFlowItem[] = [];
  for (const c of store.charges) {
    if (!isCashCharge(c)) continue;
    items.push({
      type: "income",
      amountCents: c.amountCents,
      dueDate: c.dueDate,
      status: chargeStatus(c),
      paidAt: c.status === "paid" ? c.paidAt : undefined,
      categoryId: chargeCategoryId(c.kind),
    });
  }
  for (const e of store.financialEntries) {
    if (e.status === "canceled") continue;
    items.push({
      type: e.type,
      amountCents: e.amountCents,
      dueDate: e.dueDate,
      status: e.status,
      paidAt: e.status === "paid" ? e.paidAt : undefined,
      categoryId: e.categoryId,
    });
  }
  const teachers = systemCategoryId("teachers");
  for (const p of store.teacherPayouts) {
    const status = payoutStatus(p);
    if (!status || p.totalCents <= 0) continue;
    items.push({
      type: "expense",
      amountCents: p.totalCents,
      dueDate: p.dueDate,
      status,
      paidAt: status === "paid" ? p.paidAt : undefined,
      categoryId: teachers,
    });
  }
  for (const p of openPreviews()) {
    items.push({
      type: "expense",
      amountCents: p.totalCents,
      dueDate: p.dueDate,
      status: p.dueDate < todayISO() ? "overdue" : "pending",
      categoryId: teachers,
    });
  }
  return items;
}
