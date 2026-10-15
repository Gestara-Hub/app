import type {
  DateISO,
  DateTimeISO,
  Id,
  RecordStatus,
  TimeISO,
  Weekday,
  TenantScopeFields,
} from "./common";

/**
 * Modelo 3 (Turmas e aulas). Fatia 1: turma + matricula + sessao + presenca.
 * Aluno = Client, Instrutor = Professional, Modalidade = Category (reusados —
 * ver docs/technical/01 e docs/product/11). Reserva/drop-in, mensalidade
 * e lista de espera entram nas fatias seguintes.
 */

/** Como o aluno se vincula: matricula fixa no roster, ou reserva por sessao. */
export type ClassEnrollmentType = "fixed" | "dropin";

/** Encontro recorrente da turma (dia da semana + horario); gera as sessoes. */
export interface ClassMeetingSlot {
  weekday: Weekday;
  start: TimeISO;
  end: TimeISO;
}

/**
 * Como a turma cobra (doc 20, fases B e C): mensalidade do plano do aluno
 * (padrao, ausente = "membership"), curso com valor fechado (a matricula gera
 * as parcelas), pacote de aulas (cada aula dada gasta uma aula do pacote do
 * aluno) ou sem cobranca.
 */
export type ClassBillingMode = "membership" | "course" | "package" | "free";

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
  endDate?: DateISO; // sem fim = turma continua (curso exige)
  /** Forma de cobranca; ausente = "membership". */
  billingMode?: ClassBillingMode;
  /** Curso: valor cheio do curso (> 0). So com `billingMode: "course"`. */
  coursePriceCents?: number;
  /** Curso: maximo de parcelas que o aluno pode escolher (1 a 12). */
  courseMaxInstallments?: number;
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreateClassGroup = Omit<
  ClassGroup,
  "id" | "createdAt" | "updatedAt" | TenantScopeFields
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
  /** Ja terminou: `endDate` antes de hoje (derivado na leitura). */
  isEnded: boolean;
  /** @deprecated use availableSpots */
  vagasRestantes?: number;
}

/** Matricula — vinculo Aluno <-> Turma (turma fixa). */
export type EnrollmentStatus = "active" | "paused" | "canceled";

/** Pagamento do curso escolhido na matricula (valor ajustavel, parcelas, 1o vencimento). */
export interface EnrollmentCourseChoice {
  priceCents: number;
  /** 1 (a vista) ate `ClassGroup.courseMaxInstallments`. */
  installments: number;
  firstDueDate: DateISO;
}

/** Matricula em curso: a escolha do aluno + o grupo das parcelas geradas. */
export interface EnrollmentCourse extends EnrollmentCourseChoice {
  installmentGroupId: Id;
}

export interface Enrollment {
  id: Id;
  classGroupId: Id;
  studentId: Id; // = Client
  status: EnrollmentStatus;
  enrolledAt: DateTimeISO;
  canceledAt?: DateTimeISO;
  cancellationReason?: string;
  /** So em turma de curso: o que o aluno escolheu pagar. */
  course?: EnrollmentCourse;
  /**
   * So em turma de mensalidade: este aluno paga as aulas com o pacote dele
   * (cada presenca gasta uma aula, como na turma de pacote). Ausente = segue a
   * turma. Permite alunos de mensalidade e de pacote na mesma turma.
   */
  paysWithPackage?: boolean;
}

/**
 * `course` e obrigatorio quando a turma e um curso (ignorado nas demais).
 * `paysWithPackage` so vale em turma de mensalidade.
 */
export type CreateEnrollment = Pick<Enrollment, "classGroupId" | "studentId"> & {
  course?: EnrollmentCourseChoice;
  paysWithPackage?: boolean;
};

/** Parcelas do curso da matricula por situacao (cancelar matricula mostra as futuras). */
export interface EnrollmentCourseInstallments {
  paid: number;
  /** Em aberto com vencimento depois de hoje: saem se a matricula for cancelada. */
  future: number;
  /** Em aberto vencendo hoje ou ja vencidas: continuam como divida. */
  due: number;
}

