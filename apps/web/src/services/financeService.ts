import type {
  ApiErrorField,
  AuditChange,
  Charge,
  ChargeKind,
  CreateFinancialCategory,
  CreateFinancialEntry,
  FinanceCategoryTotal,
  FinanceEntryView,
  FinanceMonthPoint,
  FinanceSummary,
  FinanceUpcomingItem,
  FinancialCategory,
  FinancialCategoryFilter,
  FinancialEntry,
  FinancialEntryDisplayStatus,
  FinancialEntryFilter,
  FinancialEntryType,
  FinancialEntryUpdateScope,
  FinancialRecurrence,
  FinancialSystemCategoryKey,
  Id,
  PaymentMethod,
  TeacherPayout,
  UpdateFinancialCategory,
  UpdateFinancialEntry,
} from "@gestarahub/contracts";
import {
  addCompetence,
  competenceOf,
  entryDisplayStatus,
  lastCompetences,
  lastDayOfCompetence,
  materializeRecurrence,
  recurrenceDueDate,
  summarizeByCategory,
  summarizeCashFlow,
  summarizeMonthlySeries,
  type CashFlowItem,
} from "@gestarahub/core/finance";
import { formatCents, plural } from "@gestarahub/core/format";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { financialEntryTypeLabel, paymentMethodLabel, PAYMENT_METHODS } from "@/lib/labels";
import {
  apiError,
  newId,
  normalizeText,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  textIncludes,
  validationError,
} from "@/mocks/helpers";
import { persist, store } from "@/mocks/store";
import { systemFinancialCategoryId } from "@/mocks/seed";
import { auditLogService } from "./auditLogService";
import { applyRecurringAutoPayments } from "./onlinePaymentsService";
import { openPayoutPreviews } from "./teacherPayService";

/**
 * Financeiro do negocio (plano pago). Le as cobrancas dos alunos (Charge) e os
 * pagamentos de professores (TeacherPayout) como fontes de caixa, sem duplicar;
 * `FinancialEntry` cobre so os lancamentos manuais. Recorrencias materializam
 * de forma idempotente em toda leitura, ate o mes seguinte ao atual.
 * Datas sempre pela data LOCAL. Especificacao: docs/technical/05.
 */

function clone<T>(value: T): T {
  return structuredClone(value);
}

function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function currentCompetence(): string {
  return format(new Date(), "yyyy-MM");
}

/** "2026-09-10" -> "10/09/2026" (sem passar por Date, evita UTC). */
function dateLabel(date: string): string {
  return date.split("-").reverse().join("/");
}

/** "2026-10" -> "outubro". */
function monthName(competence: string): string {
  return format(parseISO(`${competence}-01`), "MMMM", { locale: ptBR });
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function isEntryType(value: unknown): value is FinancialEntryType {
  return value === "income" || value === "expense";
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod);
}

function conflict(message: string) {
  return apiError("VALIDATION", message, { httpStatus: 409 });
}

// --- Categorias -------------------------------------------------------------

function categoryOf(id?: Id): FinancialCategory | undefined {
  return id ? store.financialCategories.find((c) => c.id === id) : undefined;
}

/** Id da categoria de sistema (pela chave; cai no id deterministico do seed). */
function systemCategoryId(key: FinancialSystemCategoryKey): Id {
  return (
    store.financialCategories.find((c) => c.systemKey === key)?.id ??
    systemFinancialCategoryId(store.organization.id, key)
  );
}

function categoryName(id?: Id, fallback = "Sem categoria"): string {
  return categoryOf(id)?.name ?? fallback;
}

function isDuplicateCategory(type: FinancialEntryType, name: string, exceptId?: Id): boolean {
  const target = normalizeText(name);
  return store.financialCategories.some(
    (c) => c.type === type && c.id !== exceptId && normalizeText(c.name) === target,
  );
}

