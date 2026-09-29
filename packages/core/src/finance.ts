import type {
  DateISO,
  FinanceCategoryTotal,
  FinanceMonthPoint,
  FinanceSummary,
  FinancialEntryDisplayStatus,
  FinancialEntryStatus,
  FinancialEntryType,
  FinancialRecurrence,
  Id,
  TeacherPayComponent,
  TeacherPayoutLine,
  TeacherPayRule,
  TeacherPaySessionFact,
} from "@gestarahub/contracts";

/**
 * Regras puras do Financeiro (sem store). O service monta os fatos e chama
 * estas funcoes; a mesma regra serve para o resumo, a previa e o fechamento.
 * Especificacao: docs/technical/05-modulo-financeiro.
 *
 * Sem imports de runtime de outros modulos do core (os testes rodam com
 * `node --test` direto nos .ts).
 */

// Formatador local (mesmo formato de format.formatCents).
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function brl(cents: number): string {
  return BRL.format(cents / 100);
}

function countLabel(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// ---------------------------------------------------------------------------
// Datas e competencias ("YYYY-MM"), sempre pela data LOCAL
// ---------------------------------------------------------------------------

/** Data local 'YYYY-MM-DD' de um DateISO ou de um timestamp ISO (evita o bug de UTC). */
export function localDateOf(value: string): DateISO {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Competencia "YYYY-MM" de uma data ou timestamp (data local). */
export function competenceOf(value: string): string {
  return localDateOf(value).slice(0, 7);
}

/** Soma `months` a uma competencia ("2026-12" + 1 = "2027-01"). */
export function addCompetence(competence: string, months: number): string {
  const [y, m] = competence.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  return `${Math.floor(index / 12)}-${pad2((index % 12) + 1)}`;
}

/** Competencias de `from` a `to`, inclusive (vazio se from > to). */
export function competenceRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let c = from; c <= to; c = addCompetence(c, 1)) out.push(c);
  return out;
}

/** Ultimas `count` competencias terminando em `last` (ordem cronologica). */
export function lastCompetences(last: string, count: number): string[] {
  return competenceRange(addCompetence(last, -(count - 1)), last);
}

/** Ultimo dia da competencia ('YYYY-MM-DD'). */
export function lastDayOfCompetence(competence: string): DateISO {
  const [y, m] = competence.split("-").map(Number);
  const day = new Date(y, m, 0).getDate();
  return `${competence}-${pad2(day)}`;
}

/** Primeiro dia da competencia. */
export function firstDayOfCompetence(competence: string): DateISO {
  return `${competence}-01`;
}

/** Data do dia `day` (1..28, limitado) na competencia. */
export function dateInCompetence(competence: string, day: number): DateISO {
  const safe = Math.min(28, Math.max(1, Math.trunc(day) || 1));
  return `${competence}-${pad2(safe)}`;
}

/** Dia padrao do pagamento do professor (D6). */
export const DEFAULT_TEACHER_PAYMENT_DAY = 5;

/** Vencimento do pagamento do professor: dia da regra no mes seguinte (D6). */
export function teacherPayoutDueDate(
  competence: string,
  paymentDay: number = DEFAULT_TEACHER_PAYMENT_DAY,
): DateISO {
  return dateInCompetence(addCompetence(competence, 1), paymentDay);
}

// ---------------------------------------------------------------------------
// Status derivado
// ---------------------------------------------------------------------------

/** Atrasado = pending com vencimento antes de hoje (derivado, como nas cobrancas). */
export function isEntryOverdue(
  entry: { status: FinancialEntryStatus | FinancialEntryDisplayStatus; dueDate: DateISO },
  today: DateISO,
): boolean {
  if (entry.status === "overdue") return true;
  return entry.status === "pending" && entry.dueDate < today;
}

