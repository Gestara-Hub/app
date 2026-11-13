import type {
  Charge,
  Event,
  EventRegistration,
  EventRegistrationPayment,
  EventRegistrationScope,
  EventRegistrationSource,
  EventRegistrationView,
  Id,
  RegisterForEvent,
} from "@gestarahub/contracts";
import { splitInstallments } from "@gestarahub/core/billing";
import { activeDays, eventStage, suggestedRegistrationPrice } from "@gestarahub/core/events";
import { formatCents, plural } from "@gestarahub/core/format";
import { apiError, newId, notFoundError, nowIso, readOp, writeOp } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { auditLogService } from "../audit/auditLogService";
import {
  assertTeacherSeesEvent,
  clone,
  eventRegistrationsStore,
  findEvent,
  findRegistration,
  newTicketCode,
  registrationsOf,
  seatHolders,
  sessionsOf,
  studentName,
  todayISO,
} from "./eventShared";
import { assertDaysBelongToEvent, validateRegistrationPayment } from "./eventValidation";
import { toRegistrationView } from "./eventViews";
import { cancelFutureInstallments } from "./eventsService";
import { cancelOnlinePaymentsForCharge } from "../onlinePayments/onlinePaymentRules";

/**
 * Inscricoes no evento (doc product/29 §Inscricao): completa ou por dia,
 * lista de espera quando lota (regra dura), parcelas como no curso, cancelar
 * cancela so as parcelas futuras em aberto.
 */

function brDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Lotou: confirmados e reservas valendo ja ocupam todas as vagas. */
function isFull(event: Event): boolean {
  return event.capacity !== undefined && seatHolders(event.id).length >= event.capacity;
}

function assertStudentCanRegister(event: Event, studentId: Id): void {
  if (event.status === "canceled") throw apiError("VALIDATION", "Este evento foi cancelado.", { httpStatus: 409 });
  if (eventStage(sessionsOf(event.id), todayISO()) === "finished") {
    throw apiError("VALIDATION", "Este evento já terminou.", { httpStatus: 422 });
  }
  const student = store.clients.find((c) => c.id === studentId);
  if (!student) throw notFoundError("Aluno não encontrado.");
  if (student.status !== "active") {
    throw apiError("VALIDATION", `${student.name} está inativo. Reative o aluno antes de inscrever.`, { httpStatus: 422 });
  }
  if (registrationsOf(event.id).some((r) => r.studentId === studentId && r.status !== "canceled")) {
    throw apiError("VALIDATION", `${student.name} já está inscrito neste evento.`, { httpStatus: 409 });
  }
}

/** Escopo e dias validos para a forma de cobranca do evento. */
function resolveScope(event: Event, input: Pick<RegisterForEvent, "scope" | "sessionIds">): { scope: EventRegistrationScope; sessionIds?: Id[] } {
  const scope = input.scope ?? "full";
  if (scope === "full") return { scope };
  if (event.billingMode !== "per_day") {
    throw apiError("VALIDATION", "Este evento não tem inscrição por dia.", { httpStatus: 422 });
  }
  const sessionIds = [...new Set(input.sessionIds ?? [])];
  assertDaysBelongToEvent(event.id, sessionIds, sessionsOf(event.id));
  return { scope, sessionIds };
}

function defaultPayment(event: Event, scope: EventRegistrationScope, dayCount: number): EventRegistrationPayment {
  return {
    amountCents: suggestedRegistrationPrice(event, scope, dayCount, todayISO()),
    installments: 1,
    firstDueDate: todayISO(),
  };
}

/** Parcelas da inscricao (`Charge` kind "event"); por dia, uma cobranca por dia escolhido. */
function createCharges(event: Event, registration: EventRegistration, payment: EventRegistrationPayment): Charge[] {
  if (payment.amountCents <= 0) return [];
  const ts = nowIso();
  const base = {
    organizationId: store.organization.id,
    unitId: event.unitId,
    studentId: registration.studentId,
    kind: "event" as const,
    eventId: event.id,
    eventRegistrationId: registration.id,
    installmentGroupId: registration.installmentGroupId,
    status: "pending" as const,
    createdAt: ts,
    updatedAt: ts,
  };
  if (registration.scope === "days") {
    const days = sessionsOf(event.id).filter((s) => (registration.sessionIds ?? []).includes(s.id));
    const parts = splitInstallments(payment.amountCents, days.length, payment.firstDueDate);
    return parts.map((part, i) => ({
      ...base,
      id: newId(),
      sessionId: days[i].id,
      description: `${event.name} · ${brDate(days[i].date)}`,
      competence: payment.firstDueDate.slice(0, 7),
      dueDate: payment.firstDueDate,
      amountCents: part.amountCents,
      cycleIndex: part.index,
      cycleTotal: part.total,
    }));
  }
  return splitInstallments(payment.amountCents, payment.installments, payment.firstDueDate).map((part) => ({
    ...base,
    id: newId(),
    description: event.name,
    competence: part.dueDate.slice(0, 7),
    dueDate: part.dueDate,
    amountCents: part.amountCents,
    cycleIndex: part.index,
    cycleTotal: part.total,
  }));
}

