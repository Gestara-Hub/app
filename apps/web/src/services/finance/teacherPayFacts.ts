import type { ClassGroup, DateISO, Id, TeacherPaySessionFact, TimeISO } from "@gestarahub/contracts";
import {
  competenceOf,
  firstDayOfCompetence,
  lastDayOfCompetence,
  localDateOf,
  type TeacherPayCourseInstallment,
  type TeacherPayEnrollment,
  type TeacherPayFacts,
  type TeacherPayMembership,
  type TeacherPayPackageLesson,
} from "@gestarahub/core/finance";
import { valuePackageLessons } from "@gestarahub/core/packages";
import { isPastSlot } from "@gestarahub/core/date";
import { meetingSlotsOn, weekdayOf } from "@gestarahub/core/scheduling";
import { addDays, format, parseISO } from "date-fns";
import { store } from "@/services/world/store";
import { closedPayoutsOf } from "./teacherPayHelpers";

// ---------------------------------------------------------------------------
// Fatos da competencia (lidos do store)
// ---------------------------------------------------------------------------

export interface DerivedSession {
  fact: TeacherPaySessionFact;
  start: TimeISO;
}

export function datesBetween(from: DateISO, to: DateISO): DateISO[] {
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
export function lastSessionDate(g: ClassGroup): DateISO | undefined {
  const inactiveSince = g.status === "inactive" ? localDateOf(g.updatedAt) : undefined;
  if (g.endDate && inactiveSince) return g.endDate < inactiveSince ? g.endDate : inactiveSince;
  return g.endDate ?? inactiveSince;
}

/**
 * Sessoes dadas na competencia. Mesma derivacao do turmasService (sessoes
 * geradas dos meetingSlots, id `classGroupId~date~start`, instrutor efetivo do
 * override de substituicao, "done" quando o fim ja passou). Duplicada aqui porque
 * o turmasService nao exporta a derivacao. Nao ha cancelamento de sessao no
 * store: toda sessao passada conta como dada. `upcoming` devolve as que ainda
 * nao terminaram (so para o detalhe; nao entram no calculo).
 */
export function sessionsIn(competence: string, when: "done" | "upcoming" = "done"): DerivedSession[] {
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
      for (const slot of meetingSlotsOn(g, date)) {
        if (slot.weekday !== wd) continue;
        if (isPastSlot(date, slot.end) !== (when === "done")) continue;
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
export function enrollmentsActiveOn(date: DateISO): TeacherPayEnrollment[] {
  return store.enrollments
    .filter(
      (e) =>
        localDateOf(e.enrolledAt) <= date &&
        (e.status === "active" ||
          (e.canceledAt !== undefined && localDateOf(e.canceledAt) > date)),
    )
    .map((e) => ({ studentId: e.studentId, classGroupId: e.classGroupId, paysWithPackage: e.paysWithPackage }));
}

/** Matriculas que valeram em algum dia da competencia. */
export function enrollmentsDuring(competence: string): TeacherPayEnrollment[] {
  const first = firstDayOfCompetence(competence);
  const last = lastDayOfCompetence(competence);
  return store.enrollments
    .filter(
      (e) =>
        localDateOf(e.enrolledAt) <= last &&
        (e.status === "active" ||
          (e.canceledAt !== undefined && localDateOf(e.canceledAt) >= first)),
    )
    .map((e) => ({ studentId: e.studentId, classGroupId: e.classGroupId, paysWithPackage: e.paysWithPackage }));
}

/** Competencia da cobranca para o %: inicio do periodo ou, sem ele, a competencia gravada. */
export function chargeCompetence(c: { periodStart?: string; competence?: string }): string | undefined {
  const start = c.periodStart ?? c.competence;
  return start ? competenceOf(start.length === 7 ? `${start}-01` : start) : undefined;
}

/** Mensalidades pagas com o inicio do periodo na competencia (sem avulsas, D5). */
export function paidMembershipsIn(competence: string): TeacherPayMembership[] {
  return store.charges
    .filter((c) => c.kind === "membership" && c.status === "paid" && chargeCompetence(c) === competence)
    .map((c) => ({
      chargeId: c.id,
      studentId: c.studentId,
      amountCents: c.amountCents,
      classGroupId: c.classGroupId,
    }));
}

/**
 * Parcelas de curso pagas com competencia no mes (mesma regra da mensalidade),
 * com a turma do curso (da cobranca ou da matricula).
 */
export function paidCourseInstallmentsIn(competence: string): TeacherPayCourseInstallment[] {
  const out: TeacherPayCourseInstallment[] = [];
  for (const c of store.charges) {
    if (c.kind !== "course" || c.status !== "paid" || chargeCompetence(c) !== competence) continue;
    const classGroupId =
      c.classGroupId ?? store.enrollments.find((e) => e.id === c.enrollmentId)?.classGroupId;
    if (!classGroupId) continue;
    out.push({ chargeId: c.id, studentId: c.studentId, classGroupId, amountCents: c.amountCents });
  }
  return out;
}

/**
 * Aulas de pacote usadas no mes (data da aula), so de pacote pago por inteiro
 * na hora do calculo, com o valor de cada aula (preco / aulas do pacote de
 * origem, inclusive das trazidas) e quem deu a aula (o substituto, se houve).
 */
export function packageLessonsIn(competence: string): TeacherPayPackageLesson[] {
  const chargesById = new Map(store.charges.map((c) => [c.id, c]));
  const groupsById = new Map(store.classGroups.map((g) => [g.id, g]));
  const overrideBySession = new Map((store.sessionOverrides ?? []).map((o) => [o.sessionId, o]));
  const valued = valuePackageLessons(
    (store.studentPackages ?? []).map((p) => ({
      ...p,
      charges: p.chargeIds.flatMap((id) => {
        const charge = chargesById.get(id);
        return charge ? [{ status: charge.status, amountCents: charge.amountCents }] : [];
      }),
    })),
  );
  const out: TeacherPayPackageLesson[] = [];
  for (const l of valued) {
    if (!l.paid || competenceOf(l.date) !== competence) continue;
    const group = groupsById.get(l.classGroupId);
    if (!group) continue;
    out.push({
      sessionId: l.sessionId,
      studentId: l.studentId,
      classGroupId: l.classGroupId,
      date: l.date,
      instructorId: overrideBySession.get(l.sessionId)?.instructorId ?? group.instructorId,
      valueCents: l.valueCents,
    });
  }
  return out;
}

export interface CompetenceFacts {
  base: Omit<TeacherPayFacts, "professionalId">;
  sessions: DerivedSession[];
}

/**
 * Fatos compartilhados por todos os professores na competencia:
 * alunos ativos no ULTIMO dia (D3); mensalidades atribuidas pelas turmas ativas
 * no ultimo dia ou, se o aluno saiu no meio do mes, pelas turmas em que esteve;
 * parcelas de curso pagas e aulas de pacote dadas (decisao 7 do doc 20).
 */
export function buildFacts(competence: string): CompetenceFacts {
  const sessions = sessionsIn(competence);
  const activeEnrollments = enrollmentsActiveOn(lastDayOfCompetence(competence));
  const withActive = new Set(activeEnrollments.map((e) => e.studentId));
  const membershipEnrollments = [
    ...activeEnrollments,
    ...enrollmentsDuring(competence).filter((e) => !withActive.has(e.studentId)),
  ];
  return {
    sessions,
    base: {
      classGroups: store.classGroups.map((g) => ({
        id: g.id,
        instructorId: g.instructorId,
        billingMode: g.billingMode,
      })),
      sessionsDone: sessions.map((s) => s.fact),
      activeEnrollments,
      paidMemberships: paidMembershipsIn(competence),
      membershipEnrollments,
      paidCourseInstallments: paidCourseInstallmentsIn(competence),
      packageLessons: packageLessonsIn(competence),
    },
  };
}

/**
 * Fatos do mes para o professor: sem as cobrancas que ja entraram num mes
 * fechado dele (paga atrasada contada em outro mes nao conta de novo).
 */
export function factsFor(professionalId: Id, facts: CompetenceFacts): TeacherPayFacts {
  const counted = new Set(closedPayoutsOf(professionalId).flatMap((p) => p.countedChargeIds ?? []));
  if (counted.size === 0) return { ...facts.base, professionalId };
  return {
    ...facts.base,
    professionalId,
    paidMemberships: facts.base.paidMemberships.filter((m) => !counted.has(m.chargeId)),
    paidCourseInstallments: facts.base.paidCourseInstallments?.filter((c) => !counted.has(c.chargeId)),
  };
}

/** Cobrancas que entram no % do mes (mensalidades e parcelas de curso pagas). */
export function percentChargeIds(facts: TeacherPayFacts): Id[] {
  return [
    ...facts.paidMemberships.map((m) => m.chargeId),
    ...(facts.paidCourseInstallments ?? []).map((c) => c.chargeId),
  ];
}

/** Fatos do % de um mes (matriculas e turmas), sem aulas nem cobrancas. */
export function percentFactsOf(competence: string): Omit<TeacherPayFacts, "professionalId"> {
  const activeEnrollments = enrollmentsActiveOn(lastDayOfCompetence(competence));
  const withActive = new Set(activeEnrollments.map((e) => e.studentId));
  return {
    classGroups: store.classGroups.map((g) => ({
      id: g.id,
      instructorId: g.instructorId,
      billingMode: g.billingMode,
    })),
    sessionsDone: [],
    activeEnrollments,
    paidMemberships: [],
    membershipEnrollments: [
      ...activeEnrollments,
      ...enrollmentsDuring(competence).filter((e) => !withActive.has(e.studentId)),
    ],
    paidCourseInstallments: [],
    packageLessons: [],
  };
}