/** Status exibido de um lancamento (inclui o derivado `overdue`). */
export function entryDisplayStatus(
  entry: { status: FinancialEntryStatus; dueDate: DateISO },
  today: DateISO,
): FinancialEntryDisplayStatus {
  return isEntryOverdue(entry, today) ? "overdue" : entry.status;
}

// ---------------------------------------------------------------------------
// Fluxo de caixa
// ---------------------------------------------------------------------------

/**
 * Item de caixa normalizado: cobranca de aluno, lancamento manual ou pagamento
 * de professor, ja convertidos pelo service. `status` aceita o `overdue`
 * gravado das cobrancas; o derivado e calculado aqui.
 */
export interface CashFlowItem {
  type: FinancialEntryType;
  amountCents: number;
  dueDate: DateISO;
  status: FinancialEntryDisplayStatus;
  paidAt?: string;
  categoryId?: Id;
}

function isPaid(item: CashFlowItem): boolean {
  return item.status === "paid" && Boolean(item.paidAt);
}

function isOpen(item: CashFlowItem): boolean {
  return item.status === "pending" || item.status === "overdue";
}

/**
 * Cartoes do Resumo de uma competencia:
 * - entrou/saiu: pagos com `paidAt` (data local) na competencia;
 * - a receber/a pagar: vencimento na competencia e ainda em aberto;
 * - atrasado: em aberto com vencimento na competencia e antes de hoje.
 */
export function summarizeCashFlow(
  items: readonly CashFlowItem[],
  competence: string,
  today: DateISO,
): FinanceSummary {
  const summary: FinanceSummary = {
    competence,
    incomePaidCents: 0,
    expensePaidCents: 0,
    resultCents: 0,
    incomeForecastCents: 0,
    expenseForecastCents: 0,
    incomeOverdueCents: 0,
    expenseOverdueCents: 0,
  };
  for (const item of items) {
    const income = item.type === "income";
    if (isPaid(item) && competenceOf(item.paidAt!) === competence) {
      if (income) summary.incomePaidCents += item.amountCents;
      else summary.expensePaidCents += item.amountCents;
      continue;
    }
    if (!isOpen(item) || competenceOf(item.dueDate) !== competence) continue;
    if (income) summary.incomeForecastCents += item.amountCents;
    else summary.expenseForecastCents += item.amountCents;
    if (item.status === "overdue" || item.dueDate < today) {
      if (income) summary.incomeOverdueCents += item.amountCents;
      else summary.expenseOverdueCents += item.amountCents;
    }
  }
  summary.resultCents = summary.incomePaidCents - summary.expensePaidCents;
  return summary;
}

/** Serie entradas x saidas pagas por competencia (grafico do Resumo). */
export function summarizeMonthlySeries(
  items: readonly CashFlowItem[],
  competences: readonly string[],
): FinanceMonthPoint[] {
  const byComp = new Map<string, FinanceMonthPoint>(
    competences.map((c) => [c, { competence: c, incomeCents: 0, expenseCents: 0, resultCents: 0 }]),
  );
  for (const item of items) {
    if (!isPaid(item)) continue;
    const point = byComp.get(competenceOf(item.paidAt!));
    if (!point) continue;
    if (item.type === "income") point.incomeCents += item.amountCents;
    else point.expenseCents += item.amountCents;
  }
  for (const point of byComp.values()) point.resultCents = point.incomeCents - point.expenseCents;
  return competences.map((c) => byComp.get(c)!);
}

/**
 * Totais pagos na competencia por categoria, com o percentual sobre o total do
 * mesmo tipo. Itens sem categoria sao ignorados. Ordem: maior total primeiro.
 */
