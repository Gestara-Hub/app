import type { ChargeView } from "./billing";
import type { CertificateTemplate, CourseCertificateDocument, GraduationCertificateDocument } from "./certificate";
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
/**
 * `reserved`: inscricao pelo link em evento "vaga so com pagamento", ocupando a
 * vaga ate `holdUntil`; pagou, vira `confirmed`; nao pagou, a reserva cai.
 */
export type EventRegistrationStatus = "confirmed" | "reserved" | "waitlist" | "canceled";

/** De onde veio a inscricao. */
export type EventRegistrationSource = "staff" | "public_link";

/** Quando a vaga fica garantida na inscricao pelo link (doc product/29 P5). */
export type EventSeatGuarantee = "on_signup" | "on_payment";

/** Inscricao publica por link (Plano Profissional; doc product/29). */
export interface EventPublicSignup {
  enabled: boolean;
  /** Codigo aleatorio do link (`/p/e/<code>`), nunca o id do evento. */
  code: string;
  /** Ultimo dia em que o link aceita inscricao (inclusive). */
  until?: DateISO;
}
export type EventAttendanceStatus = "present" | "absent";

/**
 * Uma pessoa que conduz o evento (10/11/2026: mais de uma por evento):
 * alguem da equipe (`professionalId`) ou um convidado pelo nome.
 */
export interface EventInstructor {
  /** Id da linha na lista do evento: os dias apontam para ele (`EventSession.instructorIds`). */
  id: Id;
  /** Da equipe. Ausente = convidado (`guestName`). */
  professionalId?: Id;
  /** Convidado so pelo nome: nao vira profissional nem usuario. */
  guestName?: string;
  /** De onde vem o convidado ("Academia X, Curitiba"). */
  guestOrigin?: string;
}

export interface Event {
  id: Id;
  organizationId: Id;
  unitId: Id;
  name: string;
  description?: string;
  modalityId?: Id; // = Category (modalidade)
  /** Quem conduz (ao menos um): equipe e convidados, na ordem do cadastro. */
  instructors: EventInstructor[];
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
  /**
   * Evento de graduacao (exame ou cerimonia; doc product/30 §4): aba
   * Graduacao, aptos no Inscrever e repasse a federacao. So com modalidade de
   * trilha. Presenca em evento nao conta na frequencia da graduacao.
   */
  graduation?: boolean;
  /** Repasse a federacao por aluno graduado no evento (opcional, so evento de graduacao). */
  federationFeeCents?: number;
  /** Inscricao pelo link (ausente = desligada). */
  publicSignup?: EventPublicSignup;
  /** Evento pago, inscricao pelo link: vaga garantida na inscricao (padrao) ou so com o pagamento. */
  seatGuarantee?: EventSeatGuarantee;
  /** Tempo da reserva em "so com o pagamento" (padrao 30). */
  holdMinutes?: 15 | 30 | 60;
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
  /** Quem conduz este bloco (ids de `Event.instructors`). Ausente ou vazio = todos. */
  instructorIds?: Id[];
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreateEventSession = Pick<EventSession, "date" | "start" | "end" | "instructorIds"> & { id?: Id };

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
  /** Padrao `staff`. */
  source?: EventRegistrationSource;
  /** `reserved`: a reserva vale ate aqui. */
  holdUntil?: DateTimeISO;
  /** Ingresso (QR code): aleatorio, criado ao confirmar. */
  ticketCode?: string;
  /** Aceite da inscricao pelo link (texto, data, IP; e o do responsavel, no menor). */
  signupEvidence?: Record<string, unknown>;
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
  /** Entrada pela leitura do ingresso. */
  checkedInAt?: DateTimeISO;
  /** Quem confirmou a entrada (nome). */
  checkedInBy?: string;
}

// --- Leituras -----------------------------------------------------------------

/** Quem conduz, com o nome resolvido (profissional da equipe ou convidado). */
export interface EventInstructorView extends EventInstructor {
  name: string;
  isGuest: boolean;
}

