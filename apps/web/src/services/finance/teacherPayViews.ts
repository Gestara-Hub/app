import type {
  DateISO,
  Id,
  RecordStatus,
  TeacherPayoutView,
  TeacherPayRule,
  TeacherPaySessionFact,
  TimeISO,
} from "@gestarahub/contracts";
import {
  DEFAULT_TEACHER_PAYMENT_DAY,
  computeTeacherPayout,
  describeTeacherPayRule,
  isRuleEffective,
  payoutTotalCents,
  teacherPayoutDueDate,
} from "@gestarahub/core/finance";
import { store } from "@/services/world/store";
import { buildFacts, factsFor, type CompetenceFacts, type DerivedSession } from "./teacherPayFacts";
import {
  adjustmentLines,
  classGroupName,
  clone,
  payoutOf,
  professionalName,
  ruleOf,
} from "./teacherPayHelpers";
import { latePaymentShare } from "./teacherPayLatePayments";

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
  /** Aulas dele ainda por acontecer na competencia (entram quando acontecerem). */
  upcomingSessions: TeacherPayDetailSession[];
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export function dueDateOf(rule: TeacherPayRule | undefined, competence: string): DateISO {
  return teacherPayoutDueDate(competence, rule?.paymentDay ?? DEFAULT_TEACHER_PAYMENT_DAY);
}

/**
 * View do mes de um professor. Fechado/pago = linhas congeladas do registro;
 * aberto = calculo ao vivo + ajustes em rascunho (registro reaberto). Sem regra
 * vigente e sem registro fechado devolve undefined.
 */
export function buildView(
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
    ...latePaymentShare(professionalId, rule, competence).lines,
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

export function toDetailSession(s: DerivedSession): TeacherPayDetailSession {
  return {
    ...s.fact,
    start: s.start,
    className: classGroupName(s.fact.classGroupId),
    instructorName: professionalName(s.fact.instructorId),
    primaryInstructorName: professionalName(s.fact.primaryInstructorId),
  };
}

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
