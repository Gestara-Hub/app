import type {
  CancelEnrollmentChargeItem,
  CancelEnrollmentCharges,
  CancelEnrollmentChoices,
  CancelEnrollmentPreview,
  Charge,
  Client,
  Enrollment,
  Id,
} from "@gestarahub/contracts";
import { cancelEnrollmentQuestions, hasEnded, isCourseEnded } from "@gestarahub/core/billing";
import { can } from "@/lib/permissions";
import { forbiddenError } from "@gestarahub/core/api-error";
import { nowIso, validationError } from "@/services/world/ops";
import { getCurrentActor } from "@/services/world/actor";
import { store } from "@/services/world/store";
import { chargeStartedMembershipPeriods, studentMembershipTerms } from "../billing";
import { cancelOnlinePaymentsForCharge } from "../onlinePayments";
import { studentName } from "./classShared";

/**
 * Cancelar matricula com o dinheiro (27/11/2026, doc product/11 "Cancelar
 * matrícula: plano e cobranças"). A janela pergunta, sem nada marcado:
 * - o plano, quando o aluno nao fica em nenhuma outra turma (mensalidade e do
 *   plano do aluno, nao da turma: sem a pergunta ele seguia cobrado sem turma);
 * - as cobrancas em aberto futuras e as vencidas (do curso e, com o plano
 *   encerrado, as mensalidades);
 * - o que ja foi pago e ainda nao foi usado (manter ou estornar; o estorno e a
 *   janela da fase 1, aberta pela tela depois do cancelamento).
 */

const OPEN = new Set(["pending", "overdue"]);
const NOTE = "Matrícula cancelada";

const emptyCharges = (): CancelEnrollmentCharges => ({ future: [], overdue: [], paid: [] });

function mmYyyy(iso: string): string {
  const [y, m] = iso.slice(0, 7).split("-");
  return `${m}/${y}`;
}

function itemOf(c: Charge): CancelEnrollmentChargeItem {
  const label =
    c.kind === "membership"
      ? `Mensalidade ${mmYyyy(c.competence ?? c.dueDate)}`
      : (c.cycleTotal ?? 1) > 1
        ? `Parcela ${c.cycleIndex ?? 1} de ${c.cycleTotal} do curso`
        : "Curso à vista";
  return {
    chargeId: c.id,
    label,
    amountCents: c.amountCents,
    dueDate: c.dueDate,
    paidOnline: c.status === "paid" && c.paidVia === "online" ? true : undefined,
  };
}

const byDue = (a: Charge, b: Charge) => a.dueDate.localeCompare(b.dueDate);

/** Parcelas do curso da matricula. Curso ja terminado: nada (foi dado). */
function courseCharges(e: Enrollment, today: string): { future: Charge[]; overdue: Charge[]; paid: Charge[] } {
  const out = { future: [] as Charge[], overdue: [] as Charge[], paid: [] as Charge[] };
  const g = store.classGroups.find((x) => x.id === e.classGroupId);
  if (!e.course || (g && isCourseEnded(g, today))) return out;
  for (const c of store.charges.filter((x) => x.kind === "course" && x.enrollmentId === e.id).sort(byDue)) {
    if (OPEN.has(c.status)) (c.dueDate > today ? out.future : out.overdue).push(c);
    else if (c.status === "paid") out.paid.push(c);
  }
  return out;
}

/** Mensalidades do plano do aluno: futuras = periodo ainda nao comecou; pagas = periodo em uso ou futuro. */
function membershipCharges(student: Client, today: string): { future: Charge[]; overdue: Charge[]; paid: Charge[] } {
  const out = { future: [] as Charge[], overdue: [] as Charge[], paid: [] as Charge[] };
  for (const c of store.charges.filter((x) => x.kind === "membership" && x.studentId === student.id).sort(byDue)) {
    const start = c.periodStart ?? c.dueDate;
    const end = c.periodEnd ?? c.dueDate;
    if (OPEN.has(c.status)) (start > today ? out.future : out.overdue).push(c);
    else if (c.status === "paid" && end >= today) out.paid.push(c);
  }
  return out;
}

