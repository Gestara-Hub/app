import type { ChargeView } from "./billing";
import type { CertificateTemplate, CourseCertificateDocument } from "./certificate";
import type { CourseCertificate } from "./class";
import type { DateISO, DateTimeISO, Id, TenantScopeFields, TimeISO } from "./common";
import type { FinancialEntry } from "./finance";

/**
 * Eventos e seminarios (doc product/29, decidido em 09/11/2026): modulo proprio,
 * separado das turmas. Um evento tem datas soltas (um ou mais dias), instrutor
 * da equipe ou convidado so pelo nome, inscricao unica ou por dia, cobranca
 * fechada (com lote opcional), por dia ou sem cobranca, e chamada por dia.
 * Compartilha com as turmas so a fundacao (alunos, cobrancas, certificado,
 * comunicacao, auditoria) e o Calendario.
 */

export type EventBillingMode = "fixed" | "per_day" | "free";
/** `canceled`: evento cancelado inteiro (dias e inscricoes saem juntos). */
export type EventStatus = "active" | "canceled";
/** Situacao derivada das datas: antes do 1o dia, entre o 1o e o ultimo, depois do ultimo. */
export type EventStage = "upcoming" | "ongoing" | "finished";
export type EventSessionStatus = "scheduled" | "done" | "canceled";
/** `full`: todos os dias; `days`: so os dias escolhidos (`sessionIds`), so com `per_day`. */
export type EventRegistrationScope = "full" | "days";
/** `waitlist`: lotou; promover vira `confirmed` com a cobranca. */
export type EventRegistrationStatus = "confirmed" | "waitlist" | "canceled";
export type EventAttendanceStatus = "present" | "absent";