export function summarizeByCategory(
  items: readonly CashFlowItem[],
  categories: ReadonlyArray<{ id: Id; name: string; type: FinancialEntryType; system?: boolean }>,
  competence: string,
): FinanceCategoryTotal[] {
  const totals = new Map<Id, number>();
  const typeTotals: Record<FinancialEntryType, number> = { income: 0, expense: 0 };
  for (const item of items) {
    if (!item.categoryId || !isPaid(item) || competenceOf(item.paidAt!) !== competence) continue;
    totals.set(item.categoryId, (totals.get(item.categoryId) ?? 0) + item.amountCents);
    typeTotals[item.type] += item.amountCents;
  }
  const out: FinanceCategoryTotal[] = [];
  for (const category of categories) {
    const total = totals.get(category.id);
    if (!total) continue;
    const base = typeTotals[category.type];
    out.push({
      categoryId: category.id,
      categoryName: category.name,
      type: category.type,
      system: category.system,
      totalCents: total,
      percent: base > 0 ? Math.round((total / base) * 1000) / 10 : 0,
    });
  }
  return out.sort((a, b) => b.totalCents - a.totalCents);
}

// ---------------------------------------------------------------------------
// Recorrencia
// ---------------------------------------------------------------------------

/**
 * Competencias que ainda faltam materializar para a recorrencia, de
 * `startCompetence` ate `upToCompetence` (limitado por `endCompetence`), sem as
 * ja existentes. Idempotente: chamar de novo com o resultado aplicado devolve
 * vazio. Recorrencia inativa nao gera nada.
 */
export function materializeRecurrence(
  recurrence: Pick<FinancialRecurrence, "startCompetence" | "endCompetence" | "status">,
  existingCompetences: Iterable<string>,
  upToCompetence: string,
): string[] {
  if (recurrence.status !== "active") return [];
  const last =
    recurrence.endCompetence && recurrence.endCompetence < upToCompetence
      ? recurrence.endCompetence
      : upToCompetence;
  const existing = new Set(existingCompetences);
  return competenceRange(recurrence.startCompetence, last).filter((c) => !existing.has(c));
}

/** Vencimento do lancamento da recorrencia na competencia. */
export function recurrenceDueDate(
  recurrence: Pick<FinancialRecurrence, "dayOfMonth">,
  competence: string,
): DateISO {
  return dateInCompetence(competence, recurrence.dayOfMonth);
}

// ---------------------------------------------------------------------------
// Pagamento dos professores
// ---------------------------------------------------------------------------

/** Turma com o instrutor titular (quem recebe pelas matriculas). */
export interface TeacherPayClassGroup {
  id: Id;
  instructorId: Id;
}

/** Matricula considerada no calculo (o service ja filtrou as ativas). */
export interface TeacherPayEnrollment {
  studentId: Id;
  classGroupId: Id;
}

/** Mensalidade paga (membership) com `periodStart` na competencia. */
export interface TeacherPayMembership {
  chargeId: Id;
  studentId: Id;
  amountCents: number;
  /** Turma da cobranca; usada se o aluno nao tiver matricula nos fatos. */
  classGroupId?: Id;
}

/** Parte de uma mensalidade atribuida a um titular. */
export interface MembershipShare {
  professionalId: Id;
  amountCents: number;
  /** Turmas do titular em que o aluno esta (para a restricao `classGroupIds`). */
  classGroupIds: Id[];
}

export interface MembershipAttribution {
  chargeId: Id;
  studentId: Id;
  amountCents: number;
  shares: MembershipShare[];
  /** Sobra do arredondamento (fica com a academia). */
  remainderCents: number;
}

/**
 * Atribui cada mensalidade paga aos titulares das turmas do aluno (D4): divide
 * igualmente entre os titulares distintos, arredondando para baixo; a sobra
 * fica com a academia. Aluno sem turma conhecida nao gera parte.
 */
