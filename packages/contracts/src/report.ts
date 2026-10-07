import type { DateISO, DateTimeISO, Id } from "./common";
import type { SubscriptionTier } from "./subscription";

export type ReportType =
  | "attendance_sheet"
  | "students_roster"
  | "monthly_birthdays"
  | "billing_statement"
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
  iconName: string;
}

export interface ReportFilter {
  competence?: string; // YYYY-MM
  startDate?: DateISO;
  endDate?: DateISO;
  classGroupId?: Id;
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

// 1. Lista de Chamada e Presença
export interface AttendanceReportRow {
  studentId: Id;
  studentName: string;
  belt?: string;
  status: "present" | "absent";
  checkInTime?: string;
}

export interface AttendanceReportData {
  header: ReportHeaderInfo;
  className: string;
  modalityName: string;
  teacherName: string;
  sessionDate: DateISO;
  sessionTime: string;
  totalPresent: number;
  totalAbsent: number;
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
  | { type: "monthly_birthdays"; data: BirthdayReportData }
  | { type: "financial_income_statement"; data: DREStatementReportData }
  | { type: "churn_retention"; data: ChurnReportData };
