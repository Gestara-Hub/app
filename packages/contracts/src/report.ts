import type { Permission } from "./permission";
import type { DateISO, DateTimeISO, Id } from "./common";
import type { SubscriptionTier } from "./subscription";

export type ReportType =
  | "attendance_sheet"
  | "students_roster"
  | "monthly_birthdays"
  | "billing_statement"
  | "course_summary"
  | "package_summary"
  | "financial_income_statement"
  | "churn_retention"
  | "revenue_forecast"
  | "teacher_performance";

export type ReportCategory = "operational" | "financial" | "retention";

export interface ReportMetadata {
  type: ReportType;
  title: string;
  description: string;
  category: ReportCategory;
  tierRequired: SubscriptionTier;
  /** Alem de `reports:view`: valores de cobranca ou do financeiro. */
  permissionRequired?: Permission;
  iconName: string;
}

export interface ReportFilter {
  competence?: string; // YYYY-MM
  startDate?: DateISO;
  endDate?: DateISO;
  classGroupId?: Id;
  /** Lista de presenca: a aula (`turma~data~inicio`); sem ela, a ultima do mes. */
  sessionId?: Id;
  professionalId?: Id;
  status?: string;
}

export interface ReportHeaderInfo {
  organizationName: string;
  organizationSegment: string;
  unitName: string;
  generatedAt: DateTimeISO;
  generatedBy: string;
  periodLabel: string;
}

// 1. Lista de Chamada e Presença (uma aula de uma turma)
export interface AttendanceReportRow {
  studentId: Id;
  studentName: string;
  belt?: string;
  /** Marcacao da chamada; `unmarked` = chamada ainda nao feita para o aluno. */
  status: "present" | "absent" | "justified" | "unmarked";
  checkInTime?: string;
}

export interface AttendanceReportData {
  header: ReportHeaderInfo;
  /** Turma e aula mostradas (ausentes sem turma ativa ou sem aula no mes). */
  classGroupId?: Id;
  sessionId?: Id;
  /** Turmas ativas e aulas do mes da turma (ate hoje), para escolher. */
  classOptions: { id: Id; name: string }[];
  sessionOptions: { id: Id; date: DateISO; start: string }[];
  className: string;
  modalityName: string;
  teacherName: string;
  sessionDate: DateISO;
  sessionTime: string;
  totalPresent: number;
  totalAbsent: number;
  totalJustified: number;
  totalUnmarked: number;
  occupancyRatePercent: number;
  rows: AttendanceReportRow[];
}

// 2. Relação Geral de Alunos
export interface StudentRosterRow {
  id: Id;
  name: string;
  phone: string;
  planName: string;
  dueDay: number;
  status: "active" | "paused" | "inactive";
  belt?: string;
  enrolledAt: DateISO;
}

export interface StudentRosterReportData {
  header: ReportHeaderInfo;
  totalActive: number;
  totalPaused: number;
  totalInactive: number;
  rows: StudentRosterRow[];
}

// 3. Extrato de Mensalidades
export interface BillingStatementRow {
  chargeId: Id;
  studentName: string;
  amountCents: number;
  dueDate: DateISO;
  status: "pending" | "paid" | "overdue";
  paidAt?: DateTimeISO;
  paymentMethod?: string;
}

export interface BillingStatementReportData {
  header: ReportHeaderInfo;
  totalBilledCents: number;
  totalReceivedCents: number;
  totalPendingCents: number;
  totalOverdueCents: number;
  defaultRatePercent: number;
  rows: BillingStatementRow[];
}

// 3b. Cursos (doc 20, fase D): um curso por linha, valores do curso inteiro
export interface CourseReportRow {
  classGroupId: Id;
  className: string;
  teacherName: string;
  startDate: DateISO;
  endDate?: DateISO;
  /** Matriculas que valem (ativas ou pausadas), inclusive as concluidas. */
  enrolled: number;
  /** Matriculas ativas de curso ja terminado. */
  completed: number;
  canceled: number;
  /** Parcelas que valem (pagas + em aberto). */
  contractedCents: number;
  receivedCents: number;
  /** Pendentes e atrasadas. */
  openCents: number;
}

export interface CourseReportData {
  header: ReportHeaderInfo;
  totalContractedCents: number;
  totalReceivedCents: number;
  totalOpenCents: number;
  /** Parcelas de curso pagas no mes do relatorio. */
  receivedInPeriodCents: number;
  rows: CourseReportRow[];
}

// 3c. Pacotes de aulas (doc 20, fase D): um pacote do catalogo por linha
export interface PackageReportRow {
  packageId: Id;
  packageName: string;
  /** Vendas no mes (sem as canceladas). */
  sold: number;
  /** Aulas compradas nessas vendas (sem as trazidas de outro pacote). */
  lessonsSold: number;
  /** Aulas gastas no mes (presenca ou falta que gasta). */
  lessonsUsed: number;
  /** Aulas que ainda podem ser usadas hoje. */
  lessonsRemaining: number;
  /** Cobrancas do pacote pagas no mes. */
  receivedCents: number;
}

export interface PackageReportData {
  header: ReportHeaderInfo;
  totalSold: number;
  totalLessonsUsed: number;
  totalLessonsRemaining: number;
  totalReceivedCents: number;
  rows: PackageReportRow[];
}

// 4. Aniversariantes do Mês
export interface BirthdayRow {
  id: Id;
  name: string;
  phone: string;
  birthDate: string;
  day: number;
  planName: string;
}

export interface BirthdayReportData {
  header: ReportHeaderInfo;
  monthName: string;
  totalBirthdays: number;
  rows: BirthdayRow[];
}

// 5. DRE Gerencial (Pro)
export interface DRECategoryRow {
  name: string;
  amountCents: number;
  percent: number;
}

export interface DREStatementReportData {
  header: ReportHeaderInfo;
  grossRevenueCents: number;
  deductionsCents: number;
  netRevenueCents: number;
  operatingExpensesCents: number;
  operationalResultCents: number;
  operatingMarginPercent: number;
  incomeCategories: DRECategoryRow[];
  expenseCategories: DRECategoryRow[];
}

// 6. Churn e Retenção (Pro)
/**
 * Retencao do mes pelas matriculas: aluno ativo = com alguma matricula
 * valendo. Inicio = ativos na vespera do mes; fim = ativos no ultimo dia (ou
 * hoje); novas = ativos no fim que nao estavam no inicio; cancelamentos =
 * ativos no inicio que nao estao no fim. Inicio + novas - cancelamentos = fim.
 */
export interface ChurnReportData {
  header: ReportHeaderInfo;
  activeStudentsStart: number;
  newEnrollments: number;
  cancellations: number;
  activeStudentsEnd: number;
  netGrowth: number;
  churnRatePercent: number;
  retentionRatePercent: number;
  modalitiesBreakdown: {
    modalityName: string;
    activeCount: number;
    churnRatePercent: number;
  }[];
}

// Tipo unificado para respostas de relatório
export type GeneratedReportData =
  | { type: "attendance_sheet"; data: AttendanceReportData }
  | { type: "students_roster"; data: StudentRosterReportData }
  | { type: "billing_statement"; data: BillingStatementReportData }
  | { type: "course_summary"; data: CourseReportData }
  | { type: "package_summary"; data: PackageReportData }
  | { type: "monthly_birthdays"; data: BirthdayReportData }
  | { type: "financial_income_statement"; data: DREStatementReportData }
  | { type: "churn_retention"; data: ChurnReportData };