export interface EventView extends Omit<Event, "instructors"> {
  modalityName?: string;
  /** Quem conduz o evento, na ordem do cadastro. */
  instructors: EventInstructorView[];
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

/** Certificados de graduacao de quem graduou no evento (doc product/30 §4), num PDF so. */
export interface EventGraduationCertificatesBatch {
  eventId: Id;
  eventName: string;
  items: GraduationCertificateDocument[];
}

export interface EventSessionView extends EventSession {
  eventName: string;
  /** Quem conduz este bloco (os escolhidos no dia ou, sem escolha, todos do evento). */
  instructors: EventInstructorView[];
  modalityName?: string;
  confirmedCount: number;
}

// --- Inscricao publica por link (doc product/29, aprovada em 12/11/2026) -------

/** Por que o link nao aceita inscricao agora. */
export type PublicSignupClosedReason = "disabled" | "until" | "finished" | "canceled" | "plan";

/** O que a pagina `/p/e/<codigo>` recebe: dados do evento, nenhum dado de aluno. */
export interface PublicEventView {
  code: string;
  organizationName: string;
  eventName: string;
  description?: string;
  modalityName?: string;
  /** Dias que ainda contam (sem os cancelados), com quem conduz cada um. */
  sessions: { id: Id; date: DateISO; start: TimeISO; end: TimeISO; instructors: string[] }[];
  /** Quem conduz: nome e, no convidado, de onde vem. */
  instructors: { name: string; origin?: string; isGuest: boolean }[];
  /** Endereco da unidade, numa linha. */
  address?: string;
  billingMode: EventBillingMode;
  /** Valor de hoje da inscricao completa (lote ja aplicado). */
  priceCents: number;
  dayPriceCents?: number;
  earlyBird?: { priceCents: number; until: DateISO };
  seatGuarantee: EventSeatGuarantee;
  holdMinutes: number;
  /** O espaco cobra online (a pagina segue para o Pix ou cartao). */
  onlinePayments: boolean;
  /** Faltam poucas vagas (5 ou menos): quantas. Ausente: muitas ou sem limite. */
  spotsLeft?: number;
  isFull: boolean;
  open: boolean;
  closedReason?: PublicSignupClosedReason;
}

export interface PublicEventSignupInput {
  code: string;
  name: string;
  phone: string;
  /** Obrigatorio (12/11/2026): recebe o link do ingresso. No menor, e o do responsavel. */
  email: string;
  /** Menor de 18 anos: dados e aceite do responsavel. */
  isMinor?: boolean;
  guardianName?: string;
  guardianPhone?: string;
  scope?: EventRegistrationScope;
  sessionIds?: Id[];
  /** Aceite da inscricao (obrigatorio). */
  acceptTerms: boolean;
  /** Aceita mensagens do espaco pelo WhatsApp (opcional, doc product/27 M1). */
  acceptWhatsapp?: boolean;
  /** Campo escondido: preenchido = robo. */
  website?: string;
}

export interface PublicEventSignupResult {
  status: "confirmed" | "reserved" | "waitlist" | "already";
  /** Codigo do ingresso (confirmada ou reservada): `/p/i/<codigo>` e a pagina da inscricao. */
  ticketCode?: string;
  /** O link do ingresso foi para o e-mail informado (12/11/2026). */
  emailSent?: boolean;
  /** Cobranca a pagar agora (evento pago). */
  chargeId?: string;
  amountCents: number;
  /** Reserva: vale ate aqui. */
  holdUntil?: DateTimeISO;
  /** Nome do inscrito mascarado ("Ana S."), para a confirmacao. */
  displayName: string;
}

// --- Ingresso e entrada (doc product/29 T1 a T8) --------------------------------

/** O que a leitura do ingresso responde na entrada. */
export type TicketCheckOutcome =
  | "ok" // pode entrar (entrada marcada)
  | "already" // ja entrou hoje
  | "payment_pending" // inscricao confirmada com pagamento em aberto (entra com aviso)
  | "reserved" // reserva sem pagamento ("vaga so com o pagamento")
  | "waitlist"
  | "canceled"
  | "not_this_day" // a inscricao nao cobre este dia
  | "not_today" // este dia do evento nao e hoje
  | "other_event"
  | "not_found";

export interface TicketCheckResult {
  outcome: TicketCheckOutcome;
  /** Entrada marcada nesta leitura. */
  entered: boolean;
  registrationId?: Id;
  studentName?: string;
  /** Valor em aberto da inscricao. */
  pendingCents?: number;
  /** Primeira cobranca em aberto (para "Registrar pagamento"). */
  pendingChargeId?: Id;
  checkedInAt?: DateTimeISO;
  checkedInBy?: string;
  /** "Ingresso de outro evento": o nome dele. */
  otherEventName?: string;
  /** O dia que esta leitura confere (12/11/2026): "Quinta, 12/11 (dia 3 de 3)". */
  day?: { date: DateISO; position: number; total: number };
}

/** Ingresso aberto pelo QR, sem login: dados mascarados (regra das paginas publicas). */
export interface PublicTicketView {
  code: string;
  organizationName: string;
  eventName: string;
  /** Modalidade do evento ("Jiu-Jitsu"), quando tem. */
  modalityName?: string;
  /** Nome mascarado ("Ana S. L."). */
  holderName: string;
  /**
   * Todos os dias do evento (12/11/2026): os da inscricao e os de fora
   * (`included: false`), com a presenca de cada um. Um QR so vale para todos.
   */
  days: {
    date: DateISO;
    start: TimeISO;
    end: TimeISO;
    included: boolean;
    /** Presente neste dia (pela leitura do ingresso ou pela chamada). */
    attended?: boolean;
    /** Hora da entrada pela leitura ("09:02", no fuso do espaco). */
    enteredAt?: TimeISO;
    isToday?: boolean;
  }[];
  address?: string;
  instructors: string[];
  state: "confirmed" | "payment_pending" | "reserved" | "canceled" | "waitlist";
  /** Valor em aberto da inscricao (cobrancas pendentes ou atrasadas). */
  pendingCents?: number;
  /** Cobranca para pagar online (so com o pagamento online ligado no espaco): `/p/c/<id>`. */
  payChargeId?: Id;
  /** Reserva valendo: ate quando a vaga fica guardada sem pagamento. */
  holdUntil?: DateTimeISO;
  /** A reserva venceu sem pagamento (a vaga voltou para o evento). */
  reservationExpired?: boolean;
}

/** Lista do dia para conferir ingresso sem internet (doc product/29, "Leitura sem internet"). */
export interface CheckInListEntry {
  registrationId: Id;
  /** SHA-256 do codigo do ingresso (hex): a lista copiada nao serve para montar ingresso. */
  codeHash: string;
  studentName: string;
  status: "confirmed" | "reserved";
  pendingCents: number;
  checkedInAt?: DateTimeISO;
}

export interface CheckInList {
  sessionId: Id;
  eventName: string;
  date: DateISO;
  /** Posicao do dia no evento (dia 3 de 3), para a leitura sem internet dizer o dia. */
  dayPosition?: number;
  dayTotal?: number;
  generatedAt: DateTimeISO;
  entries: CheckInListEntry[];
}

/** Entrada feita sem internet, enviada quando a conexao volta. */
export interface OfflineCheckIn {
  /** Ingresso achado na lista; ou o codigo lido, quando nao estava na lista. */
  registrationId?: Id;
  code?: string;
  at: DateTimeISO;
}

export interface OfflineCheckInSyncResult {
  applied: number;
  /** A mesma pessoa ja tinha entrado (outra porta, ou ja sincronizado). */
  duplicates: { studentName: string; firstAt: DateTimeISO; firstBy?: string }[];
  /** Codigos que nao valem (nao achados, cancelados, outro evento). */
  rejected: { code: string; reason: string }[];
}
