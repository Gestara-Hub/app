import type { EventAttendance, EventAttendanceStatus, EventSessionDetail, Id } from "@gestarahub/contracts";
import { apiError, newId, nowIso, writeOp } from "@/services/world/ops";
import { store } from "@/services/world/store";
import {
  assertTeacherConductsSession,
  clone,
  confirmedRegistrations,
  eventAttendancesStore,
  findEvent,
  findSession,
  registrationCoversDay,
  todayISO,
} from "./eventShared";
import { sessionDetailOf } from "./eventViews";

/**
 * Chamada do dia do evento (doc product/29 §Chamada): presente ou ausente,
 * uma marcacao por inscrito e dia; so no dia ou depois; so quem esta inscrito
 * naquele dia. Sem falta justificada.
 */

function applyMark(sessionId: Id, registrationId: Id, status: EventAttendanceStatus): void {
  const session = findSession(sessionId);
  const event = findEvent(session.eventId);
  assertTeacherConductsSession(event, session);
  if (session.status === "canceled") throw apiError("VALIDATION", "Este dia foi cancelado.", { httpStatus: 409 });
  if (session.date > todayISO()) {
    throw apiError("VALIDATION", "A chamada só pode ser feita no dia do evento ou depois.", { httpStatus: 422 });
  }
  const registration = confirmedRegistrations(event.id).find((r) => r.id === registrationId);
  if (!registration || !registrationCoversDay(registration, sessionId)) {
    throw apiError("VALIDATION", "Este aluno não está inscrito neste dia.", { httpStatus: 422 });
  }
  const marks = eventAttendancesStore();
  const existing = marks.find((a) => a.sessionId === sessionId && a.registrationId === registrationId);
  if (existing) {
    existing.status = status;
    existing.markedAt = nowIso();
    return;
  }
  const mark: EventAttendance = {
    id: newId(),
    eventId: event.id,
    sessionId,
    registrationId,
    studentId: registration.studentId,
    status,
    markedAt: nowIso(),
  };
  marks.push(mark);
}

export const eventAttendanceService = {
  markEventAttendance(input: { sessionId: Id; registrationId: Id; status: EventAttendanceStatus }): Promise<EventSessionDetail> {
    return writeOp(async () => {
      applyMark(input.sessionId, input.registrationId, input.status);
      return clone(sessionDetailOf(findSession(input.sessionId)));
    });
  },

  /** Varios de uma vez ("Todos vieram"): uma gravacao so. */
  markManyEventAttendance(input: { sessionId: Id; registrationIds: Id[]; status: EventAttendanceStatus }): Promise<EventSessionDetail> {
    return writeOp(async () => {
      for (const registrationId of input.registrationIds) applyMark(input.sessionId, registrationId, input.status);
      return clone(sessionDetailOf(findSession(input.sessionId)));
    });
  },

  /** Volta a "a marcar". */
  clearEventAttendance(input: { sessionId: Id; registrationId: Id }): Promise<EventSessionDetail> {
    return writeOp(async () => {
      const session = findSession(input.sessionId);
      assertTeacherConductsSession(findEvent(session.eventId), session);
      store.eventAttendances = eventAttendancesStore().filter(
        (a) => !(a.sessionId === input.sessionId && a.registrationId === input.registrationId),
      );
      return clone(sessionDetailOf(session));
    });
  },
};