export interface Event {
  id: Id;
  organizationId: Id;
  unitId: Id;
  name: string;
  description?: string;
  modalityId?: Id; // = Category (modalidade)
  /** Instrutor da equipe. Ausente = convidado (`guestInstructorName`). */
  instructorId?: Id;
  /** Convidado so pelo nome: nao vira profissional nem usuario. */
  guestInstructorName?: string;
  /** De onde vem o convidado ("Academia X, Curitiba"). */
  guestInstructorOrigin?: string;
  /** Vagas. Ausente = sem limite. Lotou: inscricao entra na lista de espera (regra dura). */
  capacity?: number;
  billingMode: EventBillingMode;
  /** `fixed`: valor cheio do evento (> 0). */
  priceCents?: number;
  /** `fixed`: maximo de parcelas que o inscrito pode escolher (1 a 12). */
  maxInstallments?: number;
  /** `per_day`: valor de cada dia (> 0). */
  dayPriceCents?: number;
  /** Lote (opcional, so `fixed`): valor menor ate `earlyBirdUntil` (inclusive). */
  earlyBirdPriceCents?: number;
  earlyBirdUntil?: DateISO;
  /** Presenca conta como aula na frequencia da graduacao (exame de faixa coletivo). Padrao: nao. */
  countsForProgression?: boolean;
  status: EventStatus;
  canceledAt?: DateTimeISO;
  cancelReason?: string;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

/** Um dia (ou bloco do dia) do evento. Tabela propria, nao divide `class_sessions`. */
export interface EventSession {
  id: Id;
  eventId: Id;
  date: DateISO;
  start: TimeISO;
  end: TimeISO;
  status: EventSessionStatus;
  cancelReason?: string;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreateEventSession = Pick<EventSession, "date" | "start" | "end"> & { id?: Id };

export type CreateEvent = Omit<Event, "id" | "status" | "canceledAt" | "cancelReason" | "createdAt" | "updatedAt" | TenantScopeFields> & {
  /** Ao menos um dia. */
  sessions: CreateEventSession[];
};
/**
 * Editar: os dias vem inteiros (`sessions`); dia ja feito ou cancelado nao
 * muda nem sai; dia com `id` existente e atualizado, sem `id` e criado.
 */
export type UpdateEvent = Partial<Omit<CreateEvent, "sessions">> & { sessions?: CreateEventSession[] };

export interface EventFilter {
  search?: string;
  stage?: EventStage;
  status?: EventStatus;
  instructorId?: Id;
  modalityId?: Id;
  /** Dias dentro do periodo (Calendario). */
  dateFrom?: DateISO;
  dateTo?: DateISO;
}

/** Inscricao: o "matricular" do evento. */
export interface EventRegistration {
  id: Id;
  eventId: Id;
  studentId: Id;
  scope: EventRegistrationScope;
  /** `days`: dias escolhidos. */
  sessionIds?: Id[];
  status: EventRegistrationStatus;
  /** Valor cobrado (0 em evento sem cobranca ou na lista de espera). */
  amountCents: number;
  installments: number;
  /** Parcelas da inscricao (`Charge` kind "event") dividem este id. */
  installmentGroupId?: Id;
  registeredAt: DateTimeISO;
  canceledAt?: DateTimeISO;
  cancellationReason?: string;
}

/** Pagamento da inscricao: valor editavel (sugerido pelo evento e pelo lote), parcelas e 1o vencimento. */
export interface EventRegistrationPayment {
  amountCents: number;
  installments: number;
  firstDueDate: DateISO;
}

export interface RegisterForEvent {
  eventId: Id;
  studentId: Id;
  scope?: EventRegistrationScope;
  sessionIds?: Id[];
  /** Ausente em evento sem cobranca; nos demais, o valor sugerido com 1 parcela vencendo hoje. */
  payment?: EventRegistrationPayment;
}

/** Chamada de um dia: uma linha por (dia x inscrito). */
export interface EventAttendance {
  id: Id;
  eventId: Id;
  sessionId: Id;
  registrationId: Id;
  studentId: Id;
  status: EventAttendanceStatus;
  markedAt: DateTimeISO;
}

// --- Leituras -----------------------------------------------------------------

export interface EventView extends Event {
  modalityName?: string;
  /** Nome de quem conduz: o profissional da equipe ou o convidado. */
  instructorName: string;
  isGuestInstructor: boolean;
  sessions: EventSession[];
  /** Primeiro e ultimo dia nao cancelados (ausentes se todos cancelados). */
  firstDate?: DateISO;
  lastDate?: DateISO;
  stage: EventStage;
  /** Horas somadas dos dias nao cancelados (carga horaria). */
  totalHours: number;
  confirmedCount: number;
  waitlistCount: number;
  /** Vagas livres; ausente sem limite. */
  availableSpots?: number;
  isFull: boolean;
  /** Preco sugerido hoje para a inscricao completa (lote ja aplicado). */
  suggestedPriceCents: number;
  /** Lote valendo hoje. */
  earlyBirdActive: boolean;
}

export interface EventRegistrationView extends EventRegistration {
  studentName: string;
  studentPhone?: string;
  /** Soma das parcelas pagas e das em aberto (pendentes e vencidas). */
  paidCents: number;
  openCents: number;
  overdueCents: number;
  /** Dias em que esteve presente. */
  presentCount: number;
}

export interface EventRosterEntry {
  registrationId: Id;
  studentId: Id;
  studentName: string;
  scope: EventRegistrationScope;
  attendance?: EventAttendanceStatus;
}

export interface EventSessionDetail {
  session: EventSession;
  event: EventView;
  roster: EventRosterEntry[];
  presentCount: number;
}

/**
 * Financeiro proprio do evento (doc product/29 §Financeiro do evento): as
 * parcelas das inscricoes e os lancamentos ligados ao evento. Tudo isso
 * tambem esta no Financeiro geral; aqui e so o recorte.
 */
export interface EventFinanceView {
  /** Parcelas pagas. */
  receivedCents: number;
  /** Parcelas pendentes e vencidas. */
  openCents: number;
  /** So as vencidas (parte de `openCents`). */
  overdueCents: number;
  /** Saidas ligadas ao evento (pagas e a pagar, fora as canceladas). */
  expensesCents: number;
  /** Entradas manuais ligadas ao evento (fora as canceladas). */
  otherIncomeCents: number;
  /** Recebido + entradas manuais pagas - saidas pagas. */
  resultCents: number;
  charges: ChargeView[];
  entries: FinancialEntry[];
}

/**
 * Certificado de participacao (doc product/29, Pro): mesma folha e o mesmo
 * codigo de verificacao do certificado de curso. No snapshot, `courseName` e
 * o nome do evento, `enrollmentId` a inscricao e `classGroupId` o evento.
 */
export type EventCertificateDocument = CourseCertificateDocument;

export interface EventCertificatesBatch {
  eventId: Id;
  eventName: string;
  template: CertificateTemplate;
  items: { certificate: CourseCertificate; issued: CourseCertificateDocument["issued"] }[];
}

export interface EventSessionView extends EventSession {
  eventName: string;
  instructorName: string;
  isGuestInstructor: boolean;
  modalityName?: string;
  confirmedCount: number;
}
