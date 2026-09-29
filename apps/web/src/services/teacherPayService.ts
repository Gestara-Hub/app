import type {
  ApiErrorField,
  ClassGroup,
  DateISO,
  Id,
  PaymentMethod,
  RecordStatus,
  SaveTeacherPayRule,
  TeacherPayComponent,
  TeacherPayComponentKind,
  TeacherPayout,
  TeacherPayoutAdjustment,
  TeacherPayoutLine,
  TeacherPayoutView,
  TeacherPayRule,
  TeacherPaySessionFact,
  TimeISO,
} from "@gestarahub/contracts";
import {
  DEFAULT_TEACHER_PAYMENT_DAY,
  competenceOf,
  computeTeacherPayout,
  describeTeacherPayRule,
  firstDayOfCompetence,
  isRuleEffective,
  lastDayOfCompetence,
  localDateOf,
  payoutTotalCents,
  teacherPayoutDueDate,
  type TeacherPayEnrollment,
  type TeacherPayFacts,
  type TeacherPayMembership,
} from "@gestarahub/core/finance";
import { isPastSlot } from "@gestarahub/core/date";
import { weekdayOf } from "@gestarahub/core/scheduling";
import { formatCents } from "@gestarahub/core/format";
import { addDays, format, parseISO } from "date-fns";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/labels";
import {
  apiError,
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  validationError,
} from "@/mocks/helpers";
import { store } from "@/mocks/store";
import { auditLogService } from "./auditLogService";
import { assertFeature } from "./subscriptionService";

/**
 * Pagamento dos professores (Financeiro, plano pago). Regra por professor,
 * previa do mes calculada na leitura (motor puro em @gestarahub/core/finance),
 * fechamento que congela as linhas e pagamento que entra no caixa como saida da
 * categoria de sistema "Professores" (o financeService le `teacherPayouts`
 * pagos). Especificacao: docs/technical/05, secao 5.
 */

// ---------------------------------------------------------------------------
// Read-models locais da aba (candidatos a subir para os contratos)
// ---------------------------------------------------------------------------

/** Professor para a aba: nome, status e as turmas em que e titular. */
export interface TeacherPayTeacher {
  professionalId: Id;
  name: string;
  status: RecordStatus;
  classGroups: { id: Id; name: string; status: RecordStatus }[];
  rule?: TeacherPayRule;
  ruleSummary?: string;
}

/** Aula do detalhe do mes (fato do calculo + horario e nome da turma). */
export interface TeacherPayDetailSession extends TeacherPaySessionFact {
  start: TimeISO;
  className: string;
  /** Nome do instrutor efetivo (substituto, quando houve troca). */
  instructorName: string;
  /** Nome do titular da turma. */
  primaryInstructorName: string;
}