export function attributeMembershipsToTeachers(input: {
  memberships: readonly TeacherPayMembership[];
  enrollments: readonly TeacherPayEnrollment[];
  classGroups: readonly TeacherPayClassGroup[];
}): MembershipAttribution[] {
  const instructorOf = new Map(input.classGroups.map((g) => [g.id, g.instructorId]));
  const groupsByStudent = new Map<Id, Set<Id>>();
  for (const e of input.enrollments) {
    if (!instructorOf.has(e.classGroupId)) continue;
    const set = groupsByStudent.get(e.studentId) ?? new Set<Id>();
    set.add(e.classGroupId);
    groupsByStudent.set(e.studentId, set);
  }

  return input.memberships.map((m) => {
    let groups = [...(groupsByStudent.get(m.studentId) ?? [])];
    if (groups.length === 0 && m.classGroupId && instructorOf.has(m.classGroupId)) {
      groups = [m.classGroupId];
    }
    const byTeacher = new Map<Id, Id[]>();
    for (const g of groups) {
      const teacher = instructorOf.get(g)!;
      byTeacher.set(teacher, [...(byTeacher.get(teacher) ?? []), g]);
    }
    const count = byTeacher.size;
    if (count === 0) {
      return { chargeId: m.chargeId, studentId: m.studentId, amountCents: m.amountCents, shares: [], remainderCents: m.amountCents };
    }
    const each = Math.floor(m.amountCents / count);
    const shares = [...byTeacher.entries()].map(([professionalId, classGroupIds]) => ({
      professionalId,
      amountCents: each,
      classGroupIds,
    }));
    return {
      chargeId: m.chargeId,
      studentId: m.studentId,
      amountCents: m.amountCents,
      shares,
      remainderCents: m.amountCents - each * count,
    };
  });
}

/**
 * Fatos da competencia para calcular o pagamento de UM professor. Montados pelo
 * service (sem store aqui):
 * - `classGroups`: turmas com o titular (todas; o calculo filtra as dele);
 * - `sessionsDone`: sessoes dadas na competencia (status done, fim passado), com
 *   o instrutor efetivo (substituto conta para o substituto);
 * - `activeEnrollments`: matriculas ativas no ULTIMO dia da competencia (D3);
 * - `paidMemberships`: mensalidades pagas com `periodStart` na competencia
 *   (sem aulas avulsas, D5);
 * - `membershipEnrollments`: matriculas usadas para atribuir as mensalidades
 *   (padrao: `activeEnrollments`).
 */
export interface TeacherPayFacts {
  professionalId: Id;
  classGroups: readonly TeacherPayClassGroup[];
  sessionsDone: readonly TeacherPaySessionFact[];
  activeEnrollments: readonly TeacherPayEnrollment[];
  paidMemberships: readonly TeacherPayMembership[];
  membershipEnrollments?: readonly TeacherPayEnrollment[];
}

function allows(component: TeacherPayComponent, classGroupId: Id): boolean {
  return !component.classGroupIds || component.classGroupIds.length === 0
    ? true
    : component.classGroupIds.includes(classGroupId);
}

/** A regra vale na competencia? (ativa e com vigencia iniciada) */
export function isRuleEffective(
  rule: Pick<TeacherPayRule, "status" | "startCompetence">,
  competence: string,
): boolean {
  return rule.status === "active" && rule.startCompetence <= competence;
}

/** Aulas dadas pelo professor (instrutor efetivo) que a parte aceita. */
export function countedSessions(
  component: TeacherPayComponent,
  facts: TeacherPayFacts,
): TeacherPaySessionFact[] {
  return facts.sessionsDone.filter(
    (s) => s.instructorId === facts.professionalId && allows(component, s.classGroupId),
  );
}

/** Alunos distintos ativos nas turmas em que o professor e titular. */
export function countedStudents(
  component: TeacherPayComponent,
  facts: TeacherPayFacts,
): Id[] {
  const ownGroups = new Set(
    facts.classGroups
      .filter((g) => g.instructorId === facts.professionalId && allows(component, g.id))
      .map((g) => g.id),
  );
  const students = new Set<Id>();
  for (const e of facts.activeEnrollments) {
    if (ownGroups.has(e.classGroupId)) students.add(e.studentId);
  }
  return [...students];
}

