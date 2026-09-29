import type { Address, DateISO, DateTimeISO, Id, RecordStatus, TenantScopeFields } from "./common";
import type { Category, ProgressionBeltColor } from "./category";

export type DiscountType = "percentage" | "fixed";

export interface StudentDiscount {
  type: DiscountType;
  value: number; // centavos se fixed (ex: 3000 = R$ 30,00) ou percentual (ex: 10 = 10%)
  reason?: string;
}

export type MembershipStatus = "active" | "paused" | "canceled";

export type StudentBillingStrategy = "prorated" | "full_cycle";
export type StudentCyclePaymentTiming = "prepaid" | "postpaid";

export type EvaluationEntryTone = "positive" | "attention" | "general";

export interface StudentEvaluationEntry {
  id: Id;
  date: DateISO;
  classGroupId?: Id;
  classGroupName?: string;
  sessionId?: Id;
  tone: EvaluationEntryTone;
  note: string;
  authorName?: string;
  createdAt: DateTimeISO;
}

export interface StudentPromotionHistoryEntry {
  id: Id;
  date: DateISO;
  fromLevelName?: string;
  fromSubLevel?: number;
  toLevelName: string;
  toLevelColor: ProgressionBeltColor;
  toSubLevel: number;
  attendancesCompleted?: number;
  monthsInLevel?: number;
  isExam?: boolean;
  notes?: string;
  createdAt: DateTimeISO;
}

export interface StudentModalityProgression {
  modalityId: Id;
  modalityName?: string;
  levelId?: string;
  levelName: string;
  levelColor: ProgressionBeltColor;
  subLevel: number;
  maxSubLevels?: number;
  promotedAt: DateISO;
  initialAttendanceOffset?: number;
  nextExamDate?: DateISO;
  strengths: string[];
  focusAreas: string[];
  evaluations: StudentEvaluationEntry[];
  promotionHistory: StudentPromotionHistoryEntry[];
  updatedAt: DateTimeISO;
}

export interface StudentModalityOverviewItem {
  modality: Category;
  isEnrolled: boolean;
  enrolledClassNames: string[];
  presentSincePromotion: number;
  totalPresentInModality: number;
  progression?: StudentModalityProgression;
}

export interface StudentProgressionOverview {
  studentId: Id;
  studentName: string;
  items: StudentModalityOverviewItem[];
}

export interface Client {
  id: Id;
  organizationId: Id;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  address?: Address;
  // Gestão de planos e mensalidade (vínculo no aluno)
  planId?: Id;
  planStartDate?: DateISO; // Data de início da vigência do plano (ex: '2026-09-21')
  billingStrategy?: StudentBillingStrategy; // Estratégia de cobrança inicial: proporcional ou ciclo completo
  cyclePaymentTiming?: StudentCyclePaymentTiming; // 'prepaid' (antes do período) ou 'postpaid' (depois do uso)
  dueDay?: number; // 1 a 31 (dia preferencial de vencimento da mensalidade)
  discount?: StudentDiscount;
  membershipStatus?: MembershipStatus;
  progressions?: Record<Id, StudentModalityProgression>;
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export interface CreateClientInitialCharge {
  amountCents: number;
  dueDate: DateISO;
  periodStart?: DateISO;
  periodEnd?: DateISO;
  isProrated?: boolean;
  proratedDays?: number;
}

export type CreateClient = Omit<Client, "id" | "createdAt" | "updatedAt" | TenantScopeFields> & {
  initialCharge?: CreateClientInitialCharge;
};
export type UpdateClient = Partial<CreateClient>;

export interface ClientFilter {
  search?: string; // nome ou telefone
  status?: RecordStatus;
  planId?: Id;
  membershipStatus?: MembershipStatus;
}