/** Detalhe do mes: view + aulas contadas + aulas dele dadas por substituto. */
export interface TeacherPayoutDetail extends TeacherPayoutView {
  sessions: TeacherPayDetailSession[];
  /** Aulas das turmas dele dadas por substituto (nao contam para ele). */
  substitutedSessions: TeacherPayDetailSession[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clone<T>(value: T): T {
  return structuredClone(value);
}

function todayISO(): DateISO {
  return format(new Date(), "yyyy-MM-dd");
}

function currentCompetence(): string {
  return todayISO().slice(0, 7);
}

function isCompetence(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** "2026-10" -> "10/2026". */
function competenceLabel(competence: string): string {
  const [year, month] = competence.split("-");
  return `${month}/${year}`;
}

function professionalName(id: Id): string {
  return store.professionals.find((p) => p.id === id)?.name ?? "";
}

function classGroupName(id: Id): string {
  return store.classGroups.find((g) => g.id === id)?.name ?? "";
}

function ruleOf(professionalId: Id): TeacherPayRule | undefined {
  return store.teacherPayRules.find((r) => r.professionalId === professionalId);
}

/** Registro do mes (qualquer status menos cancelado). */
function payoutOf(professionalId: Id, competence: string): TeacherPayout | undefined {
  return store.teacherPayouts.find(
    (p) =>
      p.professionalId === professionalId &&
      p.competence === competence &&
      p.status !== "canceled",
  );
}

function adjustmentLines(payout?: TeacherPayout): TeacherPayoutLine[] {
  return payout ? payout.lines.filter((l) => l.kind === "adjustment") : [];
}

function payoutLabel(professionalId: Id, competence: string): string {
  return `${professionalName(professionalId)} · ${competenceLabel(competence)}`;
}

// ---------------------------------------------------------------------------
// Fatos da competencia (lidos do store)
// ---------------------------------------------------------------------------

interface DerivedSession {
  fact: TeacherPaySessionFact;
  start: TimeISO;
}

function datesBetween(from: DateISO, to: DateISO): DateISO[] {
  const out: DateISO[] = [];
  let d = parseISO(from);
  const end = parseISO(to);
  for (let i = 0; d.getTime() <= end.getTime() && i < 40; i++) {
    out.push(format(d, "yyyy-MM-dd"));
    d = addDays(d, 1);
  }
  return out;
}

/**
 * Ultimo dia com aulas de uma turma: a data de fim ou, se inativa, a data da
 * ultima alteracao (aproximacao da inativacao; o store nao guarda quando foi).
 */
function lastSessionDate(g: ClassGroup): DateISO | undefined {
  const inactiveSince = g.status === "inactive" ? localDateOf(g.updatedAt) : undefined;
  if (g.endDate && inactiveSince) return g.endDate < inactiveSince ? g.endDate : inactiveSince;
  return g.endDate ?? inactiveSince;
}

/**
 * Sessoes dadas na competencia. Mesma derivacao do turmasService (sessoes
 * geradas dos meetingSlots, id `classGroupId~date~start`, instrutor efetivo do
 * override de substituicao, "done" quando o fim ja passou). Duplicada aqui porque
 * o turmasService nao exporta a derivacao. Nao ha cancelamento de sessao no
 * store: toda sessao passada conta como dada.
 */
function sessionsDoneIn(competence: string): DerivedSession[] {
  const overrides = store.sessionOverrides ?? [];
  const overrideBySession = new Map(overrides.map((o) => [o.sessionId, o]));
  const out: DerivedSession[] = [];
  const dates = datesBetween(firstDayOfCompetence(competence), lastDayOfCompetence(competence));
  for (const date of dates) {
    const wd = weekdayOf(date);
    for (const g of store.classGroups) {
      if (date < g.startDate) continue;
      const last = lastSessionDate(g);
      if (last && date > last) continue;
      for (const slot of g.meetingSlots) {
        if (slot.weekday !== wd) continue;
        if (!isPastSlot(date, slot.end)) continue;
        const sessionId = [g.id, date, slot.start].join("~");
        const instructorId = overrideBySession.get(sessionId)?.instructorId ?? g.instructorId;
        out.push({
          fact: {
            sessionId,
            classGroupId: g.id,
            date,
            instructorId,
            primaryInstructorId: g.instructorId,
          },
          start: slot.start,
        });
      }
    }
  }
  return out.sort(
    (a, b) => a.fact.date.localeCompare(b.fact.date) || a.start.localeCompare(b.start),
  );
}

/** Matriculas vigentes numa data (mesma regra do turmasService.enrollmentsOn). */
function enrollmentsActiveOn(date: DateISO): TeacherPayEnrollment[] {
  return store.enrollments
    .filter(
      (e) =>
        localDateOf(e.enrolledAt) <= date &&
        (e.status === "active" ||
          (e.canceledAt !== undefined && localDateOf(e.canceledAt) > date)),
    )
    .map((e) => ({ studentId: e.studentId, classGroupId: e.classGroupId }));
}

/** Matriculas que valeram em algum dia da competencia. */
function enrollmentsDuring(competence: string): TeacherPayEnrollment[] {
  const first = firstDayOfCompetence(competence);
  const last = lastDayOfCompetence(competence);
  return store.enrollments
    .filter(
      (e) =>
        localDateOf(e.enrolledAt) <= last &&
        (e.status === "active" ||
          (e.canceledAt !== undefined && localDateOf(e.canceledAt) >= first)),
    )
    .map((e) => ({ studentId: e.studentId, classGroupId: e.classGroupId }));
}

/** Mensalidades pagas com o inicio do periodo na competencia (sem avulsas, D5). */
function paidMembershipsIn(competence: string): TeacherPayMembership[] {
  return store.charges
    .filter((c) => {
      if (c.kind !== "membership" || c.status !== "paid") return false;
      const start = c.periodStart ?? c.competence;
      return start ? competenceOf(start.length === 7 ? `${start}-01` : start) === competence : false;
    })
    .map((c) => ({
      chargeId: c.id,
      studentId: c.studentId,
      amountCents: c.amountCents,
      classGroupId: c.classGroupId,
    }));
}

interface CompetenceFacts {
  base: Omit<TeacherPayFacts, "professionalId">;
  sessions: DerivedSession[];
}

/**
 * Fatos compartilhados por todos os professores na competencia:
 * alunos ativos no ULTIMO dia (D3); mensalidades atribuidas pelas turmas ativas
 * no ultimo dia ou, se o aluno saiu no meio do mes, pelas turmas em que esteve.
 */
function buildFacts(competence: string): CompetenceFacts {
  const sessions = sessionsDoneIn(competence);
  const activeEnrollments = enrollmentsActiveOn(lastDayOfCompetence(competence));
  const withActive = new Set(activeEnrollments.map((e) => e.studentId));
  const membershipEnrollments = [
    ...activeEnrollments,
    ...enrollmentsDuring(competence).filter((e) => !withActive.has(e.studentId)),
  ];
  return {
    sessions,
    base: {
      classGroups: store.classGroups.map((g) => ({ id: g.id, instructorId: g.instructorId })),
      sessionsDone: sessions.map((s) => s.fact),
      activeEnrollments,
      paidMemberships: paidMembershipsIn(competence),
      membershipEnrollments,
    },
  };
}

function factsFor(professionalId: Id, facts: CompetenceFacts): TeacherPayFacts {
  return { ...facts.base, professionalId };
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function dueDateOf(rule: TeacherPayRule | undefined, competence: string): DateISO {
  return teacherPayoutDueDate(competence, rule?.paymentDay ?? DEFAULT_TEACHER_PAYMENT_DAY);
}

/**
 * View do mes de um professor. Fechado/pago = linhas congeladas do registro;
 * aberto = calculo ao vivo + ajustes em rascunho (registro reaberto). Sem regra
 * vigente e sem registro fechado devolve undefined.
 */
function buildView(
  professionalId: Id,
  competence: string,
  facts: CompetenceFacts,
): TeacherPayoutView | undefined {
  const professional = store.professionals.find((p) => p.id === professionalId);
  if (!professional) return undefined;
  const rule = ruleOf(professionalId);
  const record = payoutOf(professionalId, competence);
  const common = {
    professionalId,
    professionalName: professional.name,
    professionalStatus: professional.status,
    rule: rule ? clone(rule) : undefined,
    ruleSummary: rule ? describeTeacherPayRule(rule) : undefined,
    competence,
  };

  if (record && (record.status === "closed" || record.status === "paid")) {
    return {
      ...common,
      payout: clone(record),
      status: record.status,
      lines: clone(record.lines),
      totalCents: record.totalCents,
      dueDate: record.dueDate,
    };
  }

  if (!rule || !isRuleEffective(rule, competence)) return undefined;
  const lines = [
    ...computeTeacherPayout(rule, factsFor(professionalId, facts), competence),
    ...adjustmentLines(record),
  ];
  return {
    ...common,
    status: "open",
    lines,
    totalCents: payoutTotalCents(lines),
    dueDate: dueDateOf(rule, competence),
  };
}

function toDetailSession(s: DerivedSession): TeacherPayDetailSession {
  return {
    ...s.fact,
    start: s.start,
    className: classGroupName(s.fact.classGroupId),
    instructorName: professionalName(s.fact.instructorId),
    primaryInstructorName: professionalName(s.fact.primaryInstructorId),
  };
}

// ---------------------------------------------------------------------------
// Validacao
// ---------------------------------------------------------------------------

const COMPONENT_KINDS: readonly TeacherPayComponentKind[] = [
  "fixed_monthly",
  "per_session",
  "per_student",
  "percent_of_memberships",
];

function normalizeComponents(
  professionalId: Id,
  components: TeacherPayComponent[] | undefined,
): TeacherPayComponent[] {
  const fields: ApiErrorField[] = [];
  const list = components ?? [];
  if (list.length === 0) {
    fields.push({ field: "components", message: "Adicione ao menos uma parte ao pagamento." });
  }
  const ownGroups = new Set(
    store.classGroups.filter((g) => g.instructorId === professionalId).map((g) => g.id),
  );
  const out: TeacherPayComponent[] = [];
  list.forEach((c, i) => {
    if (!COMPONENT_KINDS.includes(c.kind)) {
      fields.push({ field: `components.${i}.kind`, message: "Selecione o tipo da parte." });
      return;
    }
    const classGroupIds = [...new Set(c.classGroupIds ?? [])];
    if (classGroupIds.some((id) => !ownGroups.has(id))) {
      fields.push({
        field: `components.${i}.classGroupIds`,
        message: "Escolha apenas turmas em que o professor é titular.",
      });
    }
    const scope = classGroupIds.length > 0 ? { classGroupIds } : {};
    if (c.kind === "percent_of_memberships") {
      const percent = Number(c.percent);
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        fields.push({
          field: `components.${i}.percent`,
          message: "Informe uma porcentagem maior que 0 e até 100.",
        });
      }
      out.push({ kind: c.kind, percent, ...scope });
      return;
    }
    const amountCents = Number(c.amountCents);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      fields.push({
        field: `components.${i}.amountCents`,
        message: "Informe um valor maior que zero.",
      });
    }
    // Fixo mensal nao depende de turma.
    out.push({ kind: c.kind, amountCents, ...(c.kind === "fixed_monthly" ? {} : scope) });
  });
  if (fields.length > 0) throw validationError(fields);
  return out;
}

function validateRulePayload(payload: SaveTeacherPayRule): void {
  const fields: ApiErrorField[] = [];
  const day = payload.paymentDay ?? DEFAULT_TEACHER_PAYMENT_DAY;
  if (!Number.isInteger(day) || day < 1 || day > 28) {
    fields.push({ field: "paymentDay", message: "Informe um dia entre 1 e 28." });
  }
  if (!isCompetence(payload.startCompetence)) {
    fields.push({ field: "startCompetence", message: "Informe o mês de início." });
  }
  if (fields.length > 0) throw validationError(fields);
}

function normalizeAdjustments(
  adjustments: TeacherPayoutAdjustment[] | undefined,
): TeacherPayoutLine[] {
  const fields: ApiErrorField[] = [];
  const lines: TeacherPayoutLine[] = [];
  (adjustments ?? []).forEach((a, i) => {
    const label = (a.label ?? "").trim();
    if (!label) fields.push({ field: `adjustments.${i}.label`, message: "Descreva o ajuste." });
    if (!Number.isInteger(a.amountCents) || a.amountCents === 0) {
      fields.push({
        field: `adjustments.${i}.amountCents`,
        message: "Informe um valor diferente de zero.",
      });
    }
    lines.push({ kind: "adjustment", label, amountCents: a.amountCents });
  });
  if (fields.length > 0) throw validationError(fields);
  return lines;
}

function findPayout(id: Id): TeacherPayout {
  const payout = store.teacherPayouts.find((p) => p.id === id);
  if (!payout) throw notFoundError("Pagamento do professor não encontrado.");
  return payout;
}

function conflict(message: string) {
  return apiError("VALIDATION", message, { httpStatus: 409 });
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/** Previa (aberta) do pagamento de um professor no mes, para o "A pagar" do Financeiro. */
export interface OpenPayoutPreview {
  professionalId: Id;
  professionalName: string;
  competence: string;
  totalCents: number;
  dueDate: string;
}

/**
 * Previas abertas (nao fechadas nem pagas) da competencia. Leitura sincrona
 * para outros services; o Financeiro soma no previsto de saidas.
 */
export function openPayoutPreviews(competence: string): OpenPayoutPreview[] {
  const facts = buildFacts(competence);
  const ids = new Set<Id>(store.teacherPayRules.map((r) => r.professionalId));
  const previews: OpenPayoutPreview[] = [];
  for (const id of ids) {
    const view = buildView(id, competence, facts);
    if (!view || view.status !== "open" || view.totalCents <= 0) continue;
    previews.push({
      professionalId: id,
      professionalName: view.professionalName,
      competence,
      totalCents: view.totalCents,
      dueDate: view.dueDate,
    });
  }
  return previews;
}

export const teacherPayService = {
  /** Professores (ativos ou com regra) com as turmas em que sao titulares. */
  listTeachers(): Promise<TeacherPayTeacher[]> {
    return simulateRead(() => {
      const out: TeacherPayTeacher[] = store.professionals
        .filter((p) => p.status === "active" || ruleOf(p.id))
        .map((p) => {
          const rule = ruleOf(p.id);
          return {
            professionalId: p.id,
            name: p.name,
            status: p.status,
            classGroups: store.classGroups
              .filter((g) => g.instructorId === p.id)
              .map((g) => ({ id: g.id, name: g.name, status: g.status }))
              .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
            rule: rule ? clone(rule) : undefined,
            ruleSummary: rule ? describeTeacherPayRule(rule) : undefined,
          };
        });
      return out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    });
  },

  listRules(): Promise<TeacherPayRule[]> {
    return simulateRead(() => clone(store.teacherPayRules));
  },

  /** Cria ou substitui a regra do professor (uma por professor). */
  saveRule(professionalId: Id, payload: SaveTeacherPayRule): Promise<TeacherPayRule> {
    return simulateWrite(() => {
      assertFeature("finance");
      const professional = store.professionals.find((p) => p.id === professionalId);
      if (!professional) throw notFoundError("Professor não encontrado.");
      const components = normalizeComponents(professionalId, payload.components);
      validateRulePayload(payload);

      const ts = nowIso();
      const existing = ruleOf(professionalId);
      const next = {
        components,
        paymentDay: payload.paymentDay ?? DEFAULT_TEACHER_PAYMENT_DAY,
        startCompetence: payload.startCompetence,
        status: payload.status ?? existing?.status ?? "active",
      };
      let rule: TeacherPayRule;
      if (existing) {
        const before = describeTeacherPayRule(existing);
        Object.assign(existing, next, { updatedAt: ts });
        rule = existing;
        const after = describeTeacherPayRule(rule);
        auditLogService.record({
          action: "updated",
          target: { type: "teacher_pay_rule", id: rule.id, label: professional.name },
          predicate: `atualizou a regra de pagamento de ${professional.name} (${after})`,
          changes:
            before !== after
              ? [{ field: "components", label: "Regra", before, after }]
              : undefined,
        });
      } else {
        rule = {
          id: newId(),
          organizationId: store.organization.id,
          professionalId,
          ...next,
          createdAt: ts,
          updatedAt: ts,
        };
        store.teacherPayRules.push(rule);
        auditLogService.record({
          action: "created",
          target: { type: "teacher_pay_rule", id: rule.id, label: professional.name },
          predicate: `configurou o pagamento de ${professional.name} (${describeTeacherPayRule(rule)})`,
        });
      }
      return clone(rule);
    });
  },

  /**
   * Meses dos professores na competencia: com regra vigente (previa ao vivo) ou
   * com o mes ja fechado/pago (congelado, mesmo com o professor inativo).
   */
  listPayouts(competence: string): Promise<TeacherPayoutView[]> {
    return simulateRead(() => {
      const facts = buildFacts(competence);
      const ids = new Set<Id>([
        ...store.teacherPayRules.map((r) => r.professionalId),
        ...store.teacherPayouts
          .filter((p) => p.competence === competence)
          .map((p) => p.professionalId),
      ]);
      const views: TeacherPayoutView[] = [];
      for (const id of ids) {
        const view = buildView(id, competence, facts);
        if (view) views.push(view);
      }
      return clone(
        views.sort((a, b) => a.professionalName.localeCompare(b.professionalName, "pt-BR")),
      );
    });
  },

  /** Detalhe do mes com as aulas contadas (inclui substituicoes). */
  getPayoutPreview(professionalId: Id, competence: string): Promise<TeacherPayoutDetail> {
    return simulateRead(() => {
      const facts = buildFacts(competence);
      const view = buildView(professionalId, competence, facts);
      if (!view) {
        throw notFoundError("Este professor não tem regra de pagamento vigente neste mês.");
      }
      const sessions = facts.sessions
        .filter((s) => s.fact.instructorId === professionalId)
        .map(toDetailSession);
      const substitutedSessions = facts.sessions
        .filter(
          (s) =>
            s.fact.primaryInstructorId === professionalId &&
            s.fact.instructorId !== professionalId,
        )
        .map(toDetailSession);
      return clone({ ...view, sessions, substitutedSessions });
    });
  },

  /**
   * Fecha o mes: congela as linhas calculadas + ajustes (bonus positivo,
   * desconto/vale negativo). Total nao pode ficar negativo.
   */
  closePayout(
    professionalId: Id,
    competence: string,
    adjustments: TeacherPayoutAdjustment[] = [],
  ): Promise<TeacherPayoutView> {
    return simulateWrite(() => {
      assertFeature("finance");
      if (!isCompetence(competence)) throw notFoundError("Mês inválido.");
      if (competence > currentCompetence()) {
        throw conflict("Não é possível fechar um mês que ainda não começou.");
      }
      const professional = store.professionals.find((p) => p.id === professionalId);
      if (!professional) throw notFoundError("Professor não encontrado.");
      const rule = ruleOf(professionalId);
      if (!rule || !isRuleEffective(rule, competence)) {
        throw conflict("Este professor não tem regra de pagamento vigente neste mês.");
      }
      const existing = payoutOf(professionalId, competence);
      if (existing && existing.status !== "open") {
        throw conflict("Este mês já está fechado.");
      }

      const computed = computeTeacherPayout(
        rule,
        factsFor(professionalId, buildFacts(competence)),
        competence,
      );
      const adjustmentLinesList = normalizeAdjustments(adjustments);
      const lines = [...computed, ...adjustmentLinesList];
      const rawTotal = lines.reduce((sum, l) => sum + l.amountCents, 0);
      if (rawTotal < 0) {
        throw validationError([
          { field: "adjustments", message: "Os descontos deixam o total do mês negativo." },
        ]);
      }

      const ts = nowIso();
      const fields = {
        lines,
        totalCents: payoutTotalCents(lines),
        dueDate: dueDateOf(rule, competence),
        status: "closed" as const,
        closedAt: ts,
        paidAt: undefined,
        method: undefined,
        updatedAt: ts,
      };
      let payout: TeacherPayout;
      if (existing) {
        Object.assign(existing, fields);
        payout = existing;
      } else {
        payout = {
          id: newId(),
          organizationId: store.organization.id,
          professionalId,
          competence,
          ...fields,
          createdAt: ts,
        };
        store.teacherPayouts.push(payout);
      }
      auditLogService.record({
        action: "status_changed",
        target: { type: "teacher_payout", id: payout.id, label: payoutLabel(professionalId, competence) },
        predicate: `fechou o pagamento de ${professional.name} de ${competenceLabel(competence)} (${formatCents(payout.totalCents)})`,
      });
      const view = buildView(professionalId, competence, buildFacts(competence));
      return clone(view!);
    });
  },

  /** Reabre um mes fechado (volta a previa ao vivo; os ajustes ficam como rascunho). */
  reopenPayout(id: Id): Promise<void> {
    return simulateWrite(() => {
      assertFeature("finance");
      const payout = findPayout(id);
      if (payout.status === "paid") {
        throw conflict("Desfaça o pagamento antes de reabrir o mês.");
      }
      if (payout.status !== "closed") throw conflict("Este mês não está fechado.");
      payout.status = "open";
      payout.lines = adjustmentLines(payout);
      payout.totalCents = payoutTotalCents(payout.lines);
      payout.closedAt = undefined;
      payout.updatedAt = nowIso();
      auditLogService.record({
        action: "status_changed",
        target: { type: "teacher_payout", id, label: payoutLabel(payout.professionalId, payout.competence) },
        predicate: `reabriu o pagamento de ${professionalName(payout.professionalId)} de ${competenceLabel(payout.competence)}`,
      });
    });
  },

  /** Paga o mes fechado: entra no caixa como saida "Professores" em `paidAt`. */
  markPayoutPaid(id: Id, method: PaymentMethod): Promise<TeacherPayout> {
    return simulateWrite(() => {
      assertFeature("finance");
      const payout = findPayout(id);
      if (payout.status !== "closed") {
        throw conflict(
          payout.status === "paid" ? "Este pagamento já foi registrado." : "Feche o mês antes de pagar.",
        );
      }
      if (!PAYMENT_METHODS.includes(method)) {
        throw validationError([{ field: "method", message: "Selecione a forma de pagamento." }]);
      }
      const ts = nowIso();
      payout.status = "paid";
      payout.paidAt = ts;
      payout.method = method;
      payout.updatedAt = ts;
      auditLogService.record({
        action: "status_changed",
        target: { type: "teacher_payout", id, label: payoutLabel(payout.professionalId, payout.competence) },
        predicate: `registrou o pagamento de ${professionalName(payout.professionalId)} de ${competenceLabel(payout.competence)} (${formatCents(payout.totalCents)} via ${paymentMethodLabel(method)})`,
      });
      return clone(payout);
    });
  },

  /** Desfaz o pagamento: volta para fechado. */
  markPayoutUnpaid(id: Id): Promise<TeacherPayout> {
    return simulateWrite(() => {
      assertFeature("finance");
      const payout = findPayout(id);
      if (payout.status !== "paid") throw conflict("Este pagamento não está registrado como pago.");
      payout.status = "closed";
      payout.paidAt = undefined;
      payout.method = undefined;
      payout.updatedAt = nowIso();
      auditLogService.record({
        action: "status_changed",
        target: { type: "teacher_payout", id, label: payoutLabel(payout.professionalId, payout.competence) },
        predicate: `desfez o pagamento de ${professionalName(payout.professionalId)} de ${competenceLabel(payout.competence)} (${formatCents(payout.totalCents)})`,
      });
      return clone(payout);
    });
  },
};
