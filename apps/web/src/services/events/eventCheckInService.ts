import type { CheckInList, EventAttendance, Id, OfflineCheckIn, OfflineCheckInSyncResult, TicketCheckResult } from "@gestarahub/contracts";
import { getCurrentActor } from "@/services/world/actor";
import { apiError, newId, nowIso, readOp, writeOp } from "@/services/world/ops";
import { store } from "@/services/world/store";
import {
  assertTeacherConductsSession,
  eventAttendancesStore,
  eventRegistrationsStore,
  eventsStore,
  findEvent,
  findSession,
  registrationCoversDay,
  registrationsOf,
  sessionsOf,
  studentName,
  todayISO,
} from "./eventShared";
import { dayPosition } from "@gestarahub/core/events";

/**
 * Entrada pelo ingresso (doc product/29 T4 a T6): a leitura do QR confere a
 * inscricao e, se esta tudo certo, ja marca presente no dia. Pagamento em
 * aberto entra com aviso (decidido em 12/11/2026): a primeira leitura para e
 * pede a confirmacao; com `confirm`, entra. A segunda leitura no dia responde
 * "Ja entrou", contra print repassado.
 */

/** O codigo como a pessoa digitou ou o QR trouxe: so letras e numeros, em maiuscula. */
export function normalizeTicketCode(raw: string): string {
  const value = raw.trim();
  // QR com o endereco do ingresso (`.../p/i/<codigo>`) ou so o codigo.
  const fromUrl = /\/p\/i\/([A-Za-z0-9-]+)/.exec(value)?.[1] ?? value;
  return fromUrl.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function openChargesOf(registrationId: Id) {
  return store.charges.filter((c) => c.eventRegistrationId === registrationId && (c.status === "pending" || c.status === "overdue"));
}

/**
 * `preview`: so confere, sem marcar (a pagina do ingresso aberta pela camera
 * comum mostra o resultado e espera o "Confirmar entrada").
 */
export function checkTicketInWorld(input: { sessionId: Id; code: string; confirm?: boolean; preview?: boolean }): TicketCheckResult {
  const session = findSession(input.sessionId);
  const event = findEvent(session.eventId);
  assertTeacherConductsSession(event, session);
  if (session.status === "canceled") throw apiError("VALIDATION", "Este dia foi cancelado.", { httpStatus: 409 });

  const code = normalizeTicketCode(input.code);
  const registration = code ? eventRegistrationsStore().find((r) => r.ticketCode === code) : undefined;
  if (!registration) return { outcome: "not_found", entered: false };
  const base = { registrationId: registration.id, studentName: studentName(registration.studentId) };
  if (registration.eventId !== event.id) {
    const other = eventsStore().find((e) => e.id === registration.eventId);
    return { ...base, outcome: "other_event", entered: false, ...(other ? { otherEventName: other.name } : {}) };
  }
  // O dia desta leitura (dia 3 de 3): a equipe ve que dia esta marcando.
  const position = dayPosition(sessionsOf(event.id), session.id);
  const here = { ...base, ...(position ? { day: { date: session.date, ...position } } : {}) };
  if (registration.status === "canceled") return { ...here, outcome: "canceled", entered: false };
  if (registration.status === "waitlist") return { ...here, outcome: "waitlist", entered: false };
  const open = openChargesOf(registration.id);
  const pendingCents = open.reduce((sum, c) => sum + c.amountCents, 0);
  const pending = pendingCents > 0 ? { pendingCents, pendingChargeId: open[0].id } : {};
  if (registration.status === "reserved") return { ...here, ...pending, outcome: "reserved", entered: false };
  if (!registrationCoversDay(registration, session.id)) return { ...here, outcome: "not_this_day", entered: false };
  if (session.date !== todayISO()) return { ...here, outcome: "not_today", entered: false };

  const marks = eventAttendancesStore();
  const existing = marks.find((a) => a.sessionId === session.id && a.registrationId === registration.id);
  if (existing?.status === "present" && existing.checkedInAt) {
    return { ...here, outcome: "already", entered: false, checkedInAt: existing.checkedInAt, ...(existing.checkedInBy ? { checkedInBy: existing.checkedInBy } : {}) };
  }
  if (pendingCents > 0 && !input.confirm) return { ...here, ...pending, outcome: "payment_pending", entered: false };
  if (input.preview) return { ...here, ...pending, outcome: pendingCents > 0 ? "payment_pending" : "ok", entered: false };

  const at = nowIso();
  const by = getCurrentActor()?.name;
  if (existing) {
    existing.status = "present";
    existing.markedAt = at;
    existing.checkedInAt = at;
    if (by) existing.checkedInBy = by;
  } else {
    const mark: EventAttendance = {
      id: newId(),
      eventId: event.id,
      sessionId: session.id,
      registrationId: registration.id,
      studentId: registration.studentId,
      status: "present",
      markedAt: at,
      checkedInAt: at,
      ...(by ? { checkedInBy: by } : {}),
    };
    marks.push(mark);
  }
  return { ...here, ...pending, outcome: pendingCents > 0 ? "payment_pending" : "ok", entered: true, checkedInAt: at };
}

/** SHA-256 em hex (Web Crypto: servidor e navegador fazem a mesma conta). */
export async function ticketCodeHash(code: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalizeTicketCode(code)));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const eventCheckInService = {
  /** Le o ingresso no dia do evento e, se der, marca a entrada. */
  checkInTicket(input: { sessionId: Id; code: string; confirm?: boolean; preview?: boolean }): Promise<TicketCheckResult> {
    return writeOp(async () => checkTicketInWorld(input));
  },

  /**
   * Lista do dia para o celular da porta (sem internet): inscricoes confirmadas
   * e reservadas que cobrem o dia, com o codigo embaralhado, o nome, o valor em
   * aberto e quem ja entrou.
   */
  getCheckInList(sessionId: Id): Promise<CheckInList> {
    return readOp(async () => {
      const session = findSession(sessionId);
      const event = findEvent(session.eventId);
      assertTeacherConductsSession(event, session);
      const marks = eventAttendancesStore().filter((a) => a.sessionId === sessionId);
      const registrations = registrationsOf(event.id).filter(
        (r) => (r.status === "confirmed" || r.status === "reserved") && r.ticketCode && registrationCoversDay(r, sessionId),
      );
      const entries = await Promise.all(
        registrations.map(async (r) => {
          const mark = marks.find((a) => a.registrationId === r.id && a.status === "present");
          return {
            registrationId: r.id,
            codeHash: await ticketCodeHash(r.ticketCode!),
            studentName: studentName(r.studentId),
            status: r.status as "confirmed" | "reserved",
            pendingCents: openChargesOf(r.id).reduce((sum, c) => sum + c.amountCents, 0),
            ...(mark?.checkedInAt ? { checkedInAt: mark.checkedInAt } : {}),
          };
        }),
      );
      const position = dayPosition(sessionsOf(event.id), sessionId);
      return {
        sessionId,
        eventName: event.name,
        date: session.date,
        ...(position ? { dayPosition: position.position, dayTotal: position.total } : {}),
        generatedAt: nowIso(),
        entries,
      };
    });
  },

  /**
   * Entradas feitas sem internet, numa gravacao so. Vale a primeira entrada:
   * a segunda (outra porta) volta como repetida. Ingresso que nao estava na
   * lista e conferido aqui, como na leitura com internet.
   */
  syncOfflineCheckIns(input: { sessionId: Id; entries: OfflineCheckIn[] }): Promise<OfflineCheckInSyncResult> {
    return writeOp(async () => {
      const session = findSession(input.sessionId);
      const event = findEvent(session.eventId);
      assertTeacherConductsSession(event, session);
      const by = getCurrentActor()?.name;
      const result: OfflineCheckInSyncResult = { applied: 0, duplicates: [], rejected: [] };
      const ordered = [...input.entries].sort((a, b) => a.at.localeCompare(b.at));
      for (const entry of ordered) {
        let registrationId = entry.registrationId;
        if (!registrationId && entry.code) {
          const code = normalizeTicketCode(entry.code);
          const found = eventRegistrationsStore().find((r) => r.ticketCode === code);
          const valid = found && found.eventId === event.id && found.status === "confirmed" && registrationCoversDay(found, session.id);
          if (!valid) {
            result.rejected.push({ code, reason: found ? "Ingresso que não vale neste dia" : "Ingresso não encontrado" });
            continue;
          }
          registrationId = found.id;
        }
        const registration = registrationsOf(event.id).find((r) => r.id === registrationId);
        if (!registration || !registrationCoversDay(registration, session.id)) {
          result.rejected.push({ code: entry.code ?? "", reason: "Inscrição fora deste dia" });
          continue;
        }
        const marks = eventAttendancesStore();
        const existing = marks.find((a) => a.sessionId === session.id && a.registrationId === registration.id);
        if (existing?.status === "present" && existing.checkedInAt) {
          result.duplicates.push({
            studentName: studentName(registration.studentId),
            firstAt: existing.checkedInAt,
            ...(existing.checkedInBy ? { firstBy: existing.checkedInBy } : {}),
          });
          continue;
        }
        const offlineBy = by ? `${by} (sem internet)` : "Sem internet";
        if (existing) {
          Object.assign(existing, { status: "present", markedAt: nowIso(), checkedInAt: entry.at, checkedInBy: offlineBy });
        } else {
          marks.push({
            id: newId(),
            eventId: event.id,
            sessionId: session.id,
            registrationId: registration.id,
            studentId: registration.studentId,
            status: "present",
            markedAt: nowIso(),
            checkedInAt: entry.at,
            checkedInBy: offlineBy,
          });
        }
        result.applied += 1;
      }
      return result;
    });
  },

  /** "Desfazer" da faixa: tira a entrada marcada pela leitura. */
  undoCheckIn(input: { sessionId: Id; registrationId: Id }): Promise<void> {
    return writeOp(async () => {
      const session = findSession(input.sessionId);
      assertTeacherConductsSession(findEvent(session.eventId), session);
      store.eventAttendances = eventAttendancesStore().filter(
        (a) => !(a.sessionId === input.sessionId && a.registrationId === input.registrationId),
      );
    });
  },
};