/** Base do % (mensalidades pagas atribuidas ao professor, com a restricao). */
export function membershipBaseCents(
  component: TeacherPayComponent,
  facts: TeacherPayFacts,
): number {
  const attributions = attributeMembershipsToTeachers({
    memberships: facts.paidMemberships,
    enrollments: facts.membershipEnrollments ?? facts.activeEnrollments,
    classGroups: facts.classGroups,
  });
  let base = 0;
  for (const a of attributions) {
    for (const share of a.shares) {
      if (share.professionalId !== facts.professionalId) continue;
      if (share.classGroupIds.some((g) => allows(component, g))) base += share.amountCents;
    }
  }
  return base;
}

function formatPercent(percent: number): string {
  return `${String(percent).replace(".", ",")}%`;
}

/**
 * Linhas do pagamento de um professor na competencia, uma por parte da regra.
 * Regra fora de vigencia ou inativa devolve []. Valores em centavos, com
 * arredondamento para baixo (a sobra fica com a academia). Ajustes do
 * fechamento nao entram aqui (sao linhas `adjustment` adicionadas pelo service).
 */
export function computeTeacherPayout(
  rule: Pick<TeacherPayRule, "components" | "status" | "startCompetence">,
  facts: TeacherPayFacts,
  competence: string,
): TeacherPayoutLine[] {
  if (!isRuleEffective(rule, competence)) return [];
  const lines: TeacherPayoutLine[] = [];
  for (const component of rule.components) {
    const unit = Math.max(0, component.amountCents ?? 0);
    switch (component.kind) {
      case "fixed_monthly":
        lines.push({ kind: "fixed_monthly", label: `Fixo mensal ${brl(unit)}`, amountCents: unit });
        break;
      case "per_session": {
        const quantity = countedSessions(component, facts).length;
        lines.push({
          kind: "per_session",
          label: `${countLabel(quantity, "aula", "aulas")} × ${brl(unit)}`,
          quantity,
          amountCents: quantity * unit,
        });
        break;
      }
      case "per_student": {
        const quantity = countedStudents(component, facts).length;
        lines.push({
          kind: "per_student",
          label: `${countLabel(quantity, "aluno", "alunos")} × ${brl(unit)}`,
          quantity,
          amountCents: quantity * unit,
        });
        break;
      }
      case "percent_of_memberships": {
        const percent = Math.min(100, Math.max(0, component.percent ?? 0));
        const baseCents = membershipBaseCents(component, facts);
        lines.push({
          kind: "percent_of_memberships",
          label: `${formatPercent(percent)} de ${brl(baseCents)}`,
          baseCents,
          amountCents: Math.floor((baseCents * percent) / 100),
        });
        break;
      }
    }
  }
  return lines;
}

/** Total das linhas, nunca negativo. */
export function payoutTotalCents(lines: readonly TeacherPayoutLine[]): number {
  return Math.max(0, lines.reduce((sum, l) => sum + l.amountCents, 0));
}

/** Resumo legivel da regra: "Fixo R$ 800,00 + 30% das mensalidades". */
export function describeTeacherPayRule(
  rule: Pick<TeacherPayRule, "components">,
): string {
  return rule.components
    .map((c) => {
      const scoped = c.classGroupIds && c.classGroupIds.length > 0 ? " (turmas selecionadas)" : "";
      switch (c.kind) {
        case "fixed_monthly":
          return `Fixo ${brl(c.amountCents ?? 0)}${scoped}`;
        case "per_session":
          return `${brl(c.amountCents ?? 0)} por aula${scoped}`;
        case "per_student":
          return `${brl(c.amountCents ?? 0)} por aluno${scoped}`;
        case "percent_of_memberships":
          return `${formatPercent(c.percent ?? 0)} das mensalidades${scoped}`;
      }
    })
    .join(" + ");
}
