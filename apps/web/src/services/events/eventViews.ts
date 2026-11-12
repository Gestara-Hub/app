import type {
  Event,
  EventRegistration,
  EventRegistrationView,
  EventRosterEntry,
  EventSession,
  EventSessionDetail,
  EventSessionView,
  EventView,
} from "@gestarahub/contracts";
import { activeDays, earlyBirdActive, eventStage, eventTotalHours, suggestedRegistrationPrice } from "@gestarahub/core/events";
import { store } from "@/services/world/store";
import {
  confirmedRegistrations,
  seatHolders,
  eventAttendancesStore,
  findEvent,
  instructorViews,
  modalityName,
  registrationCoversDay,
  registrationsOf,
  sessionInstructorViews,
  sessionsOf,
  studentName,
  todayISO,
} from "./eventShared";

/** Leitura do evento com dias, situacao, vagas e preco sugerido de hoje. */
export function toEventView(event: Event): EventView {
  const sessions = sessionsOf(event.id);
  const active = activeDays(sessions);
  const today = todayISO();
  const registrations = registrationsOf(event.id);
  const confirmedCount = registrations.filter((r) => r.status === "confirmed").length;
  // Vaga livre desconta tambem as reservas valendo ("vaga so com o pagamento").
  const takenSeats = seatHolders(event.id).length;
  const waitlistCount = registrations.filter((r) => r.status === "waitlist").length;
  const availableSpots = event.capacity === undefined ? undefined : Math.max(0, event.capacity - takenSeats);
  return {
    ...event,
    modalityName: modalityName(event.modalityId),
    instructors: instructorViews(event),
    sessions,
    firstDate: active[0]?.date,
    lastDate: active[active.length - 1]?.date,
    stage: eventStage(sessions, today),
    totalHours: eventTotalHours(sessions),
    confirmedCount,
    waitlistCount,
    availableSpots,
    isFull: availableSpots === 0,
    suggestedPriceCents: suggestedRegistrationPrice(event, "full", active.length, today),
    earlyBirdActive: earlyBirdActive(event, today),
  };
}

export function toRegistrationView(registration: EventRegistration): EventRegistrationView {
  const charges = store.charges.filter((c) => c.eventRegistrationId === registration.id);
  const sum = (predicate: (status: string) => boolean) =>
    charges.filter((c) => predicate(c.status)).reduce((total, c) => total + c.amountCents, 0);
  const client = store.clients.find((c) => c.id === registration.studentId);
  return {
    ...registration,
    studentName: client?.name ?? "",
    // Menor sem telefone: o do responsavel (o ingresso e os avisos vao para ele).
    studentPhone: client?.phone ?? client?.guardians?.find((g) => g.financial)?.phone ?? client?.guardians?.[0]?.phone,
    paidCents: sum((s) => s === "paid"),
    openCents: sum((s) => s === "pending" || s === "overdue"),
    overdueCents: sum((s) => s === "overdue"),
    presentCount: eventAttendancesStore().filter((a) => a.registrationId === registration.id && a.status === "present").length,
  };
}

export function toSessionView(session: EventSession): EventSessionView {
  const event = findEvent(session.eventId);
  return {
    ...session,
    eventName: event.name,
    instructors: sessionInstructorViews(event, session),
    modalityName: modalityName(event.modalityId),
    confirmedCount: confirmedRegistrations(event.id).filter((r) => registrationCoversDay(r, session.id)).length,
  };
}

/** Chamada do dia: quem esta inscrito nele, com a marcacao. */
export function buildRoster(session: EventSession): EventRosterEntry[] {
  const marks = eventAttendancesStore().filter((a) => a.sessionId === session.id);
  return confirmedRegistrations(session.eventId)
    .filter((r) => registrationCoversDay(r, session.id))
    .map((r) => ({
      registrationId: r.id,
      studentId: r.studentId,
      studentName: studentName(r.studentId),
      scope: r.scope,
      attendance: marks.find((a) => a.registrationId === r.id)?.status,
    }))
    .sort((a, b) => a.studentName.localeCompare(b.studentName, "pt-BR"));
}

export function sessionDetailOf(session: EventSession): EventSessionDetail {
  const roster = buildRoster(session);
  return {
    session,
    event: toEventView(findEvent(session.eventId)),
    roster,
    presentCount: roster.filter((r) => r.attendance === "present").length,
  };
}
