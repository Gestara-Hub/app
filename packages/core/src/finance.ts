import { dateInSpace } from "@gestarahub/core/date";
import type {
  ClassBillingMode,
  DateISO,
  FinanceCategoryTotal,
  FinanceMonthPoint,
  FinanceOverdueToDate,
  FinanceSummary,
  FinancialEntryDisplayStatus,
  FinancialEntryStatus,
  FinancialEntryType,
  FinancialRecurrence,
  Id,
  TeacherPayComponent,
  TeacherPayoutLine,
  TeacherPayPercentSource,
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
// Datas e competencias ("YYYY-MM"), sempre pela data do ESPACO
// ---------------------------------------------------------------------------

/**
 * Data 'YYYY-MM-DD' de um DateISO ou de um timestamp ISO no fuso do espaco
 * (evita o bug de UTC). Antes usava o relogio do servidor (Brasilia): um
 * pagamento as 23:30 de 31/10 num espaco de Manaus entrava em novembro no
 * Financeiro e no DRE, e em outubro no extrato (revisao de valores, 30/10/2026).
 */
export function localDateOf(value: string): DateISO {
  return dateInSpace(value);
}

/** Competencia "YYYY-MM" de uma data ou timestamp (data do espaco). */
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
  // Dia 29 a 31 cai no ultimo dia dos meses mais curtos (decisao de 18/10/2026).
  const [year, month] = competence.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const safe = Math.min(lastDay, Math.max(1, Math.trunc(day) || 1));
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

/**
 * Atrasos acumulados ate hoje, de todas as competencias: em aberto com
 * vencimento antes de hoje. Entradas tambem por mes do vencimento.
 */
export function summarizeOverdueToDate(items: readonly CashFlowItem[], today: DateISO): FinanceOverdueToDate {
  const result: FinanceOverdueToDate = { incomeCents: 0, incomeCount: 0, expenseCents: 0, incomeByCompetence: [] };
  const byCompetence = new Map<string, number>();
  for (const item of items) {
    if (!isOpen(item) || !(item.status === "overdue" || item.dueDate < today)) continue;
    if (item.type !== "income") {
      result.expenseCents += item.amountCents;
      continue;
    }
    result.incomeCents += item.amountCents;
    result.incomeCount += 1;
    const competence = competenceOf(item.dueDate);
    byCompetence.set(competence, (byCompetence.get(competence) ?? 0) + item.amountCents);
  }
  result.incomeByCompetence = [...byCompetence.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([competence, amountCents]) => ({ competence, amountCents }));
  return result;
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
  /**
   * Forma de cobranca (ausente = mensalidade). So turma de mensalidade recebe
   * parte da mensalidade: curso e pacote ja pagam pelas proprias fontes.
   */
  billingMode?: ClassBillingMode;
}

/** Matricula considerada no calculo (o service ja filtrou as ativas). */
export interface TeacherPayEnrollment {
  studentId: Id;
  classGroupId: Id;
  /** Aluno que paga esta turma de mensalidade com pacote (nao recebe parte da mensalidade). */
  paysWithPackage?: boolean;
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

/** Parcela de curso paga (`ChargeKind` "course") com competencia no mes. */
export interface TeacherPayCourseInstallment {
  chargeId: Id;
  studentId: Id;
  /** Turma do curso (o titular dela recebe). */
  classGroupId: Id;
  amountCents: number;
}

/**
 * Aula de pacote usada no mes, ja com o valor (preco / aulas do pacote de
 * origem) e so de pacote pago por inteiro. `instructorId` = quem deu a aula
 * (o substituto, quando houve troca).
 */
export interface TeacherPayPackageLesson {
  sessionId: Id;
  studentId: Id;
  classGroupId: Id;
  date: DateISO;
  instructorId: Id;
  valueCents: number;
}

/**
 * Atribui cada mensalidade paga aos titulares das turmas do aluno (D4): divide
 * igualmente entre os titulares distintos, arredondando para baixo; a sobra
 * fica com a academia. Turma de curso, pacote ou sem cobranca ja paga pelas
 * proprias fontes, entao so recebe parte da mensalidade se o aluno nao tiver
 * nenhuma turma de mensalidade (como era antes). Aluno sem turma conhecida usa
 * a turma da cobranca; sem ela, nao gera parte.
 */
export function attributeMembershipsToTeachers(input: {
  memberships: readonly TeacherPayMembership[];
  enrollments: readonly TeacherPayEnrollment[];
  classGroups: readonly TeacherPayClassGroup[];
}): MembershipAttribution[] {
  const instructorOf = new Map(input.classGroups.map((g) => [g.id, g.instructorId]));
  const isMembershipClass = new Set(
    input.classGroups.filter((g) => (g.billingMode ?? "membership") === "membership").map((g) => g.id),
  );
  const groupsByStudent = new Map<Id, Set<Id>>();
  // Turma de mensalidade paga com pacote por este aluno: ja paga pelo pacote.
  const paidWithPackage = new Set<string>();
  for (const e of input.enrollments) {
    if (!instructorOf.has(e.classGroupId)) continue;
    const set = groupsByStudent.get(e.studentId) ?? new Set<Id>();
    set.add(e.classGroupId);
    groupsByStudent.set(e.studentId, set);
    if (e.paysWithPackage) paidWithPackage.add(`${e.studentId}|${e.classGroupId}`);
  }

  return input.memberships.map((m) => {
    const all = [...(groupsByStudent.get(m.studentId) ?? [])];
    const membershipOnly = all.filter(
      (g) => isMembershipClass.has(g) && !paidWithPackage.has(`${m.studentId}|${g}`),
    );
    let groups = membershipOnly.length > 0 ? membershipOnly : all;
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
 *   (padrao: `activeEnrollments`);
 * - `paidCourseInstallments`: parcelas de curso pagas com competencia no mes;
 * - `packageLessons`: aulas de pacote usadas no mes, de pacote pago por inteiro.
 * Cobranca avulsa ("extra") e aula avulsa nunca entram no %.
 */
export interface TeacherPayFacts {
  professionalId: Id;
  classGroups: readonly TeacherPayClassGroup[];
  sessionsDone: readonly TeacherPaySessionFact[];
  activeEnrollments: readonly TeacherPayEnrollment[];
  paidMemberships: readonly TeacherPayMembership[];
  membershipEnrollments?: readonly TeacherPayEnrollment[];
  paidCourseInstallments?: readonly TeacherPayCourseInstallment[];
  packageLessons?: readonly TeacherPayPackageLesson[];
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

/** Base do % vinda das mensalidades pagas atribuidas ao professor (com a restricao). */
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

/**
 * Base do % vinda dos cursos: parcelas pagas das turmas de curso em que o
 * professor e titular (com a restricao). Sem divisao: o curso tem um titular.
 */
export function courseBaseCents(
  component: TeacherPayComponent,
  facts: TeacherPayFacts,
): number {
  const instructorOf = new Map(facts.classGroups.map((g) => [g.id, g.instructorId]));
  return (facts.paidCourseInstallments ?? [])
    .filter(
      (c) => instructorOf.get(c.classGroupId) === facts.professionalId && allows(component, c.classGroupId),
    )
    .reduce((sum, c) => sum + c.amountCents, 0);
}

/**
 * Aulas de pacote que contam para o professor: as que ele deu (substituto
 * conta para o substituto), com a restricao de turmas.
 */
export function countedPackageLessons(
  component: TeacherPayComponent,
  facts: TeacherPayFacts,
): TeacherPayPackageLesson[] {
  return (facts.packageLessons ?? []).filter(
    (l) => l.instructorId === facts.professionalId && allows(component, l.classGroupId),
  );
}

const PERCENT_SOURCE_WORD: Record<TeacherPayPercentSource, string> = {
  memberships: "mensalidades",
  courses: "cursos",
  packages: "pacotes",
};

/**
 * Linhas do "% do que os alunos pagaram" (decisao 7 do doc 20): uma por fonte
 * com valor (mensalidades, cursos, pacotes), cada uma arredondada para baixo.
 * Sem nenhuma fonte, uma linha zerada.
 */
export function percentPayoutLines(
  component: TeacherPayComponent,
  facts: TeacherPayFacts,
): TeacherPayoutLine[] {
  const percent = Math.min(100, Math.max(0, component.percent ?? 0));
  const lessons = countedPackageLessons(component, facts);
  const parts: { source: TeacherPayPercentSource; baseCents: number; quantity?: number }[] = [
    { source: "memberships", baseCents: membershipBaseCents(component, facts) },
    { source: "courses", baseCents: courseBaseCents(component, facts) },
    {
      source: "packages",
      baseCents: lessons.reduce((sum, l) => sum + l.valueCents, 0),
      quantity: lessons.length,
    },
  ];
  const withValue = parts.filter((p) => p.baseCents > 0);
  if (withValue.length === 0) {
    return [
      { kind: "percent_of_memberships", label: `${formatPercent(percent)} de ${brl(0)}`, baseCents: 0, amountCents: 0 },
    ];
  }
  return withValue.map((p) => ({
    kind: "percent_of_memberships" as const,
    source: p.source,
    label:
      `${formatPercent(percent)} de ${brl(p.baseCents)} em ${PERCENT_SOURCE_WORD[p.source]}` +
      (p.quantity !== undefined ? ` (${countLabel(p.quantity, "aula", "aulas")})` : ""),
    ...(p.quantity !== undefined ? { quantity: p.quantity } : {}),
    baseCents: p.baseCents,
    amountCents: Math.floor((p.baseCents * percent) / 100),
  }));
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
      case "percent_of_memberships":
        lines.push(...percentPayoutLines(component, facts));
        break;
    }
  }
  return lines;
}

/** Total das linhas, nunca negativo. */
export function payoutTotalCents(lines: readonly TeacherPayoutLine[]): number {
  return Math.max(0, lines.reduce((sum, l) => sum + l.amountCents, 0));
}

/** Resumo legivel da regra: "Fixo R$ 800,00 + 30% do que os alunos pagaram". */
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
          return `${formatPercent(c.percent ?? 0)} do que os alunos pagaram${scoped}`;
      }
    })
    .join(" + ");
}