/** Turmas ativas em que o aluno continua (curso ja terminado nao conta). */
function otherActiveClasses(e: Enrollment, today: string): string[] {
  const names: string[] = [];
  for (const other of store.enrollments) {
    if (other.id === e.id || other.studentId !== e.studentId || other.status === "canceled") continue;
    const g = store.classGroups.find((x) => x.id === other.classGroupId);
    if (!g || g.status !== "active" || hasEnded(g, today)) continue;
    names.push(g.name);
  }
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Plano ativo do aluno que nao fica em outra turma: a janela pergunta. */
function planInQuestion(e: Enrollment, student: Client | undefined, others: string[]) {
  if (!student?.planId || others.length > 0 || student.status !== "active") return undefined;
  if (student.membershipStatus === "paused" || student.membershipStatus === "canceled") return undefined;
  const plan = store.plans.find((p) => p.id === student.planId);
  if (!plan) return undefined;
  return { plan, chargesUsedPeriod: studentMembershipTerms(student, plan).timing === "postpaid" };
}

export function buildCancelPreview(e: Enrollment, today: string): CancelEnrollmentPreview {
  const student = store.clients.find((c) => c.id === e.studentId);
  const others = otherActiveClasses(e, today);
  const inQuestion = planInQuestion(e, student, others);
  const toItems = (set: { future: Charge[]; overdue: Charge[]; paid: Charge[] }): CancelEnrollmentCharges => ({
    future: set.future.map(itemOf),
    overdue: set.overdue.map(itemOf),
    paid: set.paid.map(itemOf),
  });
  return {
    enrollmentId: e.id,
    studentId: e.studentId,
    studentName: studentName(e.studentId),
    plan: inQuestion
      ? { planId: inQuestion.plan.id, planName: inQuestion.plan.name, chargesUsedPeriod: inQuestion.chargesUsedPeriod }
      : undefined,
    otherClassNames: others,
    course: toItems(courseCharges(e, today)),
    membership: inQuestion && student ? toItems(membershipCharges(student, today)) : emptyCharges(),
  };
}

/** Sai junto com a matricula: "Encerrado" pelo sistema, sem reverter (como antes). */
function cancelCharge(c: Charge, ts: string): void {
  c.status = "canceled";
  c.canceledBy = "system";
  c.cancelReason = NOTE;
  c.updatedAt = ts;
  cancelOnlinePaymentsForCharge(c.id, NOTE);
}

export interface CancelMoneyOutcome {
  planEnded: boolean;
  canceledCharges: number;
}

/**
 * Aplica as escolhas. Sem escolhas, a regra antiga (curso: futuras saem).
 * Com escolhas: so quem cobra (`billing:manage`) e cada pergunta da previa
 * precisa de resposta.
 */
export function applyCancelChoices(e: Enrollment, today: string, choices?: CancelEnrollmentChoices): CancelMoneyOutcome {
  const ts = nowIso();
  if (!choices) {
    let canceledCharges = 0;
    for (const c of courseCharges(e, today).future) {
      cancelCharge(c, ts);
      canceledCharges += 1;
    }
    return { planEnded: false, canceledCharges };
  }

  const actor = getCurrentActor();
  if (actor && !can(actor.profile, "billing:manage")) {
    throw forbiddenError("Só quem cuida das cobranças decide o que fazer com elas.");
  }
  const preview = buildCancelPreview(e, today);
  const asked = cancelEnrollmentQuestions(preview, choices.plan);
  const missing: { field: string; message: string }[] = [];
  if (asked.plan && !choices.plan) missing.push({ field: "plan", message: "Escolha o que fazer com o plano." });
  if (asked.future && !choices.futureCharges) missing.push({ field: "futureCharges", message: "Escolha o que fazer com as cobranças futuras." });
  if (asked.overdue && !choices.overdueCharges) missing.push({ field: "overdueCharges", message: "Escolha o que fazer com as cobranças vencidas." });
  if (missing.length > 0) throw validationError(missing);

  const student = store.clients.find((c) => c.id === e.studentId);
  let planEnded = false;
  if (asked.plan && choices.plan === "end" && student) {
    // "Depois do uso": o periodo em uso vira cobranca agora (como na pausa).
    if (preview.plan?.chargesUsedPeriod) chargeStartedMembershipPeriods(student, today);
    student.membershipStatus = "canceled";
    student.updatedAt = ts;
    planEnded = true;
  }

  const course = courseCharges(e, today);
  const membership = planEnded && student ? membershipCharges(student, today) : { future: [], overdue: [], paid: [] };
  let canceledCharges = 0;
  if (choices.futureCharges === "cancel") {
    for (const c of [...course.future, ...membership.future]) {
      cancelCharge(c, ts);
      canceledCharges += 1;
    }
  }
  if (choices.overdueCharges === "cancel") {
    for (const c of [...course.overdue, ...membership.overdue]) {
      cancelCharge(c, ts);
      canceledCharges += 1;
    }
  }
  return { planEnded, canceledCharges };
}

/** Ids das previas pedidas que existem e estao ativas. */
export function enrollmentsToCancel(ids: Id[]): Enrollment[] {
  return ids
    .map((id) => store.enrollments.find((e) => e.id === id))
    .filter((e): e is Enrollment => Boolean(e) && e?.status !== "canceled");
}
