import type { Address, DateISO, DateTimeISO, Id, RecordStatus, TenantScopeFields } from "./common";
import type { Category, ProgressionBeltColor } from "./category";

export type DiscountType = "percentage" | "fixed";

export interface StudentDiscount {
  type: DiscountType;
  value: number; // centavos se fixed (ex: 3000 = R$ 30,00) ou percentual (ex: 10 = 10%)
  reason?: string;
  /**
   * Bolsa (sempre percentual: 100 = integral). Integral gera a mensalidade como
   * "Isento" (`waived`); parcial cobra o valor reduzido com selo de bolsa.
   */
  scholarship?: boolean;
  /** Ultimo dia em que o desconto/bolsa vale; periodos depois voltam ao valor cheio. */
  validUntil?: DateISO;
}

export type MembershipStatus = "active" | "paused" | "canceled";

export type StudentBillingStrategy = "prorated" | "full_cycle";
export type StudentCyclePaymentTiming = "prepaid" | "postpaid";

export type EvaluationEntryTone = "positive" | "attention" | "general";

/**
 * Meta de treino do aluno na modalidade ("Drill lateral · 20", "Defesa de
 * costas"). Substitui os antigos "pontos a melhorar": sem `target`, funciona
 * como um foco que o professor marca como feito.
 */
export interface StudentGoal {
  id: Id;
  title: string;
  /** Quantidade alvo (opcional). */
  target?: number;
  /** Quanto ja foi feito (so conta com `target`). */
  progress: number;
  /** Feita: com alvo, ao chegar nele; sem alvo, marcada pelo professor. */
  completedAt?: DateISO;
  createdAt: DateTimeISO;
}

/** Avanco de meta registrado numa aula (guarda o titulo da epoca). */
export interface StudentGoalProgressEntry {
  goalId: Id;
  title: string;
  /** Quanto somou (meta com alvo). */
  amount?: number;
  /** Marcou como feita (meta sem alvo, ou chegou no alvo). */
  completed?: boolean;
}

/** Registro de aula do aluno (individual ou da turma inteira, pela chamada). */
export interface StudentEvaluationEntry {
  id: Id;
  date: DateISO;
  classGroupId?: Id;
  classGroupName?: string;
  sessionId?: Id;
  tone: EvaluationEntryTone;
  note: string;
  /** Anotacao da turma inteira (registro em lote na chamada). */
  classNote?: string;
  /** Lembrete para a proxima aula: aparece na chamada como "Para hoje". */
  nextClassNote?: string;
  goalProgress?: StudentGoalProgressEntry[];
  authorName?: string;
  createdAt: DateTimeISO;
}

export interface StudentPromotionHistoryEntry {
  id: Id;
  date: DateISO;
  fromLevelName?: string;
  fromSubLevel?: number;
  toLevelName: string;
  toLevelColor?: ProgressionBeltColor;
  toSubLevel: number;
  attendancesCompleted?: number;
  monthsInLevel?: number;
  isExam?: boolean;
  notes?: string;
  /** Quem graduou (professor ou banca), texto livre. */
  examiner?: string;
  createdAt: DateTimeISO;
}

/** Como o aluno chegou na modalidade ("Ponto de partida"). */
export type StudentProgressionOrigin = "started_here" | "transfer" | "before_system";

export interface StudentModalityProgression {
  modalityId: Id;
  modalityName?: string;
  levelId?: string;
  levelName: string;
  levelColor?: ProgressionBeltColor;
  subLevel: number;
  maxSubLevels?: number;
  promotedAt: DateISO;
  initialAttendanceOffset?: number;
  /** Ponto de partida: comecou aqui, veio de outra academia ou ja treinava antes do sistema. */
  origin?: StudentProgressionOrigin;
  /** Academia de origem (so `transfer`). */
  originAcademy?: string;
  /** Professor que graduou na origem (so `transfer`). */
  originTeacher?: string;
  nextExamDate?: DateISO;
  strengths: string[];
  /** Metas de treino (antes "pontos a melhorar"; migracao v29). */
  goals: StudentGoal[];
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

/** Novo registro de aula de um aluno (o autor vem da sessao). */
export interface CreateStudentClassRecord {
  studentId: Id;
  modalityId: Id;
  classGroupId?: Id;
  classGroupName?: string;
  sessionId?: Id;
  date: DateISO;
  tone: EvaluationEntryTone;
  note?: string;
  nextClassNote?: string;
  goalProgress?: { goalId: Id; amount?: number; completed?: boolean }[];
}

/**
 * Registro da turma inteira pela chamada: vira um registro na ficha de cada
 * aluno marcado. Com `classNote`, todos os listados ganham o registro.
 */
export interface CreateClassRecordsBatch {
  sessionId: Id;
  classGroupId: Id;
  classGroupName: string;
  modalityId: Id;
  date: DateISO;
  classNote?: string;
  entries: { studentId: Id; tone?: EvaluationEntryTone; note?: string }[];
}

/**
 * Sugestoes de pontos fortes e de metas, aprendidas do que o espaco ja
 * preencheu na MESMA modalidade (sem listas fixas), do mais usado ao menos.
 */
export interface ProgressionTermSuggestions {
  strengths: string[];
  goals: string[];
}

/** Responsavel pelo aluno (pais, avos, tutor). */
export interface StudentGuardian {
  name: string;
  /** Parentesco em texto livre ("Mãe", "Pai", "Avó"...). */
  relationship?: string;
  phone?: string;
  email?: string;
}

export interface Client {
  id: Id;
  organizationId: Id;
  name: string;
  phone: string;
  email?: string;
  /** Aniversariantes do mes/dia (relatorio, avisos, mensagem de parabens). */
  birthDate?: DateISO;
  /** Responsaveis (menores de idade ou contato extra). */
  guardians?: StudentGuardian[];
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


