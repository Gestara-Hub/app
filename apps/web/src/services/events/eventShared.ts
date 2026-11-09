import type {
  Event,
  EventAttendance,
  EventRegistration,
  EventSession,
  Id,
} from "@gestarahub/contracts";
import { dateInSpace } from "@gestarahub/core/date";
import { apiError, notFoundError } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { actorTeacherId } from "../classes/teacherScope";

/**
 * Base dos servicos de eventos e seminarios (doc product/29). As colecoes sao
 * opcionais no espaco (nascem no 1o uso, como as avaliacoes); quem le passa
 * por aqui para nunca tocar `undefined`.
 */

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function todayISO(): string {
  return dateInSpace();
}

export function eventsStore(): Event[] {
  if (!store.events) store.events = [];
  return store.events;
}
export function eventSessionsStore(): EventSession[] {
  if (!store.eventSessions) store.eventSessions = [];
  return store.eventSessions;
}
export function eventRegistrationsStore(): EventRegistration[] {
  if (!store.eventRegistrations) store.eventRegistrations = [];
  return store.eventRegistrations;
}
export function eventAttendancesStore(): EventAttendance[] {
  if (!store.eventAttendances) store.eventAttendances = [];
  return store.eventAttendances;
}

export const EVENT_NOT_FOUND = "Evento não encontrado.";
export const EVENT_DAY_NOT_FOUND = "Dia do evento não encontrado.";
export const REGISTRATION_NOT_FOUND = "Inscrição não encontrada.";

export function findEvent(id: Id): Event {
  const event = eventsStore().find((e) => e.id === id);
  if (!event) throw notFoundError(EVENT_NOT_FOUND);
  return event;
}

export function findSession(id: Id): EventSession {
  const session = eventSessionsStore().find((s) => s.id === id);
  if (!session) throw notFoundError(EVENT_DAY_NOT_FOUND);
  return session;
}

export function findRegistration(id: Id): EventRegistration {
  const registration = eventRegistrationsStore().find((r) => r.id === id);
  if (!registration) throw notFoundError(REGISTRATION_NOT_FOUND);
  return registration;
}

/** Dias do evento em ordem (data e inicio). */
export function sessionsOf(eventId: Id): EventSession[] {
  return eventSessionsStore()
    .filter((s) => s.eventId === eventId)
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
}

export function registrationsOf(eventId: Id): EventRegistration[] {
  return eventRegistrationsStore().filter((r) => r.eventId === eventId);
}

export function confirmedRegistrations(eventId: Id): EventRegistration[] {
  return registrationsOf(eventId).filter((r) => r.status === "confirmed");
}

export function studentName(id: Id): string {
  return store.clients.find((c) => c.id === id)?.name ?? "";
}

export function modalityName(id?: Id): string | undefined {
  return id ? store.categories.find((c) => c.id === id)?.name : undefined;
}

/** Quem conduz: o profissional da equipe ou o convidado pelo nome. */
export function conductorName(event: Pick<Event, "instructorId" | "guestInstructorName">): string {
  if (event.instructorId) return store.professionals.find((p) => p.id === event.instructorId)?.name ?? "";
  return event.guestInstructorName ?? "";
}

/** A inscricao cobre o dia: completa, ou por dias com este dia escolhido. */
export function registrationCoversDay(registration: EventRegistration, sessionId: Id): boolean {
  return registration.scope === "full" || (registration.sessionIds ?? []).includes(sessionId);
}

// --- Escopo do professor ------------------------------------------------------

/** O professor ve o evento: conduz ele. Convidado nao e usuario, entao so quem gere ve esses. */
export function teacherSeesEvent(event: Pick<Event, "instructorId">, teacherId = actorTeacherId()): boolean {
  return teacherId === undefined || event.instructorId === teacherId;
}

export function assertTeacherSeesEvent(event: Pick<Event, "instructorId">, message = "Você só vê os eventos que conduz."): void {
  if (!teacherSeesEvent(event)) throw apiError("FORBIDDEN", message, { httpStatus: 403 });
}

export { actorTeacherId };
