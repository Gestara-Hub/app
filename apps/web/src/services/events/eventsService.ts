import type {
  CreateEvent,
  CreateEventSession,
  DateISO,
  Event,
  EventFilter,
  EventFinanceView,
  EventSession,
  EventSessionDetail,
  EventSessionView,
  EventView,
  Id,
  UpdateEvent,
} from "@gestarahub/contracts";
import { eventStage } from "@gestarahub/core/events";
import { isFutureOpenInstallment } from "@gestarahub/core/billing";
import { plural } from "@gestarahub/core/format";
import { apiError, newId, nowIso, readOp, textIncludes, validationError, writeOp } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { auditLogService } from "../audit/auditLogService";
import { cancelOnlinePaymentsForCharge } from "../onlinePayments";
import { toChargeView } from "../billing/billingViews";
import {
  actorTeacherId,
  assertTeacherSeesEvent,
  clone,
  eventAttendancesStore,
  eventSessionsStore,
  eventsStore,
  findEvent,
  findSession,
  assertTeacherConductsSession,
  instructorViews,
  registrationsOf,
  sessionsOf,
  teacherConductsSession,
  teacherSeesEvent,
  todayISO,
} from "./eventShared";
import { normalizeEvent, validateEvent, validateSessions } from "./eventValidation";
import { sessionDetailOf, toEventView, toSessionView } from "./eventViews";

/**
 * Eventos e seminarios (doc product/29): cadastro com dias soltos, cancelar
 * um dia ou o evento inteiro, e as leituras do Calendario e do dia.
 */

function brDate(iso: DateISO): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function newSession(eventId: Id, input: CreateEventSession, ts: string): EventSession {
  return {
    id: input.id ?? newId(),
    eventId,
    date: input.date,
    start: input.start,
    end: input.end,
    status: "scheduled",
    ...(input.instructorIds?.length ? { instructorIds: [...new Set(input.instructorIds)] } : {}),
    createdAt: ts,
    updatedAt: ts,
  };
}

/** Parcelas futuras em aberto de uma inscricao saem quando ela ou o evento e cancelado (regra do curso). */
export function cancelFutureInstallments(registrationId: Id, reason: string): number {
  const today = todayISO();
  const ts = nowIso();
  let count = 0;
  for (const c of store.charges) {
    if (c.kind !== "event" || c.eventRegistrationId !== registrationId || !isFutureOpenInstallment(c, today)) continue;
    c.status = "canceled";
    c.canceledBy = "system";
    c.cancelReason = reason;
    c.updatedAt = ts;
    cancelOnlinePaymentsForCharge(c.id);
    count += 1;
  }
  return count;
}