export interface EnrollmentView extends Enrollment {
  studentName: string;
  studentStatus: RecordStatus;
  // Frequencia (sobre as presencas ja marcadas da turma): `justified` nao
  // penaliza; `attendanceRate` = present/(present+absent), null se sem dados.
  presentCount: number;
  absentCount: number;
  attendanceRate: number | null;
  /** Curso terminado (`endDate` antes de hoje) com a matricula ativa: "Concluído". */
  isCompleted: boolean;
  /** So matricula em curso. */
  courseInstallments?: EnrollmentCourseInstallments;
}

/**
 * Certificado de conclusao do curso (doc 20, fase D; recurso pago
 * `certificates`). So dados: o texto e o desenho ficam no modelo do espaco
 * (`CertificateTemplate`), que a API devolve junto (`CourseCertificateDocument`).
 */
export interface CourseCertificate {
  enrollmentId: Id;
  classGroupId: Id;
  organizationName: string;
  studentName: string;
  courseName: string;
  modalityName?: string;
  startDate: DateISO;
  endDate: DateISO;
  /** Aulas do curso (encontros entre o inicio e o fim). */
  lessonsCount: number;
  /** Carga horaria: soma da duracao das aulas do curso, em minutos. */
  workloadMinutes: number;
  /** Frequencia em % (presencas / presencas + faltas); null sem chamada. */
  attendancePercent: number | null;
  instructorName: string;
  /** Cidade da unidade, quando cadastrada. */
  city?: string;
  /** Dia da emissao. */
  issuedOn: DateISO;
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

export interface ClassSessionOverride {
  sessionId: Id;
  instructorId?: Id;
  reason?: string;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type SubstituteInstructorPayload = {
  instructorId: Id;
  reason?: string;
};

export interface ClassSessionView extends ClassSession {
  className: string;
  modalityName?: string;
  instructorName: string;
  primaryInstructorId?: Id;
  primaryInstructorName?: string;
  isSubstitute?: boolean;
  substitutionReason?: string;
}

/**
 * Aluno com faltas seguidas nas turmas em que esta matriculado (painel:
 * "Sentimos sua falta"). Presenca ou falta justificada encerram a sequencia.
 */
export interface AbsenceStreakView {
  studentId: Id;
  studentName: string;
  phone?: string;
  /** Faltas seguidas mais recentes. */
  streak: number;
  /** Data da primeira falta da sequencia. */
  since: DateISO;
  classGroupNames: string[];
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

/**
 * Tipo de vinculo do aluno na sessao: matriculado fixo, avulso, experimental
 * ou com pacote (entra na aula gastando uma aula do pacote, sem cobranca).
 */
export type SessionRosterKind = "enrolled" | "dropin" | "trial" | "package";

/** Linha do roster de uma sessao: aluno + vinculo + presenca (se ja marcada). */
export interface SessionRosterEntry {
  studentId: Id;
  studentName: string;
  kind?: SessionRosterKind;
  attendance?: AttendanceStatus;
  /**
   * So de quem paga com pacote nesta aula (turma "package" ou vinculo
   * "package"): saldo do pacote que cobre a aula (o que ja gastou esta aula,
   * ou o proximo a ser usado).
   */
  packageRemaining?: number;
  packageTotal?: number;
  /** Esta e a ultima aula do pacote. */
  packageLastLesson?: boolean;
  /** Paga com pacote, mas nao tem pacote valido com saldo para esta aula. */
  noPackage?: boolean;
}

/** Aluno fora da aula com pacote valido para ela (pode entrar como "package"). */
export interface SessionPackageCandidate {
  studentId: Id;
  studentName: string;
  remaining: number;
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
  /** Alunos ativos fora da aula com pacote valido para a modalidade e a data. */
  packageCandidates: SessionPackageCandidate[];
}

// --- Fatia 3: lista de espera e drop-in (reserva) ---------------------------

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

/** Reservation of a drop-in, trial or package class: Student x Session. */
export type ReservationStatus = "reserved" | "canceled";
export type ReservationKind = "dropin" | "trial" | "package";

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
export type ReservaStatus = ReservationStatus;
export type ReservaKind = ReservationKind;
export type Reserva = ClassReservation;
export type ReservaView = ReservationView;
