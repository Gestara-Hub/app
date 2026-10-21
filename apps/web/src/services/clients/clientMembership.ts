import type { Charge, Client, CreateClientInitialCharge, Id } from "@gestarahub/contracts";
import { chargesDueIn, isCourseEnded, isFutureOpenInstallment } from "@gestarahub/core/billing";
import { store } from "@/mocks/store";
import { newId, nowIso } from "@/mocks/helpers";
import {
  isPlanlessScholar,
  planlessScholarCharges,
  scholarshipChargeFields,
  studentMembershipTerms,
} from "../billingService";
import { cancelOnlinePaymentsForCharge } from "../onlinePaymentsService";
import { todayISO } from "./clientStore";

/**
 * 1a mensalidade do aluno no plano. Valor e vencimento vem do formulario (que
 * usa o motor de cobranca e permite ajuste); o periodo de referencia garante
 * que a geracao em lote reconheca esta cobranca e nao a duplique.
 */
export function initialMembershipCharge(client: Client, input: CreateClientInitialCharge): Charge {
  const ts = nowIso();
  const competence = input.dueDate.slice(0, 7);
  const plan = store.plans.find((p) => p.id === client.planId);
  const slot = plan
    ? chargesDueIn(studentMembershipTerms(client, plan), competence).find(
        (c) => c.periodStart === input.periodStart,
      )
    : undefined;
  return {
    id: newId(),
    organizationId: store.organization.id,
    unitId: store.unit.id,
    studentId: client.id,
    kind: "membership",
    planId: client.planId,
    competence,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    dueDate: input.dueDate,
    amountCents: input.amountCents,
    ...scholarshipChargeFields(client, {
      amountCents: input.amountCents,
      discountApplied: slot?.discountApplied ?? Boolean(client.discount),
      listAmountCents: slot?.listAmountCents ?? input.amountCents,
    }),
    cycleIndex: slot?.cycleIndex ?? 1,
    cycleTotal: slot?.cycleTotal ?? 1,
    isProrated: input.isProrated,
    proratedDays: input.proratedDays,
    notes: input.isProrated
      ? `Mensalidade proporcional (${input.proratedDays ?? 0} dias)`
      : "1ª mensalidade",
    createdAt: ts,
    updatedAt: ts,
  };
}
/** Isentas do bolsista integral sem plano: mes de inicio e mes atual. */
export function ensurePlanlessScholarCharges(client: Client): void {
  if (!isPlanlessScholar(client)) return;
  const start = (client.planStartDate || todayISO()).slice(0, 7);
  const current = todayISO().slice(0, 7);
  for (const competence of new Set([start, current])) {
    planlessScholarCharges(client, competence);
  }
}

/**
 * Inativar encerra as matriculas (decisao de 18/10/2026): a vaga libera e o
 * aluno sai das chamadas. Curso em andamento: as parcelas futuras saem e as
 * vencidas seguem como divida, como em cancelar a matricula; curso ja
 * concluido fica (e o historico dele). Sai tambem da lista de espera e das
 * aulas futuras reservadas. Retorna quantas matriculas encerrou.
 */
export function endStudentEnrollments(studentId: Id): number {
  const today = todayISO();
  const ts = nowIso();
  let ended = 0;
  for (const e of store.enrollments) {
    if (e.studentId !== studentId || e.status === "canceled") continue;
    const g = store.classGroups.find((x) => x.id === e.classGroupId);
    if (e.course && g && isCourseEnded(g, today)) continue;
    e.status = "canceled";
    e.canceledAt = ts;
    e.cancellationReason = "Aluno inativado";
    ended += 1;
    if (!e.course) continue;
    for (const c of store.charges) {
      if (c.kind !== "course" || c.enrollmentId !== e.id || !isFutureOpenInstallment(c, today)) continue;
      c.status = "canceled";
      c.canceledBy = "system";
      c.cancelReason = "Matrícula encerrada na inativação";
      c.updatedAt = ts;
      cancelOnlinePaymentsForCharge(c.id);
    }
  }
  for (const w of store.waitlist) {
    if (w.studentId === studentId && w.status === "waiting") w.status = "canceled";
  }
  for (const r of store.reservations) {
    const date = r.sessionId.split("~")[1];
    if (r.studentId !== studentId || r.status !== "reserved" || !date || date <= today) continue;
    r.status = "canceled";
    const chargeId = r.chargeId || r.cobrancaId;
    const charge = chargeId ? store.charges.find((c) => c.id === chargeId) : undefined;
    if (charge && (charge.status === "pending" || charge.status === "overdue")) {
      charge.status = "canceled";
      charge.canceledBy = "system";
      charge.updatedAt = ts;
      cancelOnlinePaymentsForCharge(charge.id);
    }
  }
  return ended;
}
