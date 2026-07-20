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
  enrollmentType: ClassEnrollmentType;
  capacity: number; // vagas (regra mole ao lotar)
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
  enrolledCount: number; // matriculas ativas
  vagasRestantes: number; // capacity - enrolledCount
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

/** Linha do roster de uma sessao: aluno + presenca (se ja marcada). */
export interface SessionRosterEntry {
  studentId: Id;
  studentName: string;
  attendance?: AttendanceStatus;
}

/** Detalhe da sessao com o roster (matriculados da turma) para marcar presenca. */
export interface ClassSessionDetail extends ClassSessionView {
  roster: SessionRosterEntry[];
}
