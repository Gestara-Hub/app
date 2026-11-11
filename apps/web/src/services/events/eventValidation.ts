import type {
  ApiErrorField,
  CreateEvent,
  CreateEventSession,
  Event,
  EventInstructor,
  EventRegistrationPayment,
  Id,
} from "@gestarahub/contracts";
import { MAX_INSTALLMENTS } from "@gestarahub/core/billing";
import { isIsoDate } from "@gestarahub/core/date";
import { daysOverlap } from "@gestarahub/core/events";
import { teamWords } from "@/services/world/nouns";
import { validationError } from "@/services/world/ops";
import { store } from "@/services/world/store";

/**
 * Validacao do evento (doc product/29 §Cadastro e §Cobranca). Mensagens em
 * portugues, por campo, no formato que o formulario mapeia.
 */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

type EventPayload = Omit<CreateEvent, "sessions">;

/** Limpa textos e tira os campos que nao valem para a forma de cobranca escolhida. */
export function normalizeEvent<T extends Partial<EventPayload>>(payload: T): T {
  const next: Partial<EventPayload> = { ...payload };
  if (typeof next.name === "string") next.name = next.name.trim();
  if (typeof next.description === "string") next.description = next.description.trim() || undefined;
  if (Array.isArray(next.instructors)) next.instructors = next.instructors.map(normalizeInstructor);
  if (next.billingMode && next.billingMode !== "fixed") {
    next.priceCents = undefined;
    next.maxInstallments = undefined;
    next.earlyBirdPriceCents = undefined;
    next.earlyBirdUntil = undefined;
  }
  if (next.billingMode && next.billingMode !== "per_day") next.dayPriceCents = undefined;
  if (next.billingMode === "fixed" && !next.earlyBirdPriceCents) {
    next.earlyBirdPriceCents = undefined;
    next.earlyBirdUntil = undefined;
  }
  return next as T;
}

/** Cada pessoa e da equipe ou convidada, nunca as duas; textos limpos. */
function normalizeInstructor(instructor: EventInstructor): EventInstructor {
  const guestName = typeof instructor.guestName === "string" ? instructor.guestName.trim() || undefined : undefined;
  const guestOrigin = typeof instructor.guestOrigin === "string" ? instructor.guestOrigin.trim() || undefined : undefined;
  if (instructor.professionalId) return { id: instructor.id, professionalId: instructor.professionalId };
  return { id: instructor.id, ...(guestName ? { guestName } : {}), ...(guestOrigin ? { guestOrigin } : {}) };
}

/**
 * Quem conduz: ao menos uma pessoa; da equipe ativa ou convidado com nome;
 * a mesma pessoa da equipe nao entra duas vezes. `known` sao os profissionais
 * que ja estavam no evento (inativado depois continua valendo nele).
 */
function validateInstructors(instructors: EventInstructor[] | undefined, fields: ApiErrorField[], known: Set<string>): void {
  const list = instructors ?? [];
  if (list.length === 0) {
    fields.push({ field: "instructors", message: "Informe quem conduz o evento." });
    return;
  }
  const seenIds = new Set<string>();
  const seenPros = new Set<string>();
  list.forEach((instructor, i) => {
    const field = `instructors.${i}`;
    if (!instructor.id || seenIds.has(instructor.id)) fields.push({ field: `${field}.id`, message: "Linha repetida em quem conduz." });
    seenIds.add(instructor.id);
    if (instructor.professionalId) {
      const pro = store.professionals.find((p) => p.id === instructor.professionalId);
      if (!pro || (pro.status !== "active" && !known.has(pro.id))) {
        fields.push({ field: `${field}.professionalId`, message: `${teamWords().title} não encontrado ou inativo.` });
      } else if (seenPros.has(pro.id)) {
        fields.push({ field: `${field}.professionalId`, message: `${pro.name} já está em quem conduz.` });
      }
      seenPros.add(instructor.professionalId);
    } else if (!instructor.guestName) {
      fields.push({ field: `${field}.guestName`, message: "Informe o nome do convidado." });
    }
  });
}