export const eventsService = {
  list(filter?: EventFilter): Promise<EventView[]> {
    return readOp(async () => {
      let result = eventsStore();
      if (filter?.search) {
        const term = filter.search;
        // Nome do evento ou de qualquer pessoa que conduz (equipe ou convidado).
        result = result.filter((e) => textIncludes(e.name, term) || instructorViews(e).some((i) => textIncludes(i.name, term)));
      }
      if (filter?.status) result = result.filter((e) => e.status === filter.status);
      if (filter?.instructorId) result = result.filter((e) => e.instructors.some((i) => i.professionalId === filter.instructorId));
      if (filter?.modalityId) result = result.filter((e) => e.modalityId === filter.modalityId);
      const teacherId = actorTeacherId();
      if (teacherId !== undefined) result = result.filter((e) => teacherSeesEvent(e, teacherId));
      let views = result.map(toEventView);
      if (filter?.stage) views = views.filter((v) => v.stage === filter.stage);
      if (filter?.dateFrom || filter?.dateTo) {
        views = views.filter((v) =>
          v.sessions.some(
            (s) => s.status !== "canceled" && (!filter.dateFrom || s.date >= filter.dateFrom) && (!filter.dateTo || s.date <= filter.dateTo),
          ),
        );
      }
      // Proximos primeiro; os encerrados vao para o fim, do mais recente ao mais antigo.
      const order = (v: EventView) => (v.stage === "finished" ? 1 : 0);
      views.sort(
        (a, b) =>
          order(a) - order(b) ||
          (order(a) === 1
            ? (b.lastDate ?? "").localeCompare(a.lastDate ?? "")
            : (a.firstDate ?? "9999").localeCompare(b.firstDate ?? "9999")) ||
          a.name.localeCompare(b.name, "pt-BR"),
      );
      return clone(views);
    });
  },

  getById(id: Id): Promise<EventView> {
    return readOp(async () => {
      const event = findEvent(id);
      assertTeacherSeesEvent(event);
      return clone(toEventView(event));
    });
  },

  /** Dias de todos os eventos no periodo (Calendario junto das aulas). */
  listSessions(filter: { dateFrom: DateISO; dateTo: DateISO }): Promise<EventSessionView[]> {
    return readOp(async () => {
      const teacherId = actorTeacherId();
      const visible = new Map(
        eventsStore()
          .filter((e) => e.status === "active" && teacherSeesEvent(e, teacherId))
          .map((e) => [e.id, e]),
      );
      // O professor ve no Calendario so os blocos que conduz.
      const sessions = eventSessionsStore()
        .filter((s) => {
          const event = visible.get(s.eventId);
          return Boolean(event) && s.status !== "canceled" && s.date >= filter.dateFrom && s.date <= filter.dateTo && teacherConductsSession(event!, s, teacherId);
        })
        .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
      return clone(sessions.map(toSessionView));
    });
  },

  /** Financeiro do evento: parcelas das inscricoes e lancamentos ligados a ele. */
  getEventFinance(eventId: Id): Promise<EventFinanceView> {
    return readOp(async () => {
      const event = findEvent(eventId);
      assertTeacherSeesEvent(event);
      const charges = store.charges
        .filter((c) => c.eventId === eventId)
        .map(toChargeView)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.studentName.localeCompare(b.studentName, "pt-BR"));
      const entries = store.financialEntries
        .filter((e) => e.eventId === eventId)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const sum = <T,>(items: T[], pick: (item: T) => number) => items.reduce((total, item) => total + pick(item), 0);
      const receivedCents = sum(charges.filter((c) => c.status === "paid"), (c) => c.amountCents);
      const openCents = sum(charges.filter((c) => c.status === "pending" || c.status === "overdue"), (c) => c.amountCents);
      const overdueCents = sum(charges.filter((c) => c.status === "overdue"), (c) => c.amountCents);
      const live = entries.filter((e) => e.status !== "canceled");
      const expensesCents = sum(live.filter((e) => e.type === "expense"), (e) => e.amountCents);
      const otherIncomeCents = sum(live.filter((e) => e.type === "income"), (e) => e.amountCents);
      const paidExpenses = sum(live.filter((e) => e.type === "expense" && e.status === "paid"), (e) => e.amountCents);
      const paidIncome = sum(live.filter((e) => e.type === "income" && e.status === "paid"), (e) => e.amountCents);
      return clone({
        receivedCents,
        openCents,
        overdueCents,
        expensesCents,
        otherIncomeCents,
        resultCents: receivedCents + paidIncome - paidExpenses,
        charges,
        entries,
      });
    });
  },

  getSessionDetail(sessionId: Id): Promise<EventSessionDetail> {
    return readOp(async () => {
      const session = findSession(sessionId);
      assertTeacherConductsSession(findEvent(session.eventId), session, "Você só vê os dias que conduz.");
      return clone(sessionDetailOf(session));
    });
  },

  create(input: CreateEvent): Promise<EventView> {
    return writeOp(async () => {
      const { sessions, ...rest } = input;
      const payload = normalizeEvent(rest);
      validateEvent(payload);
      validateSessions(sessions ?? [], payload.instructors);
      const ts = nowIso();
      const event: Event = {
        ...payload,
        id: newId(),
        organizationId: store.organization.id,
        unitId: store.unit.id,
        status: "active",
        createdAt: ts,
        updatedAt: ts,
      };
      eventsStore().push(event);
      eventSessionsStore().push(...sessions.map((s) => newSession(event.id, s, ts)));
      auditLogService.record({
        action: "created",
        target: { type: "event", id: event.id, label: event.name },
        predicate: `criou o evento ${event.name} (${plural(sessions.length, "dia", "dias")})`,
      });
      return clone(toEventView(event));
    });
  },

  /**
   * Editar: dados e dias. Dia ja feito (data ate hoje) ou cancelado nao muda
   * nem sai; dia com chamada feita tambem nao sai.
   */
  update(id: Id, payload: UpdateEvent): Promise<EventView> {
    return writeOp(async () => {
      const current = findEvent(id);
      if (current.status === "canceled") {
        throw apiError("VALIDATION", "Este evento foi cancelado e não pode ser editado.", { httpStatus: 409 });
      }
      const { sessions, ...rest } = payload;
      const next = normalizeEvent({ ...current, ...rest });
      validateEvent(next, current);
      const ts = nowIso();
      const today = todayISO();
      const existingDays = sessionsOf(id);
      const isLocked = (s: EventSession) => s.status === "canceled" || s.date <= today;
      // Quem ja conduziu um dia feito (ou cancelado) nao sai da lista: o dia guarda quem conduziu.
      const nextIds = new Set(next.instructors.map((i) => i.id));
      for (const s of existingDays) {
        if (!isLocked(s)) continue;
        const gone = (s.instructorIds ?? []).find((iid) => !nextIds.has(iid));
        if (gone) {
          const name = instructorViews(current).find((i) => i.id === gone)?.name || "Essa pessoa";
          throw validationError([
            { field: "instructors", message: `${name} conduziu o dia ${brDate(s.date)}, que já aconteceu, e não pode sair do evento.` },
          ]);
        }
      }
      if (sessions) {
        // Dia ja feito vem como esta: quem conduziu fica, mesmo fora da escolha nova.
        validateSessions(
          sessions.map((input) => {
            const found = input.id ? existingDays.find((s) => s.id === input.id) : undefined;
            return found && isLocked(found) ? { ...input, instructorIds: found.instructorIds } : input;
          }),
          next.instructors,
        );
        const existing = existingDays;
        const keptIds = new Set(sessions.map((s) => s.id).filter(Boolean));
        for (const s of existing) {
          if (keptIds.has(s.id)) continue;
          const locked = s.status === "canceled" || s.date <= today || eventAttendancesStore().some((a) => a.sessionId === s.id);
          if (locked) {
            throw apiError("VALIDATION", `O dia ${brDate(s.date)} já aconteceu ou tem chamada e não pode sair do evento.`, {
              httpStatus: 422,
            });
          }
        }
        const all = eventSessionsStore();
        const removed = new Set(existing.filter((s) => !keptIds.has(s.id)).map((s) => s.id));
        store.eventSessions = all.filter((s) => !removed.has(s.id));
        for (const input of sessions) {
          const found = input.id ? existing.find((s) => s.id === input.id) : undefined;
          if (!found) {
            eventSessionsStore().push(newSession(id, { ...input, id: undefined }, ts));
            continue;
          }
          // Dia ja feito ou cancelado fica como esta.
          if (found.status === "canceled" || found.date <= today) continue;
          const chosen = [...new Set(input.instructorIds ?? [])];
          const sameChoice = chosen.length === (found.instructorIds ?? []).length && chosen.every((iid) => (found.instructorIds ?? []).includes(iid));
          if (found.date !== input.date || found.start !== input.start || found.end !== input.end || !sameChoice) {
            found.date = input.date;
            found.start = input.start;
            found.end = input.end;
            if (chosen.length) found.instructorIds = chosen;
            else delete found.instructorIds;
            found.updatedAt = ts;
          }
        }
      }
      // Quem saiu da lista sai da escolha dos dias que ainda vao acontecer.
      for (const s of sessionsOf(id)) {
        if (isLocked(s) || !s.instructorIds?.length) continue;
        const kept = s.instructorIds.filter((iid) => nextIds.has(iid));
        if (kept.length === s.instructorIds.length) continue;
        if (kept.length) s.instructorIds = kept;
        else delete s.instructorIds;
        s.updatedAt = ts;
      }
      Object.assign(current, next, { id, organizationId: current.organizationId, unitId: current.unitId, updatedAt: ts });
      auditLogService.record({
        action: "updated",
        target: { type: "event", id, label: current.name },
        predicate: `atualizou o evento ${current.name}`,
      });
      return clone(toEventView(current));
    });
  },

  /** Cancela um dia: a chamada dele some do calendario; as inscricoes ficam. */
  cancelSession(sessionId: Id, reason?: string): Promise<EventView> {
    return writeOp(async () => {
      const session = findSession(sessionId);
      const event = findEvent(session.eventId);
      if (session.status === "canceled") {
        throw apiError("VALIDATION", "Este dia já foi cancelado.", { httpStatus: 409 });
      }
      session.status = "canceled";
      session.cancelReason = reason?.trim() || undefined;
      session.updatedAt = nowIso();
      auditLogService.record({
        action: "cancelled",
        target: { type: "event", id: event.id, label: event.name },
        predicate: `cancelou o dia ${brDate(session.date)} do evento ${event.name}${session.cancelReason ? ` (${session.cancelReason})` : ""}`,
      });
      return clone(toEventView(event));
    });
  },

  /** Cancela o evento inteiro: dias, inscricoes e as parcelas futuras em aberto. */
  cancelEvent(id: Id, reason?: string): Promise<EventView> {
    return writeOp(async () => {
      const event = findEvent(id);
      if (event.status === "canceled") {
        throw apiError("VALIDATION", "Este evento já foi cancelado.", { httpStatus: 409 });
      }
      if (eventStage(sessionsOf(id), todayISO()) === "finished") {
        throw apiError("VALIDATION", "Este evento já terminou e não pode ser cancelado.", { httpStatus: 422 });
      }
      const ts = nowIso();
      event.status = "canceled";
      event.canceledAt = ts;
      event.cancelReason = reason?.trim() || undefined;
      event.updatedAt = ts;
      for (const s of sessionsOf(id)) {
        if (s.status === "canceled") continue;
        s.status = "canceled";
        s.updatedAt = ts;
      }
      let canceledRegistrations = 0;
      let canceledInstallments = 0;
      for (const r of registrationsOf(id)) {
        if (r.status === "canceled") continue;
        r.status = "canceled";
        r.canceledAt = ts;
        r.cancellationReason = "Evento cancelado";
        canceledRegistrations += 1;
        canceledInstallments += cancelFutureInstallments(r.id, "Evento cancelado");
      }
      auditLogService.record({
        action: "cancelled",
        target: { type: "event", id, label: event.name },
        predicate:
          `cancelou o evento ${event.name}` +
          (canceledRegistrations > 0 ? ` e ${plural(canceledRegistrations, "inscrição", "inscrições")}` : "") +
          (canceledInstallments > 0 ? ` (${plural(canceledInstallments, "parcela futura cancelada", "parcelas futuras canceladas")})` : "") +
          (event.cancelReason ? `: ${event.cancelReason}` : ""),
      });
      return clone(toEventView(event));
    });
  },
};
