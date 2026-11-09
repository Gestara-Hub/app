import type { PlanPeriod } from "./billing";
import type { ClassBillingMode } from "./class";
import type { ProgressionBeltColor, ProgressionTrackStyle } from "./category";
import type {
  Client,
  MembershipStatus,
  StudentBillingStrategy,
  StudentCyclePaymentTiming,
  StudentEvaluationEntry,
  TrialOutcome,
} from "./client";
import type { DateISO, DateTimeISO, Id } from "./common";
import type { MessageLog } from "./communication";
import type { StudentPackageView } from "./package";

/**
 * Resumo do aluno (ficha do aluno, doc 22 item 2). E a leitura que a API e os
 * apps de aluno e professor vao usar: cadastro, cobranca, matriculas, saldo em
 * aberto, frequencia, nivel por modalidade, pacotes e ultimas mensagens.
 */

/** Situacao da matricula na ficha: `completed` = curso terminado com o aluno ate o fim. */
export type StudentEnrollmentState = "active" | "paused" | "completed" | "canceled";

/** Parcelas do curso da matricula (contagem e valores). */
export interface StudentCourseInstallments {
  priceCents: number;
  installments: number;
  paid: number;
  paidCents: number;
  /** Em aberto (pendentes e atrasadas). */
  open: number;
  openCents: number;
  overdue: number;
}

export interface StudentSummaryEnrollment {
  id: Id;
  classGroupId: Id;
  className: string;
  modalityId?: Id;
  modalityName?: string;
  instructorName: string;
  billingMode: ClassBillingMode;
  state: StudentEnrollmentState;
  enrolledAt: DateTimeISO;
  canceledAt?: DateTimeISO;
  /** Fim da turma (curso). */
  endDate?: DateISO;
  presentCount: number;
  absentCount: number;
  /** present / (present + absent); null sem chamada. */
  attendanceRate: number | null;
  /** So matricula em curso. */
  course?: StudentCourseInstallments;
}

/** Bolsa vigente hoje. */
export interface StudentScholarship {
  percent: number;
  full: boolean;
  reason?: string;
  validUntil?: DateISO;
}

/** Mensalidade do aluno: plano, valor com desconto ou bolsa, regra e situacao. */
export interface StudentSummaryMembership {
  planId?: Id;
  planName?: string;
  planPeriod?: PlanPeriod;
  /** Valor cheio do plano. */
  listPriceCents?: number;
  /** Valor com desconto ou bolsa vigente. */
  priceCents?: number;
  status: MembershipStatus;
  paymentTiming?: StudentCyclePaymentTiming;
  billingStrategy?: StudentBillingStrategy;
  dueDay?: number;
  scholarship?: StudentScholarship;
  /** Pix Automatico ativo. */
  recurringActive: boolean;
}

/** Soma das cobrancas em aberto de todos os tipos. */
export interface StudentOpenBalance {
  totalCents: number;
  count: number;
  overdueCents: number;
  overdueCount: number;
}

/** Frequencia nos ultimos dias (justificada nao conta na taxa). */
export interface StudentAttendanceWindow {
  days: number;
  present: number;
  absent: number;
  justified: number;
  rate: number | null;
}

/** Palavras da trilha da modalidade ("Faixa" e "Graduação"; "Nível" e "Níveis"). */
export interface StudentLevelWords {
  level: string;
  levelsTitle: string;
  promotion: string;
}

/** Nivel atual do aluno numa modalidade com trilha ligada. */
export interface StudentSummaryLevel {
  modalityId: Id;
  modalityName: string;
  isEnrolled: boolean;
  levelName: string;
  levelColor?: ProgressionBeltColor;
  subLevel: number;
  maxSubLevels?: number;
  trackStyle: ProgressionTrackStyle;
  /** Data do ultimo avanco (ausente sem progresso salvo). */
  promotedAt?: DateISO;
  /** Passou da idade do nivel atual: hora de trocar ("Trocar faixa"). */
  agedOut: boolean;
  /** Data do ultimo avanco registrado (graduacao de verdade, nao o ponto de partida). */
  lastAdvancedAt?: DateISO;
  words: StudentLevelWords;
  /** Ultimos registros de aula, do mais novo ao mais antigo (ate 3). */
  lastRecords: StudentEvaluationEntry[];
  recordsCount: number;
  openGoals: number;
}

export interface StudentSummary {
  student: Client;
  /** Idade hoje (null sem nascimento). */
  age: number | null;
  /** Dias ate o aniversario (0 = hoje; null sem nascimento). */
  daysToBirthday: number | null;
  /** Dia do cadastro. */
  studentSince: DateISO;
  membership: StudentSummaryMembership;
  /** Aula experimental: se fez, quantas, e se virou aluno (09/11/2026). */
  trial: TrialOutcome;
  enrollments: StudentSummaryEnrollment[];
  openBalance: StudentOpenBalance;
  attendance30d: StudentAttendanceWindow;
  /** Modalidades com trilha: matriculadas primeiro. */
  levels: StudentSummaryLevel[];
  /** Pacotes em uso (inclui vencidos e sem saldo, com os avisos). */
  packages: StudentPackageView[];
  /** Ultimas mensagens (ate 5), da mais nova. */
  lastMessages: MessageLog[];
}
