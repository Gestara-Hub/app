import type {
  DateISO,
  DateTimeISO,
  Id,
  RecordStatus,
  TimeISO,
  Weekday,
} from "./common";

/**
 * Modelo 3 (Turmas e aulas). Fatia 1: turma + matricula + sessao + presenca.
 * Aluno = Client, Instrutor = Professional, Modalidade = Category (reusados —
 * ver docs/technical/01 e docs/product/11). Reserva/drop-in, mensalidade,
 * reposicao e lista de espera entram nas fatias seguintes.
 */

/** Como o aluno se vincula: matricula fixa no roster, ou reserva por sessao. */
export type ClassEnrollmentType = "fixed" | "dropin";

/** Encontro recorrente da turma (dia da semana + horario); gera as sessoes. */
export interface ClassMeetingSlot {
  weekday: Weekday;
  start: TimeISO;
  end: TimeISO;
}

/** Turma — grupo recorrente conduzido por um instrutor. */
export interface ClassGroup {
  id: Id;
  organizationId: Id;
  unitId: Id;
  name: string;
  modalityId?: Id; // = Category (modalidade)
  instructorId: Id; // = Professional (instrutor titular)
  /** @deprecated mantido para retrocompatibilidade; todas as turmas sao regulares (padrao "fixed"). */
  enrollmentType?: ClassEnrollmentType;
  capacity: number; // vagas (regra mole ao lotar)
  planId?: Id; // = Plano (mensalidade padrao da turma); ausente = sem cobranca
  allowDropin?: boolean; // aceita reservas de alunos avulsos na sessao
  sessionPriceCents?: number; // preco da aula avulsa
  meetingSlots: ClassMeetingSlot[];
  startDate: DateISO;
  endDate?: DateISO; // sem fim = turma continua
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreateClassGroup = Omit<
  ClassGroup,
  "id" | "createdAt" | "updatedAt"
>;
export type UpdateClassGroup = Partial<CreateClassGroup>;

export interface ClassGroupFilter {
  search?: string;
  modalityId?: Id;
  instructorId?: Id;
  status?: RecordStatus;
}

export interface ClassGroupView extends ClassGroup {
  modalityName?: string;
  instructorName: string;
  planName?: string;
  enrolledCount: number; // matriculas ativas
  availableSpots: number; // capacity - enrolledCount
  /** @deprecated use availableSpots */
  vagasRestantes?: number;
}

/** Matricula — vinculo Aluno <-> Turma (turma fixa). */
export type EnrollmentStatus = "active" | "paused" | "canceled";

export interface Enrollment {
  id: Id;
  classGroupId: Id;
  studentId: Id; // = Client
  status: EnrollmentStatus;
  enrolledAt: DateTimeISO;
  canceledAt?: DateTimeISO;
  cancellationReason?: string;
}

export type CreateEnrollment = Pick<Enrollment, "classGroupId" | "studentId">;

export interface EnrollmentView extends Enrollment {
  studentName: string;
  studentStatus: RecordStatus;
  // Frequencia (sobre as presencas ja marcadas da turma): `justified` nao
  // penaliza; `attendanceRate` = present/(present+absent), null se sem dados.
  presentCount: number;
  absentCount: number;
  attendanceRate: number | null;
}

/** Sessao — ocorrencia datada de uma turma (uma aula). */
export type ClassSessionStatus = "scheduled" | "done" | "canceled";

export interface ClassSession {
  id: Id;
  classGroupId: Id;
  date: DateISO;
  start: TimeISO;
  end: TimeISO;
  instructorId: Id; // titular por padrao; pode ser substituto
  status: ClassSessionStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export interface ClassSessionFilter {
  classGroupId?: Id;
  dateFrom?: DateISO;
  dateTo?: DateISO;
}

export interface ClassSessionView extends ClassSession {
  className: string;
  modalityName?: string;
  instructorName: string;
}

/** Presenca — por (Sessao x Aluno). */
export type AttendanceStatus = "present" | "absent" | "justified";

export interface Attendance {
  id: Id;
  sessionId: Id;
  studentId: Id;
  status: AttendanceStatus;
  markedAt: DateTimeISO;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  justified: number;
  total: number;
}

/** Tipo de vinculo do aluno na sessao: matriculado fixo, avulso ou experimental. */
export type SessionRosterKind = "enrolled" | "dropin" | "trial" | "makeup";

/** Linha do roster de uma sessao: aluno + vinculo + presenca (se ja marcada). */
export interface SessionRosterEntry {
  studentId: Id;
  studentName: string;
  kind?: SessionRosterKind;
  attendance?: AttendanceStatus;
}

/** Detalhe da sessao com o roster (matriculados e avulsos) para marcar presenca. */
export interface ClassSessionDetail extends ClassSessionView {
  /** @deprecated mantido para retrocompatibilidade */
  enrollmentType?: ClassEnrollmentType;
  capacity: number;
  availableSpots: number;
  allowDropin: boolean;
  sessionPriceCents?: number;
  roster: SessionRosterEntry[];
}

// --- Fatia 3: lista de espera, reposicao e drop-in (reserva) ----------------

/** Fila de espera de uma turma lotada (promocao manual ao abrir vaga). */
export type WaitlistStatus = "waiting" | "promoted" | "canceled";

export interface WaitlistEntry {
  id: Id;
  classGroupId: Id;
  studentId: Id;
  position: number;
  status: WaitlistStatus;
  createdAt: DateTimeISO;
}

export interface WaitlistEntryView extends WaitlistEntry {
  studentName: string;
}

/** Makeup class for an absence (30-day deadline; `done` neutralizes absence). */
export type MakeupStatus = "pending" | "scheduled" | "done" | "expired";

export interface MakeupClass {
  id: Id;
  classGroupId: Id;
  studentId: Id;
  missedSessionId: Id;
  makeupSessionId?: Id;
  deadline: DateISO; // 30 days after absence
  status: MakeupStatus;
  createdAt: DateTimeISO;
}

export interface MakeupView extends MakeupClass {
  studentName: string;
  className: string;
  missedDate: DateISO;
  makeupDate?: DateISO;
}

/** Reservation of a drop-in class (drop-in, trial or makeup): Student x Session. */
export type ReservationStatus = "reserved" | "canceled";
export type ReservationKind = "dropin" | "trial" | "makeup";

export interface ClassReservation {
  id: Id;
  classGroupId: Id;
  sessionId: Id;
  studentId: Id;
  kind?: ReservationKind;
  chargeId?: Id;
  /** @deprecated use chargeId */
  cobrancaId?: Id;
  status: ReservationStatus;
  reservedAt: DateTimeISO;
}

export interface ReservationView extends ClassReservation {
  studentName: string;
}

// Backward compatibility aliases
export type ReposicaoStatus = MakeupStatus;
export type Reposicao = MakeupClass;
export type ReposicaoView = MakeupView;
export type ReservaStatus = ReservationStatus;
export type ReservaKind = ReservationKind;
export type Reserva = ClassReservation;
export type ReservaView = ReservationView;