/**
 * Confirma (ou reserva, na "vaga so com o pagamento") e gera as parcelas.
 * As duas ganham o codigo do ingresso na hora (12/11/2026): o endereco
 * `/p/i/<codigo>` e a pagina da inscricao, onde a reserva paga e, ao pagar,
 * vira o ingresso. Na entrada, codigo de reserva e recusado ("reserved").
 */
function confirm(
  event: Event,
  registration: EventRegistration,
  payment: EventRegistrationPayment | undefined,
  hold?: { minutes: number },
): void {
  const dayScope = registration.scope === "days";
  const dayCount = dayScope ? (registration.sessionIds ?? []).length : activeDays(sessionsOf(event.id)).length;
  const pay = event.billingMode === "free" ? undefined : (payment ?? defaultPayment(event, registration.scope, dayCount));
  if (pay) validateRegistrationPayment(event, pay, dayScope);
  const reserves = Boolean(hold && pay && pay.amountCents > 0);
  registration.status = reserves ? "reserved" : "confirmed";
  if (reserves) registration.holdUntil = new Date(Date.now() + hold!.minutes * 60_000).toISOString();
  registration.ticketCode ??= newTicketCode();
  registration.amountCents = pay?.amountCents ?? 0;
  registration.installments = dayScope ? 1 : (pay?.installments ?? 1);
  if (pay && pay.amountCents > 0) {
    registration.installmentGroupId = newId();
    store.charges.push(...createCharges(event, registration, pay));
  }
}

/** Cancela as cobrancas em aberto da inscricao (e o Pix delas). Devolve quantas. */
function cancelOpenCharges(registrationId: Id, reason: string): number {
  const ts = nowIso();
  let count = 0;
  for (const c of store.charges) {
    if (c.eventRegistrationId !== registrationId || (c.status !== "pending" && c.status !== "overdue")) continue;
    c.status = "canceled";
    c.canceledBy = "system";
    c.cancelReason = reason;
    c.updatedAt = ts;
    cancelOnlinePaymentsForCharge(c.id);
    count += 1;
  }
  return count;
}

/**
 * Reservas vencidas sem pagamento: a inscricao cai, as cobrancas em aberto sao
 * canceladas (o Pix tambem) e a vaga volta. Devolve quantas cairam.
 */
export function releaseExpiredReservations(eventId?: Id, now = Date.now()): number {
  const ts = nowIso();
  let released = 0;
  for (const registration of eventRegistrationsStore()) {
    if (registration.status !== "reserved" || (eventId && registration.eventId !== eventId)) continue;
    if (!registration.holdUntil || Date.parse(registration.holdUntil) > now) continue;
    registration.status = "canceled";
    registration.canceledAt = ts;
    registration.cancellationReason = "Reserva vencida sem pagamento";
    registration.holdUntil = undefined;
    cancelOpenCharges(registration.id, "Reserva vencida sem pagamento");
    released += 1;
  }
  return released;
}

/** Como a inscricao entra: pela equipe (padrao) ou pelo link publico. */
export interface RegisterOptions {
  source?: EventRegistrationSource;
  /** "Vaga so com o pagamento": reserva por este tempo. */
  hold?: { minutes: number };
  signupEvidence?: Record<string, unknown>;
}

/**
 * Inscreve dentro de uma gravacao ja aberta: lotou, espera sem cobranca; senao
 * confirma (ou reserva) e gera as parcelas. A equipe e o link publico usam.
 */
export function registerInWorld(input: RegisterForEvent, options: RegisterOptions = {}): EventRegistration {
  const event = findEvent(input.eventId);
  releaseExpiredReservations(event.id);
  assertStudentCanRegister(event, input.studentId);
  const { scope, sessionIds } = resolveScope(event, input);
  const registration: EventRegistration = {
    id: newId(),
    eventId: event.id,
    studentId: input.studentId,
    scope,
    ...(sessionIds ? { sessionIds } : {}),
    status: "waitlist",
    amountCents: 0,
    installments: 1,
    registeredAt: nowIso(),
    source: options.source ?? "staff",
    ...(options.signupEvidence ? { signupEvidence: options.signupEvidence } : {}),
  };
  const name = studentName(input.studentId);
  const via = registration.source === "public_link" ? " pelo link" : "";
  if (isFull(event)) {
    eventRegistrationsStore().push(registration);
    auditLogService.record({
      action: "created",
      target: { type: "event_registration", id: registration.id, label: `${name} em ${event.name}` },
      predicate: `pôs ${name} na lista de espera do evento ${event.name}${via} (lotado)`,
    });
    return registration;
  }
  confirm(event, registration, input.payment, options.hold);
  eventRegistrationsStore().push(registration);
  const what =
    registration.status === "reserved"
      ? `reservou a vaga de ${name} no evento ${event.name}${via} até o pagamento (${describePayment(registration)})`
      : scope === "days"
        ? `inscreveu ${name} em ${plural(sessionIds?.length ?? 0, "dia", "dias")} do evento ${event.name}${via} (${describePayment(registration)})`
        : `inscreveu ${name} no evento ${event.name}${via} (${describePayment(registration)})`;
  auditLogService.record({
    action: "created",
    target: { type: "event_registration", id: registration.id, label: `${name} em ${event.name}` },
    predicate: what,
  });
  return registration;
}

