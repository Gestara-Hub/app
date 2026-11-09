import type { Id } from "@gestarahub/contracts";
import type { MethodSlice, SliceLoader } from "../world/slices";

/**
 * Recortes dos metodos de eventos (doc 19, fase 2): a lista le os eventos, os
 * dias e as inscricoes (contagens); um evento le so o que e dele; a chamada
 * de um dia le o dia, o evento, as inscricoes e as marcacoes daquele dia.
 * Conferidos nos testes contra o espaco inteiro (`WORLD_SLICE_CHECK=1`).
 */

/** Catalogo pequeno: modalidades, equipe e usuarios (escopo do professor). */
async function catalog(load: SliceLoader): Promise<void> {
  await Promise.all([load.all("categories"), load.all("professionals"), load.all("users")]);
}

const listWorld: MethodSlice = async (_args, load) => {
  await Promise.all([catalog(load), load.all("events"), load.all("eventSessions"), load.all("eventRegistrations")]);
};

/** Um evento inteiro: dias, inscricoes, chamada, alunos e as parcelas das inscricoes. */
async function oneEvent(eventId: Id, load: SliceLoader): Promise<void> {
  await catalog(load);
  const [, , registrations] = await Promise.all([
    load.where("events", "id", [eventId]),
    load.where("eventSessions", "eventId", [eventId]),
    load.where("eventRegistrations", "eventId", [eventId]),
    load.where("eventAttendances", "eventId", [eventId]),
  ]);
  const students = registrations.map((r) => r.studentId as string);
  const [, charges] = await Promise.all([load.where("clients", "id", students), load.where("charges", "eventId", [eventId])]);
  await load.where("onlinePayments", "chargeId", charges.map((c) => c.id as string));
  load.none("auditLog");
}

/** Pelo id da inscricao: acha o evento e carrega ele inteiro. */
async function byRegistration([registrationId]: unknown[], load: SliceLoader): Promise<void> {
  const [registration] = await load.where("eventRegistrations", "id", [registrationId as Id]);
  if (registration) await oneEvent(registration.eventId as Id, load);
  else load.none("auditLog");
}

/** Pelo id do dia: acha o evento e carrega ele inteiro. */
async function bySession(sessionId: Id, load: SliceLoader): Promise<void> {
  const [session] = await load.where("eventSessions", "id", [sessionId]);
  if (session) await oneEvent(session.eventId as Id, load);
  else load.none("auditLog");
}

/** Financeiro do evento: o evento inteiro mais o que a leitura das cobrancas usa. */
async function eventFinance(eventId: Id, load: SliceLoader): Promise<void> {
  await oneEvent(eventId, load);
  const registrations = await load.where("eventRegistrations", "eventId", [eventId]);
  await Promise.all([
    load.all("plans"),
    load.all("classGroups"),
    load.all("teacherPayouts"),
    load.all("financialEntries"),
    load.all("financialCategories"),
    load.where("messageLogs", "clientId", registrations.map((r) => r.studentId as string)),
  ]);
}

export const eventSlices: Record<string, MethodSlice> = {
  list: listWorld,
  getEventFinance: async ([id], load) => eventFinance(id as Id, load),
  listSessions: listWorld,
  getById: async ([id], load) => oneEvent(id as Id, load),
  getSessionDetail: async ([id], load) => bySession(id as Id, load),
  create: async (_args, load) => {
    await catalog(load);
    load.none("events");
    load.none("eventSessions");
    load.none("eventRegistrations");
    load.none("auditLog");
  },
  update: async ([id], load) => oneEvent(id as Id, load),
  cancelSession: async ([id], load) => bySession(id as Id, load),
  cancelEvent: async ([id], load) => oneEvent(id as Id, load),
  listRegistrations: async ([id], load) => oneEvent(id as Id, load),
  register: async ([input], load) => {
    const { eventId, studentId } = input as { eventId: Id; studentId: Id };
    await oneEvent(eventId, load);
    // O aluno que entra pode ainda nao ter inscricao (nao veio com as inscricoes).
    await load.where("clients", "id", [studentId]);
  },
  promoteFromWaitlist: byRegistration,
  cancelRegistration: byRegistration,
  markEventAttendance: async ([input], load) => bySession((input as { sessionId: Id }).sessionId, load),
  markManyEventAttendance: async ([input], load) => bySession((input as { sessionId: Id }).sessionId, load),
  clearEventAttendance: async ([input], load) => bySession((input as { sessionId: Id }).sessionId, load),
};