function sortCategories(list: FinancialCategory[]): FinancialCategory[] {
  return [...list].sort(
    (a, b) =>
      a.type.localeCompare(b.type) ||
      Number(Boolean(b.system)) - Number(Boolean(a.system)) ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
}

// --- Recorrencia (materializacao idempotente) -------------------------------

function recurrenceEntry(r: FinancialRecurrence, competence: string, ts: string): FinancialEntry {
  return {
    id: newId(),
    organizationId: r.organizationId,
    unitId: store.unit.id,
    type: r.type,
    categoryId: r.categoryId,
    description: r.description,
    amountCents: r.amountCents,
    dueDate: recurrenceDueDate(r, competence),
    status: "pending",
    recurrenceId: r.id,
    recurrenceCompetence: competence,
    createdAt: ts,
    updatedAt: ts,
  };
}

/** Cria os lancamentos que faltam de cada recorrencia ativa. Devolve quantos criou. */
function materializeAll(): number {
  const upTo = addCompetence(currentCompetence(), 1);
  const ts = nowIso();
  let created = 0;
  for (const r of store.financialRecurrences) {
    const existing = store.financialEntries
      .filter((e) => e.recurrenceId === r.id && e.recurrenceCompetence)
      .map((e) => e.recurrenceCompetence!);
    for (const competence of materializeRecurrence(r, existing, upTo)) {
      store.financialEntries.push(recurrenceEntry(r, competence, ts));
      created += 1;
    }
  }
  return created;
}

/** Garante a materializacao numa leitura (persiste so se criou algo). */
function ensureMaterialized(): void {
  // Pix Automatico antes de ler: o Resumo nao depende de alguem abrir Mensalidades.
  applyRecurringAutoPayments();
  if (materializeAll() > 0) persist();
}

/** Competencias com previa de professor que ainda pode vencer: mes anterior e atual. */
function previewCompetences(): string[] {
  const current = currentCompetence();
  const [y, m] = current.split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  return [prev, current];
}

/** Previas abertas de pagamento de professor (entram no "A pagar"). */
function openPreviews() {
  return previewCompetences().flatMap((c) => openPayoutPreviews(c));
}

// --- Fontes de caixa --------------------------------------------------------

/** Status efetivo da cobranca (atraso derivado, como em Mensalidades). */
function chargeStatus(c: Charge): FinancialEntryDisplayStatus {
  if (c.status === "pending" || c.status === "overdue") {
    return c.dueDate < todayISO() ? "overdue" : "pending";
  }
  return c.status;
}

function chargeCompetence(c: Charge): string {
  return c.competence ?? competenceOf(c.dueDate);
}

function chargeCategoryId(kind: ChargeKind): Id {
  return systemCategoryId(kind === "dropin" ? "dropins" : "memberships");
}

/** Pagamento de professor persistido (fechado/pago) como item de caixa. */
function payoutStatus(p: TeacherPayout): FinancialEntryDisplayStatus | null {
  if (p.status === "paid") return "paid";
  if (p.status === "closed") return p.dueDate < todayISO() ? "overdue" : "pending";
  return null; // previa aberta ou cancelado nao entram
}

function professionalName(id: Id): string {
  return store.professionals.find((p) => p.id === id)?.name ?? "Professor";
}

/** Todos os itens de caixa do tenant (cobrancas, lancamentos, professores). */
function cashFlowItems(): CashFlowItem[] {
  const items: CashFlowItem[] = [];
  for (const c of store.charges) {
    if (c.status === "canceled") continue;
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

// --- Read-model da aba Lancamentos ------------------------------------------

function toEntryView(e: FinancialEntry, today: string): FinanceEntryView {
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
    everPaid: wasEverPaid(e),
    recurrenceActive: e.recurrenceId
      ? store.financialRecurrences.some((r) => r.id === e.recurrenceId && r.status === "active")
      : undefined,
  };
}

const CHARGE_ROW_TITLE: Record<ChargeKind, string> = {
  membership: "Mensalidades",
  dropin: "Aulas avulsas",
};

/** Linha agregada das cobrancas de um kind na competencia (D7). */
function chargeAggregateRow(
  kind: ChargeKind,
  competence: string,
  charges: Charge[],
): FinanceEntryView | null {
  const active = charges.filter((c) => c.status !== "canceled");
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

function payoutRow(p: TeacherPayout): FinanceEntryView | null {
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

// --- Validacao --------------------------------------------------------------

function validateCategoryRef(
  categoryId: Id | undefined,
  type: FinancialEntryType | undefined,
  fields: ApiErrorField[],
): void {
  if (!categoryId) {
    fields.push({ field: "categoryId", message: "Selecione a categoria." });
    return;
  }
  const category = categoryOf(categoryId);
  if (!category) {
    fields.push({ field: "categoryId", message: "Categoria não encontrada." });
  } else if (category.system) {
    fields.push({
      field: "categoryId",
      message: "Esta categoria é automática e não pode ser usada num lançamento manual.",
    });
  } else if (category.status !== "active") {
    fields.push({ field: "categoryId", message: "Esta categoria está inativa." });
  } else if (type && category.type !== type) {
    fields.push({
      field: "categoryId",
      message: `Escolha uma categoria de ${type === "income" ? "entrada" : "saída"}.`,
    });
  }
}

function validateAmount(amount: unknown, fields: ApiErrorField[]): void {
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    fields.push({ field: "amountCents", message: "Informe um valor maior que zero." });
  }
}

function validateDescription(description: unknown, fields: ApiErrorField[]): void {
  if (typeof description !== "string" || !description.trim()) {
    fields.push({ field: "description", message: "Informe a descrição." });
  } else if (description.trim().length > 120) {
    fields.push({ field: "description", message: "Use no máximo 120 caracteres." });
  }
}

function validateCreate(payload: CreateFinancialEntry): void {
  const fields: ApiErrorField[] = [];
  if (!isEntryType(payload.type)) {
    fields.push({ field: "type", message: "Escolha entre entrada e saída." });
  }
  validateCategoryRef(payload.categoryId, isEntryType(payload.type) ? payload.type : undefined, fields);
  validateDescription(payload.description, fields);
  validateAmount(payload.amountCents, fields);
  if (!isValidDate(payload.dueDate)) {
    fields.push({ field: "dueDate", message: "Informe uma data de vencimento válida." });
  } else if (payload.repeatMonthly && Number(payload.dueDate.slice(8, 10)) > 28) {
    fields.push({
      field: "dueDate",
      message: "Para repetir todo mês, escolha um vencimento entre os dias 1 e 28.",
    });
  }
  if (payload.paidNow && !isPaymentMethod(payload.paidNow.method)) {
    fields.push({ field: "method", message: "Selecione a forma de pagamento." });
  }
  if (fields.length > 0) throw validationError(fields);
}

function validateUpdate(entry: FinancialEntry, payload: UpdateFinancialEntry): void {
  const fields: ApiErrorField[] = [];
  if (payload.categoryId !== undefined && payload.categoryId !== entry.categoryId) {
    validateCategoryRef(payload.categoryId, entry.type, fields);
  }
  if (payload.description !== undefined) validateDescription(payload.description, fields);
  if (payload.amountCents !== undefined) validateAmount(payload.amountCents, fields);
  if (payload.dueDate !== undefined && !isValidDate(payload.dueDate)) {
    fields.push({ field: "dueDate", message: "Informe uma data de vencimento válida." });
  }
  if (fields.length > 0) throw validationError(fields);
}

// --- Auditoria --------------------------------------------------------------

const PAID_STATUS_LABEL = "Pago";

function entryLabel(e: FinancialEntry): string {
  return `${financialEntryTypeLabel(e.type).toLowerCase()} ${e.description}`;
}

function entryFacts(e: FinancialEntry): string {
  return `(${formatCents(e.amountCents)}, vence ${dateLabel(e.dueDate)})`;
}

function recordEntry(
  e: FinancialEntry,
  action: "created" | "updated" | "deleted" | "cancelled" | "status_changed" | "inactivated",
  predicate: string,
  changes?: AuditChange[],
): void {
  auditLogService.record({
    action,
    target: { type: "financial_entry", id: e.id, label: e.description },
    predicate,
    changes,
  });
}

/** Ja foi pago alguma vez? (pago agora ou evento de pagamento na auditoria). */
function wasEverPaid(e: FinancialEntry): boolean {
  if (e.status === "paid" || e.paidAt) return true;
  return store.auditLog.some(
    (log) =>
      log.target.type === "financial_entry" &&
      log.target.id === e.id &&
      (log.changes ?? []).some((c) => c.field === "status" && c.after === PAID_STATUS_LABEL),
  );
}

function describeChanges(before: FinancialEntry, after: FinancialEntry): AuditChange[] {
  const changes: AuditChange[] = [];
  if (before.description !== after.description) {
    changes.push({ field: "description", label: "Descrição", before: before.description, after: after.description });
  }
  if (before.categoryId !== after.categoryId) {
    changes.push({
      field: "categoryId",
      label: "Categoria",
      before: categoryName(before.categoryId),
      after: categoryName(after.categoryId),
    });
  }
  if (before.amountCents !== after.amountCents) {
    changes.push({
      field: "amountCents",
      label: "Valor",
      before: formatCents(before.amountCents),
      after: formatCents(after.amountCents),
    });
  }
  if (before.dueDate !== after.dueDate) {
    changes.push({ field: "dueDate", label: "Vencimento", before: dateLabel(before.dueDate), after: dateLabel(after.dueDate) });
  }
  if ((before.notes ?? "") !== (after.notes ?? "")) {
    changes.push({ field: "notes", label: "Observações", before: before.notes ?? "", after: after.notes ?? "" });
  }
  return changes;
}

function findEntry(id: Id): FinancialEntry {
  const e = store.financialEntries.find((x) => x.id === id);
  if (!e) throw notFoundError("Lançamento não encontrado.");
  return e;
}

function applyPatch(e: FinancialEntry, payload: UpdateFinancialEntry, ts: string): void {
  if (payload.categoryId !== undefined) e.categoryId = payload.categoryId;
  if (payload.description !== undefined) e.description = payload.description.trim();
  if (payload.amountCents !== undefined) e.amountCents = payload.amountCents;
  if (payload.dueDate !== undefined) e.dueDate = payload.dueDate;
  if (payload.notes !== undefined) e.notes = payload.notes.trim() || undefined;
  e.updatedAt = ts;
}

// --- Service ----------------------------------------------------------------

export const financeService = {
  /** Cartoes do Resumo da competencia (fontes da secao 4.1; atrasado conforme secao 14). */
  getSummary(competence: string): Promise<FinanceSummary> {
    return simulateRead(() => {
      ensureMaterialized();
      return summarizeCashFlow(cashFlowItems(), competence, todayISO());
    });
  },

  /** Entradas x saidas pagas nos ultimos `months` meses, terminando em `endCompetence`. */
  getMonthlySeries(months = 6, endCompetence: string = currentCompetence()): Promise<FinanceMonthPoint[]> {
    return simulateRead(() => {
      ensureMaterialized();
      return summarizeMonthlySeries(cashFlowItems(), lastCompetences(endCompetence, months));
    });
  },

  /** Totais pagos por categoria na competencia, com percentual. */
  getByCategory(competence: string): Promise<FinanceCategoryTotal[]> {
    return simulateRead(() => {
      ensureMaterialized();
      return summarizeByCategory(cashFlowItems(), store.financialCategories, competence);
    });
  },

  /**
   * Proximos vencimentos (contas a pagar e pagamentos de professores fechados)
   * ate `days` dias a partir de hoje. Inclui os ja vencidos em aberto (overdue).
   */
  getUpcoming(days = 7): Promise<FinanceUpcomingItem[]> {
    return simulateRead(() => {
      ensureMaterialized();
      const today = todayISO();
      const limit = format(addDays(parseISO(today), days), "yyyy-MM-dd");
      const items: FinanceUpcomingItem[] = [];
      for (const e of store.financialEntries) {
        if (e.type !== "expense" || e.status !== "pending" || e.dueDate > limit) continue;
        items.push({
          id: e.id,
          source: "entry",
          description: e.description,
          amountCents: e.amountCents,
          dueDate: e.dueDate,
          overdue: e.dueDate < today,
        });
      }
      for (const p of store.teacherPayouts) {
        if (p.status !== "closed" || p.dueDate > limit || p.totalCents <= 0) continue;
        items.push({
          id: p.id,
          source: "teacher_payout",
          description: `Pagamento de ${professionalName(p.professionalId)} (${monthName(p.competence)})`,
          amountCents: p.totalCents,
          dueDate: p.dueDate,
          overdue: p.dueDate < today,
        });
      }
      for (const p of openPreviews()) {
        if (p.dueDate > limit) continue;
        items.push({
          id: `preview:${p.professionalId}:${p.competence}`,
          source: "teacher_payout",
          description: `Pagamento de ${p.professionalName} (${monthName(p.competence)}, prévia)`,
          amountCents: p.totalCents,
          dueDate: p.dueDate,
          overdue: p.dueDate < today,
        });
      }
      return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.description.localeCompare(b.description, "pt-BR"));
    });
  },

  /**
   * Lista unificada do mes: agregados das cobrancas dos alunos (uma linha por
   * kind, D7), pagamentos de professores fechados/pagos e lancamentos manuais.
   */
  listEntries(filter?: FinancialEntryFilter): Promise<FinanceEntryView[]> {
    return simulateRead(() => {
      ensureMaterialized();
      const competence = filter?.competence ?? currentCompetence();
      const today = todayISO();
      const rows: FinanceEntryView[] = [];

      const charges = store.charges.filter((c) => chargeCompetence(c) === competence);
      for (const kind of ["membership", "dropin"] as const) {
        const row = chargeAggregateRow(kind, competence, charges.filter((c) => c.kind === kind));
        if (row) rows.push(row);
      }
      for (const p of store.teacherPayouts) {
        if (competenceOf(p.dueDate) !== competence) continue;
        const row = payoutRow(p);
        if (row) rows.push(row);
      }
      for (const e of store.financialEntries) {
        if (competenceOf(e.dueDate) === competence) rows.push(toEntryView(e, today));
      }

      let result = rows;
      if (filter?.type) result = result.filter((r) => r.type === filter.type);
      if (filter?.status) {
        const wanted = filter.status;
        result = result.filter((r) =>
          r.source === "charge" && r.chargeCounts
            ? wanted === "paid"
              ? r.chargeCounts.paid > 0
              : wanted === "pending"
                ? r.chargeCounts.pending > 0
                : wanted === "overdue"
                  ? r.chargeCounts.overdue > 0
                  : false
            : r.status === wanted,
        );
      }
      if (filter?.categoryId) result = result.filter((r) => r.categoryId === filter.categoryId);
      if (filter?.search?.trim()) {
        const term = filter.search;
        result = result.filter(
          (r) => textIncludes(r.description, term) || textIncludes(r.categoryName, term),
        );
      }

      const sourceOrder = { charge: 0, teacher_payout: 1, entry: 2 } as const;
      return clone(
        result.sort(
          (a, b) =>
            sourceOrder[a.source] - sourceOrder[b.source] ||
            a.dueDate.localeCompare(b.dueDate) ||
            a.description.localeCompare(b.description, "pt-BR"),
        ),
      );
    });
  },

  /**
   * Novo lancamento manual. `paidNow` grava como pago agora; `repeatMonthly`
   * cria a recorrencia a partir do mes do vencimento e materializa os meses
   * seguintes (ate o mes seguinte ao atual). Devolve o primeiro lancamento.
   */
  createEntry(payload: CreateFinancialEntry): Promise<FinancialEntry> {
    return simulateWrite(() => {
      validateCreate(payload);
      const ts = nowIso();
      const organizationId = store.organization.id;
      const description = payload.description.trim();
      let recurrence: FinancialRecurrence | undefined;
      if (payload.repeatMonthly) {
        recurrence = {
          id: newId(),
          organizationId,
          type: payload.type,
          categoryId: payload.categoryId,
          description,
          amountCents: payload.amountCents,
          dayOfMonth: Number(payload.dueDate.slice(8, 10)),
          startCompetence: competenceOf(payload.dueDate),
          status: "active",
          createdAt: ts,
          updatedAt: ts,
        };
        store.financialRecurrences.push(recurrence);
      }
      const entry: FinancialEntry = {
        id: newId(),
        organizationId,
        unitId: store.unit.id,
        type: payload.type,
        categoryId: payload.categoryId,
        description,
        amountCents: payload.amountCents,
        dueDate: payload.dueDate,
        status: payload.paidNow ? "paid" : "pending",
        ...(payload.paidNow ? { paidAt: ts, method: payload.paidNow.method } : {}),
        ...(recurrence
          ? { recurrenceId: recurrence.id, recurrenceCompetence: recurrence.startCompetence }
          : {}),
        ...(payload.notes?.trim() ? { notes: payload.notes.trim() } : {}),
        createdAt: ts,
        updatedAt: ts,
      };
      store.financialEntries.push(entry);
      if (recurrence) materializeAll();

      const paidNote = payload.paidNow ? `, pago via ${paymentMethodLabel(payload.paidNow.method)}` : "";
      const repeatNote = recurrence ? ", com repetição mensal" : "";
      recordEntry(
        entry,
        "created",
        `lançou a ${entryLabel(entry)} ${entryFacts(entry).slice(0, -1)}${paidNote}${repeatNote})`,
        payload.paidNow
          ? [{ field: "status", label: "Status", before: "", after: PAID_STATUS_LABEL }]
          : undefined,
      );
      return clone(entry);
    });
  },

  /**
   * Edita um lancamento. Em serie, `scope = "following"` atualiza tambem a
   * recorrencia e os lancamentos PENDENTES das competencias seguintes.
   */
  updateEntry(
    id: Id,
    payload: UpdateFinancialEntry,
    scope: FinancialEntryUpdateScope = "single",
  ): Promise<FinancialEntry> {
    return simulateWrite(() => {
      const entry = findEntry(id);
      if (entry.status === "canceled") {
        throw conflict("Lançamento cancelado não pode ser editado.");
      }
      validateUpdate(entry, payload);
      if (
        scope === "following" &&
        entry.recurrenceId &&
        payload.dueDate !== undefined &&
        Number(payload.dueDate.slice(8, 10)) > 28
      ) {
        throw validationError([
          { field: "dueDate", message: "Para a repetição mensal, escolha um vencimento entre os dias 1 e 28." },
        ]);
      }
      const ts = nowIso();
      const before = clone(entry);
      applyPatch(entry, payload, ts);
      const changes = describeChanges(before, entry);

      let following = 0;
      const recurrence =
        scope === "following" && entry.recurrenceId
          ? store.financialRecurrences.find((r) => r.id === entry.recurrenceId)
          : undefined;
      if (recurrence) {
        if (payload.categoryId !== undefined) recurrence.categoryId = payload.categoryId;
        if (payload.description !== undefined) recurrence.description = payload.description.trim();
        if (payload.amountCents !== undefined) recurrence.amountCents = payload.amountCents;
        if (payload.dueDate !== undefined) recurrence.dayOfMonth = Number(payload.dueDate.slice(8, 10));
        recurrence.updatedAt = ts;
        const from = entry.recurrenceCompetence ?? competenceOf(entry.dueDate);
        for (const other of store.financialEntries) {
          if (
            other.id === entry.id ||
            other.recurrenceId !== recurrence.id ||
            other.status !== "pending" ||
            (other.recurrenceCompetence ?? competenceOf(other.dueDate)) <= from
          ) {
            continue;
          }
          applyPatch(
            other,
            {
              categoryId: payload.categoryId,
              description: payload.description,
              amountCents: payload.amountCents,
              dueDate:
                payload.dueDate !== undefined
                  ? recurrenceDueDate(recurrence, other.recurrenceCompetence ?? competenceOf(other.dueDate))
                  : undefined,
            },
            ts,
          );
          following += 1;
        }
      }

      if (changes.length > 0 || following > 0) {
        const scopeNote =
          following > 0 ? ` e ${plural(following, "lançamento seguinte", "lançamentos seguintes")} da repetição` : "";
        recordEntry(entry, "updated", `editou a ${entryLabel(entry)}${scopeNote}`, changes);
      }
      return clone(entry);
    });
  },

  /** Marca como pago agora (exige forma de pagamento). */
  markEntryPaid(id: Id, method: PaymentMethod): Promise<FinancialEntry> {
    return simulateWrite(() => {
      const entry = findEntry(id);
      if (!isPaymentMethod(method)) {
        throw validationError([{ field: "method", message: "Selecione a forma de pagamento." }]);
      }
      if (entry.status === "paid") throw conflict("Este lançamento já está pago.");
      if (entry.status === "canceled") throw conflict("Lançamento cancelado não pode ser pago.");
      const ts = nowIso();
      entry.status = "paid";
      entry.paidAt = ts;
      entry.method = method;
      entry.updatedAt = ts;
      recordEntry(
        entry,
        "status_changed",
        `registrou o pagamento da ${entryLabel(entry)} ${entryFacts(entry).slice(0, -1)}, via ${paymentMethodLabel(method)})`,
        [{ field: "status", label: "Status", before: "Pendente", after: PAID_STATUS_LABEL }],
      );
      return clone(entry);
    });
  },

  /** Desfaz o pagamento (volta a pendente; atraso derivado na leitura). */
  markEntryPending(id: Id): Promise<FinancialEntry> {
    return simulateWrite(() => {
      const entry = findEntry(id);
      if (entry.status !== "paid") throw conflict("Só é possível desfazer um lançamento pago.");
      const method = entry.method;
      entry.status = "pending";
      entry.paidAt = undefined;
      entry.method = undefined;
      entry.updatedAt = nowIso();
      recordEntry(
        entry,
        "status_changed",
        `desfez o pagamento da ${entryLabel(entry)} ${entryFacts(entry)}`,
        [
          {
            field: "status",
            label: "Status",
            before: method ? `${PAID_STATUS_LABEL} (${paymentMethodLabel(method)})` : PAID_STATUS_LABEL,
            after: "Pendente",
          },
        ],
      );
      return clone(entry);
    });
  },

  /** Cancela (mantem no historico, sai dos totais). Pago precisa desfazer antes. */
  cancelEntry(id: Id): Promise<FinancialEntry> {
    return simulateWrite(() => {
      const entry = findEntry(id);
      if (entry.status === "canceled") throw conflict("Este lançamento já está cancelado.");
      if (entry.status === "paid") {
        throw conflict("Desfaça o pagamento antes de cancelar o lançamento.");
      }
      entry.status = "canceled";
      entry.updatedAt = nowIso();
      recordEntry(entry, "cancelled", `cancelou a ${entryLabel(entry)} ${entryFacts(entry)}`);
      return clone(entry);
    });
  },

  /**
   * Exclui de verdade (D2): so se nunca foi pago. Lancamento de repeticao nao
   * e excluido (a materializacao recriaria o mes): cancele ou encerre a repeticao.
   */
  deleteEntry(id: Id): Promise<void> {
    return simulateWrite(() => {
      const entry = findEntry(id);
      if (wasEverPaid(entry)) {
        throw conflict("Lançamento que já foi pago não pode ser excluído. Cancele em vez disso.");
      }
      if (entry.recurrenceId) {
        throw conflict("Lançamento de repetição não pode ser excluído. Cancele ou encerre a repetição.");
      }
      store.financialEntries = store.financialEntries.filter((e) => e.id !== id);
      recordEntry(entry, "deleted", `excluiu a ${entryLabel(entry)} ${entryFacts(entry)}`);
    });
  },

  /** Encerra a repeticao: inativa e cancela os pendentes com vencimento de hoje em diante. */
  endRecurrence(recurrenceId: Id): Promise<{ canceled: number }> {
    return simulateWrite(() => {
      const recurrence = store.financialRecurrences.find((r) => r.id === recurrenceId);
      if (!recurrence) throw notFoundError("Repetição não encontrada.");
      if (recurrence.status !== "active") throw conflict("Esta repetição já foi encerrada.");
      const ts = nowIso();
      const today = todayISO();
      recurrence.status = "inactive";
      recurrence.endCompetence = currentCompetence();
      recurrence.updatedAt = ts;
      let canceled = 0;
      for (const e of store.financialEntries) {
        if (e.recurrenceId !== recurrenceId || e.status !== "pending" || e.dueDate < today) continue;
        e.status = "canceled";
        e.updatedAt = ts;
        canceled += 1;
      }
      auditLogService.record({
        action: "inactivated",
        target: { type: "financial_entry", id: recurrence.id, label: recurrence.description },
        predicate: `encerrou a repetição mensal da ${financialEntryTypeLabel(recurrence.type).toLowerCase()} ${recurrence.description}${canceled > 0 ? ` e cancelou ${plural(canceled, "lançamento pendente", "lançamentos pendentes")}` : ""}`,
      });
      return { canceled };
    });
  },

  // --- Categorias -----------------------------------------------------------

  listCategories(filter?: FinancialCategoryFilter): Promise<FinancialCategory[]> {
    return simulateRead(() => {
      let result = store.financialCategories;
      if (filter?.type) result = result.filter((c) => c.type === filter.type);
      if (filter?.status) result = result.filter((c) => c.status === filter.status);
      if (filter?.includeSystem === false) result = result.filter((c) => !c.system);
      return clone(sortCategories(result));
    });
  },

  createCategory(payload: CreateFinancialCategory): Promise<FinancialCategory> {
    return simulateWrite(() => {
      const fields: ApiErrorField[] = [];
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      if (!isEntryType(payload.type)) fields.push({ field: "type", message: "Escolha entre entrada e saída." });
      if (!name) fields.push({ field: "name", message: "Informe o nome da categoria." });
      else if (name.length > 60) fields.push({ field: "name", message: "Use no máximo 60 caracteres." });
      else if (isEntryType(payload.type) && isDuplicateCategory(payload.type, name)) {
        fields.push({ field: "name", message: "Já existe uma categoria com esse nome." });
      }
      if (fields.length > 0) throw validationError(fields);
      const ts = nowIso();
      const category: FinancialCategory = {
        id: newId(),
        organizationId: store.organization.id,
        type: payload.type,
        name,
        status: "active",
        createdAt: ts,
        updatedAt: ts,
      };
      store.financialCategories.push(category);
      auditLogService.record({
        action: "created",
        target: { type: "financial_category", id: category.id, label: category.name },
        predicate: `criou a categoria de ${financialEntryTypeLabel(category.type).toLowerCase()} ${category.name}`,
      });
      return clone(category);
    });
  },

  /** Renomeia, inativa ou reativa. Categorias de sistema ficam travadas. */
  updateCategory(id: Id, payload: UpdateFinancialCategory): Promise<FinancialCategory> {
    return simulateWrite(() => {
      const idx = store.financialCategories.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError("Categoria não encontrada.");
      const current = store.financialCategories[idx];
      if (current.system) {
        throw conflict("Categoria do sistema não pode ser renomeada nem inativada.");
      }
      const fields: ApiErrorField[] = [];
      let name = current.name;
      if (payload.name !== undefined) {
        name = payload.name.trim();
        if (!name) fields.push({ field: "name", message: "Informe o nome da categoria." });
        else if (name.length > 60) fields.push({ field: "name", message: "Use no máximo 60 caracteres." });
        else if (isDuplicateCategory(current.type, name, id)) {
          fields.push({ field: "name", message: "Já existe uma categoria com esse nome." });
        }
      }
      if (payload.status !== undefined && payload.status !== "active" && payload.status !== "inactive") {
        fields.push({ field: "status", message: "Status inválido." });
      }
      if (fields.length > 0) throw validationError(fields);
      const updated: FinancialCategory = {
        ...current,
        name,
        status: payload.status ?? current.status,
        updatedAt: nowIso(),
      };
      store.financialCategories[idx] = updated;
      const reactivated = current.status !== "active" && updated.status === "active";
      const inactivated = current.status === "active" && updated.status !== "active";
      auditLogService.record({
        action: reactivated ? "activated" : inactivated ? "inactivated" : "updated",
        target: { type: "financial_category", id, label: updated.name },
        predicate: `${reactivated ? "reativou" : inactivated ? "inativou" : "atualizou"} a categoria financeira ${updated.name}`,
        changes:
          current.name !== updated.name
            ? [{ field: "name", label: "Nome", before: current.name, after: updated.name }]
            : undefined,
      });
      return clone(updated);
    });
  },
};