export function validateEvent(payload: EventPayload, current?: Pick<Event, "instructors">): void {
  const fields: ApiErrorField[] = [];
  if (!payload.name) fields.push({ field: "name", message: "Informe o nome do evento." });
  const known = new Set((current?.instructors ?? []).map((i) => i.professionalId).filter((id): id is string => Boolean(id)));
  validateInstructors(payload.instructors, fields, known);
  if (payload.modalityId && !store.categories.some((c) => c.id === payload.modalityId)) {
    fields.push({ field: "modalityId", message: "Modalidade não encontrada." });
  }
  if (payload.capacity !== undefined && (!Number.isInteger(payload.capacity) || payload.capacity < 1)) {
    fields.push({ field: "capacity", message: "As vagas precisam ser um número inteiro maior que zero." });
  }
  if (payload.billingMode === "fixed") {
    if (!Number.isInteger(payload.priceCents) || (payload.priceCents ?? 0) <= 0) {
      fields.push({ field: "priceCents", message: "Informe o valor do evento." });
    }
    const max = payload.maxInstallments ?? 1;
    if (!Number.isInteger(max) || max < 1 || max > MAX_INSTALLMENTS) {
      fields.push({ field: "maxInstallments", message: `As parcelas vão de 1 a ${MAX_INSTALLMENTS}.` });
    }
    if (payload.earlyBirdPriceCents !== undefined) {
      if (!Number.isInteger(payload.earlyBirdPriceCents) || payload.earlyBirdPriceCents <= 0) {
        fields.push({ field: "earlyBirdPriceCents", message: "Informe o valor do lote." });
      } else if ((payload.priceCents ?? 0) > 0 && payload.earlyBirdPriceCents >= (payload.priceCents ?? 0)) {
        fields.push({ field: "earlyBirdPriceCents", message: "O lote precisa ser menor que o valor cheio." });
      }
      if (!isIsoDate(payload.earlyBirdUntil)) {
        fields.push({ field: "earlyBirdUntil", message: "Informe até quando o lote vale." });
      }
    }
  } else if (payload.billingMode === "per_day") {
    if (!Number.isInteger(payload.dayPriceCents) || (payload.dayPriceCents ?? 0) <= 0) {
      fields.push({ field: "dayPriceCents", message: "Informe o valor do dia." });
    }
  } else if (payload.billingMode !== "free") {
    fields.push({ field: "billingMode", message: "Escolha como o evento é cobrado." });
  }
  if (fields.length) throw validationError(fields);
}

/**
 * Ao menos um dia, datas reais, fim depois do inicio, sem dois blocos se
 * cruzando e quem conduz o dia dentro da lista do evento.
 */
export function validateSessions(sessions: CreateEventSession[], instructors: EventInstructor[] = []): void {
  const fields: ApiErrorField[] = [];
  const instructorIds = new Set(instructors.map((i) => i.id));
  if (!sessions.length) fields.push({ field: "sessions", message: "Informe ao menos um dia do evento." });
  sessions.forEach((s, i) => {
    const field = `sessions.${i}`;
    if ((s.instructorIds ?? []).some((id) => !instructorIds.has(id))) {
      fields.push({ field: `${field}.instructorIds`, message: "Quem conduz o dia precisa estar em quem conduz o evento." });
    }
    if (!isIsoDate(s.date)) fields.push({ field: `${field}.date`, message: "Informe a data do dia." });
    if (!TIME.test(s.start) || !TIME.test(s.end)) fields.push({ field: `${field}.start`, message: "Informe o horário no formato HH:mm." });
    else if (s.end <= s.start) fields.push({ field: `${field}.end`, message: "O fim precisa ser depois do início." });
  });
  for (let i = 0; i < sessions.length && !fields.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      if (daysOverlap(sessions[i], sessions[j])) {
        fields.push({ field: `sessions.${j}.start`, message: "Dois blocos do mesmo dia não podem se cruzar." });
        break;
      }
    }
  }
  if (fields.length) throw validationError(fields);
}

/** Pagamento da inscricao: valor inteiro nao negativo, parcelas dentro do limite do evento, 1o vencimento real. */
export function validateRegistrationPayment(event: Event, payment: EventRegistrationPayment, dayScope: boolean): void {
  const fields: ApiErrorField[] = [];
  if (!Number.isInteger(payment.amountCents) || payment.amountCents < 0) {
    fields.push({ field: "amountCents", message: "Informe um valor válido." });
  }
  const max = dayScope ? 1 : event.billingMode === "fixed" ? (event.maxInstallments ?? 1) : 1;
  if (!Number.isInteger(payment.installments) || payment.installments < 1 || payment.installments > max) {
    fields.push({
      field: "installments",
      message: max === 1 ? "Esta inscrição é paga à vista." : `As parcelas vão de 1 a ${max}.`,
    });
  }
  if (!isIsoDate(payment.firstDueDate)) fields.push({ field: "firstDueDate", message: "Informe o vencimento." });
  if (fields.length) throw validationError(fields);
}

export function assertDaysBelongToEvent(eventId: Id, sessionIds: Id[], sessions: { id: Id; eventId: Id; status: string }[]): void {
  const ok = sessionIds.length > 0 && sessionIds.every((id) => sessions.some((s) => s.id === id && s.eventId === eventId && s.status !== "canceled"));
  if (!ok) throw validationError([{ field: "sessionIds", message: "Escolha ao menos um dia do evento." }]);
}