function describePayment(registration: EventRegistration): string {
  if (registration.amountCents <= 0) return "sem cobrança";
  const parts = registration.installments > 1 ? `, em ${registration.installments} parcelas` : "";
  return `${formatCents(registration.amountCents)}${parts}`;
}

export const eventRegistrationsService = {
  listRegistrations(eventId: Id): Promise<EventRegistrationView[]> {
    return readOp(async () => {
      const event = findEvent(eventId);
      assertTeacherSeesEvent(event);
      const order: Record<EventRegistration["status"], number> = { confirmed: 0, reserved: 1, waitlist: 2, canceled: 3 };
      return clone(
        registrationsOf(eventId)
          .map(toRegistrationView)
          .sort((a, b) => order[a.status] - order[b.status] || a.studentName.localeCompare(b.studentName, "pt-BR")),
      );
    });
  },

  /**
   * Inscreve: lotou, entra na lista de espera sem cobranca; senao confirma e
   * gera as parcelas (valor editavel, sugerido pelo evento e pelo lote).
   */
  register(input: RegisterForEvent): Promise<EventRegistrationView> {
    return writeOp(async () => clone(toRegistrationView(registerInWorld(input))));
  },

  /** Da lista de espera para confirmado, com a cobranca; so se abriu vaga. */
  promoteFromWaitlist(registrationId: Id, payment?: EventRegistrationPayment): Promise<EventRegistrationView> {
    return writeOp(async () => {
      const registration = findRegistration(registrationId);
      if (registration.status !== "waitlist") {
        throw apiError("VALIDATION", "Esta inscrição já saiu da lista de espera.", { httpStatus: 409 });
      }
      const event = findEvent(registration.eventId);
      if (event.status === "canceled") throw apiError("VALIDATION", "Este evento foi cancelado.", { httpStatus: 409 });
      if (isFull(event)) {
        throw apiError("VALIDATION", "O evento continua lotado. Abra uma vaga antes de promover.", { httpStatus: 422 });
      }
      const student = store.clients.find((c) => c.id === registration.studentId);
      if (!student || student.status !== "active") {
        throw apiError("VALIDATION", `${student?.name ?? "O aluno"} está inativo. Reative o aluno antes de inscrever.`, { httpStatus: 422 });
      }
      confirm(event, registration, payment);
      auditLogService.record({
        action: "updated",
        target: { type: "event_registration", id: registration.id, label: `${student.name} em ${event.name}` },
        predicate: `promoveu ${student.name} da lista de espera do evento ${event.name} (${describePayment(registration)})`,
      });
      return clone(toRegistrationView(registration));
    });
  },

  /** Cancela a inscricao: parcelas pagas ficam, futuras saem, vencidas continuam (regra do curso). */
  cancelRegistration(registrationId: Id, reason?: string): Promise<void> {
    return writeOp(async () => {
      const registration = findRegistration(registrationId);
      if (registration.status === "canceled") {
        throw apiError("VALIDATION", "Esta inscrição já foi cancelada.", { httpStatus: 409 });
      }
      const event = findEvent(registration.eventId);
      const wasWaiting = registration.status === "waitlist";
      const wasReserved = registration.status === "reserved";
      registration.status = "canceled";
      registration.canceledAt = nowIso();
      registration.cancellationReason = reason?.trim() || undefined;
      registration.holdUntil = undefined;
      // Reserva cancelada: sai tambem a cobranca de hoje (a vaga nunca foi paga).
      const canceled = wasWaiting
        ? 0
        : wasReserved
          ? cancelOpenCharges(registration.id, "Inscrição cancelada")
          : cancelFutureInstallments(registration.id, "Inscrição cancelada");
      const name = studentName(registration.studentId);
      auditLogService.record({
        action: "cancelled",
        target: { type: "event_registration", id: registration.id, label: `${name} em ${event.name}` },
        predicate: wasWaiting
          ? `tirou ${name} da lista de espera do evento ${event.name}`
          : `cancelou a inscrição de ${name} no evento ${event.name}${canceled > 0 ? ` e ${plural(canceled, "parcela futura", "parcelas futuras")}` : ""}`,
      });
    });
  },
};
