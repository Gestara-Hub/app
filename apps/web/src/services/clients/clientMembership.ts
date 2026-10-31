import type { Charge, Client, CreateClientInitialCharge, Id } from "@gestarahub/contracts";
import { chargesDueIn, firstCharge, isCourseEnded, isFutureOpenInstallment } from "@gestarahub/core/billing";
import { can } from "@/lib/permissions";
import { getCurrentActor } from "../world/actor";
import { store } from "@/services/world/store";
import { newId, nowIso } from "@/services/world/ops";
import {
  isPlanlessScholar,
  planlessScholarCharges,
  scholarshipChargeFields,
  studentMembershipTerms,
} from "../billing";
import { cancelOnlinePaymentsForCharge } from "../onlinePayments";
import { todayISO } from "./clientStore";

/**
 * 1a mensalidade do aluno no plano. Valor e vencimento vem do formulario (que
 * usa o motor de cobranca e permite ajuste); o periodo de referencia garante
 * que a geracao em lote reconheca esta cobranca e nao a duplique.
 */
export function initialMembershipCharge(client: Client, requested: CreateClientInitialCharge): Charge {
  const ts = nowIso();
  const plan = store.plans.find((p) => p.id === client.planId);
  const terms = plan ? studentMembershipTerms(client, plan) : undefined;
  const requestedSlot = terms
    ? chargesDueIn(terms, requested.dueDate.slice(0, 7)).find((c) => c.periodStart === requested.periodStart)
    : undefined;
  // Revisao de valores de 30/10/2026: o periodo vinha do navegador sem conferir
  // (um periodo errado travava a geracao das seguintes pela regra da sobreposicao).
  // Sem periodo do motor que bata, vale o primeiro periodo do motor.
  const engineFirst = terms && !requestedSlot ? firstCharge(terms) : undefined;
  const slot = requestedSlot ?? engineFirst;
  // Valor ajustado so para quem cobra (billing:manage); o atendente que cadastra fica com o do motor.
  const actor = getCurrentActor();
  const mayAdjust = !actor || can(actor.profile, "billing:manage");
  const input: CreateClientInitialCharge = engineFirst
    ? {
        amountCents: mayAdjust ? requested.amountCents : engineFirst.amountCents,
        dueDate: engineFirst.dueDate,
        periodStart: engineFirst.periodStart,
        periodEnd: engineFirst.periodEnd,
        isProrated: engineFirst.isProrated,
        proratedDays: engineFirst.proratedDays,
      }
    : { ...requested, amountCents: mayAdjust || !slot ? requested.amountCents : slot.amountCents };
  const competence = input.dueDate.slice(0, 7);
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
    cycleIndex: requestedSlot?.cycleIndex ?? 1,
    cycleTotal: requestedSlot?.cycleTotal ?? 1,
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

/**
 * "Mes cheio" (doc 15: ciclo a partir da entrada): o dia de cobranca e o dia do
 * inicio. Revisao de valores de 30/10/2026: a volta do aluno movia o inicio para
 * a data da volta e mantinha o dia antigo, e o motor ancorava os ciclos nele
 * (duas mensalidades cheias com duas semanas de diferenca); um dia editado a mao
 * deixava dias sem cobranca entre o 1o e o 2o ciclo.
 */
export function alignFullCycleDueDay(client: Client): void {
  if (client.billingStrategy !== "full_cycle" || !client.planStartDate) return;
  client.dueDay = Number(client.planStartDate.slice(8, 10));
}
