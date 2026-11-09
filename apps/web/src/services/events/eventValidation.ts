import type {
  ApiErrorField,
  CreateEvent,
  CreateEventSession,
  Event,
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
  if (typeof next.guestInstructorName === "string") next.guestInstructorName = next.guestInstructorName.trim() || undefined;
  if (typeof next.guestInstructorOrigin === "string") next.guestInstructorOrigin = next.guestInstructorOrigin.trim() || undefined;
  // Equipe ou convidado, nunca os dois.
  if (next.instructorId) {
    next.guestInstructorName = undefined;
    next.guestInstructorOrigin = undefined;
  }
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

export function validateEvent(payload: EventPayload): void {
  const fields: ApiErrorField[] = [];
  if (!payload.name) fields.push({ field: "name", message: "Informe o nome do evento." });
  if (!payload.instructorId && !payload.guestInstructorName) {
    fields.push({ field: "instructorId", message: `Escolha alguém da equipe ou informe o nome do convidado.` });
  }
  if (payload.instructorId && !store.professionals.some((p) => p.id === payload.instructorId && p.status === "active")) {
    fields.push({ field: "instructorId", message: `${teamWords().title} não encontrado ou inativo.` });
  }
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

/** Ao menos um dia, datas reais, fim depois do inicio e sem dois blocos se cruzando. */
export function validateSessions(sessions: CreateEventSession[]): void {
  const fields: ApiErrorField[] = [];
  if (!sessions.length) fields.push({ field: "sessions", message: "Informe ao menos um dia do evento." });
  sessions.forEach((s, i) => {
    const field = `sessions.${i}`;
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
