import type { PaymentMethod } from "./billing";
import type { DateISO, DateTimeISO, Id, RecordStatus, TenantScopeFields } from "./common";

/**
 * Financeiro do negocio (plano pago). Nao duplica as cobrancas dos alunos
 * (`Charge`): elas sao lidas como fonte de entrada. `FinancialEntry` cobre so o
 * que nao nasce de cobranca de aluno nem de pagamento a professor.
 * Especificacao: docs/technical/05-modulo-financeiro.
 */

// ---------------------------------------------------------------------------
// Lancamentos (entradas e saidas)
// ---------------------------------------------------------------------------

export type FinancialEntryType = "income" | "expense";
/** `overdue` nao e gravado: e derivado na leitura (pending com dueDate < hoje). */
export type FinancialEntryStatus = "pending" | "paid" | "canceled";
/** Status exibido/filtrado (inclui o derivado `overdue`). */
export type FinancialEntryDisplayStatus = FinancialEntryStatus | "overdue";

/**
 * Chave das categorias de sistema (representam fontes automaticas). Nao podem
 * ser apagadas, renomeadas nem escolhidas num lancamento manual.
 */
export type FinancialSystemCategoryKey = "memberships" | "dropins" | "teachers";

export interface FinancialCategory {
  id: Id;
  organizationId: Id;
  type: FinancialEntryType;
  name: string; // "Aluguel", "Venda de produtos"...
  /** Categoria do sistema: nao pode ser apagada nem renomeada. */
  system?: boolean;
  /** Presente so nas categorias de sistema (identifica a fonte). */
  systemKey?: FinancialSystemCategoryKey;
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreateFinancialCategory = Pick<FinancialCategory, "type" | "name">;
export type UpdateFinancialCategory = Partial<Pick<FinancialCategory, "name" | "status">>;

export interface FinancialCategoryFilter {
  type?: FinancialEntryType;
  status?: RecordStatus;
  /** false = so as que podem ser escolhidas num lancamento manual. */
  includeSystem?: boolean;
}

export interface FinancialEntry {
  id: Id;
  organizationId: Id;
  unitId?: Id;
  type: FinancialEntryType;
  categoryId: Id;
  description: string; // "Aluguel de outubro", "Kimonos para revenda"
  amountCents: number; // sempre > 0; o sinal vem do type
  dueDate: DateISO;
  status: FinancialEntryStatus;
  paidAt?: DateTimeISO;
  method?: PaymentMethod; // reusa o enum das cobrancas
  /** Repeticao mensal (aluguel, internet). */
  recurrenceId?: Id;
  /** Competencia "YYYY-MM" que a recorrencia materializou (idempotencia). */
  recurrenceCompetence?: string;
  notes?: string;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export interface FinancialRecurrence {
  id: Id;
  organizationId: Id;
  type: FinancialEntryType;
  categoryId: Id;
  description: string;
  amountCents: number;
  dayOfMonth: number; // 1..28
  startCompetence: string; // "YYYY-MM"
  endCompetence?: string; // ausente = sem fim
  status: RecordStatus; // inactive = para de gerar
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreateFinancialEntry = Omit<
  FinancialEntry,
  | "id"
  | "status"
  | "paidAt"
  | "recurrenceId"
  | "recurrenceCompetence"
  | "createdAt"
  | "updatedAt"
  | TenantScopeFields
> & {
  /** "Ja foi pago": grava como pago agora com esta forma. */
  paidNow?: { method: PaymentMethod };
  /** "Repetir todo mes": cria a recorrencia a partir do mes do vencimento. */
  repeatMonthly?: boolean;
};

export type UpdateFinancialEntry = Partial<
  Pick<FinancialEntry, "categoryId" | "description" | "amountCents" | "dueDate" | "notes">
>;

/** Escopo da edicao de um lancamento de serie. */
export type FinancialEntryUpdateScope = "single" | "following";

export interface FinancialEntryFilter {
  competence?: string; // "YYYY-MM" do vencimento
  type?: FinancialEntryType;
  status?: FinancialEntryDisplayStatus;
  categoryId?: Id;
  search?: string;
}

// ---------------------------------------------------------------------------
// Pagamento dos professores
// ---------------------------------------------------------------------------

export type TeacherPayComponentKind =
  | "fixed_monthly"
  | "per_session"
  | "per_student"
  | "percent_of_memberships";

export interface TeacherPayComponent {
  kind: TeacherPayComponentKind;
  amountCents?: number; // fixed_monthly, per_session, per_student
  percent?: number; // percent_of_memberships (0 < p <= 100)
  /** Restringe a parte a algumas turmas. Ausente = todas as turmas dele. */
  classGroupIds?: Id[];
}

export interface TeacherPayRule {
  id: Id;
  organizationId: Id;
  professionalId: Id;
  components: TeacherPayComponent[]; // pelo menos 1
  paymentDay?: number; // dia do vencimento no mes seguinte (1..28; padrao 5)
  startCompetence: string; // vigencia "YYYY-MM"
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type SaveTeacherPayRule = Pick<
  TeacherPayRule,
  "components" | "paymentDay" | "startCompetence"
> & { status?: RecordStatus };

export type TeacherPayoutStatus = "open" | "closed" | "paid" | "canceled";

export type TeacherPayoutLineKind = TeacherPayComponentKind | "adjustment";

export interface TeacherPayoutLine {
  kind: TeacherPayoutLineKind;
  label: string; // "16 aulas × R$ 60,00", "Bônus seminário"
  quantity?: number; // aulas, alunos
  baseCents?: number; // base do % (mensalidades pagas)
  amountCents: number; // negativo so em adjustment (desconto/vale)
}

/** Ajuste do fechamento (bonus positivo; desconto/vale negativo). */
export interface TeacherPayoutAdjustment {
  label: string;
  amountCents: number;
}

export interface TeacherPayout {
  id: Id;
  organizationId: Id;
  professionalId: Id;
  competence: string; // "YYYY-MM" (mes trabalhado)
  lines: TeacherPayoutLine[];
  totalCents: number; // soma das linhas (>= 0)
  dueDate: DateISO; // paymentDay do mes seguinte (padrao dia 5)
  status: TeacherPayoutStatus;
  closedAt?: DateTimeISO;
  paidAt?: DateTimeISO;
  method?: PaymentMethod;
  notes?: string;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

/** Aula contada no calculo (para o detalhe do mes, incluindo substituicoes). */
export interface TeacherPaySessionFact {
  sessionId: Id;
  classGroupId: Id;
  date: DateISO;
  /** Instrutor efetivo (substituto quando houve troca). */
  instructorId: Id;
  /** Titular da turma. */
  primaryInstructorId: Id;
}

/** Linha da aba Professores: professor + regra + valor do mes. */
export interface TeacherPayoutView {
  professionalId: Id;
  professionalName: string;
  professionalStatus: RecordStatus;
  rule?: TeacherPayRule;
  /** Resumo da regra ("Fixo R$ 800,00 + 30% das mensalidades"). */
  ruleSummary?: string;
  competence: string;
  /** Registro persistido (closed/paid); ausente = previa aberta. */
  payout?: TeacherPayout;
  status: TeacherPayoutStatus;
  lines: TeacherPayoutLine[];
  totalCents: number;
  dueDate: DateISO;
  /** Aulas contadas como dadas por este professor na competencia. */
  sessions?: TeacherPaySessionFact[];
}

// ---------------------------------------------------------------------------
// Pagamento online (simulado)
// ---------------------------------------------------------------------------

export type OnlinePaymentMethod = "pix" | "link";
export type OnlinePaymentStatus = "awaiting" | "paid" | "expired" | "canceled";

export interface OnlinePayment {
  id: Id;
  organizationId?: Id;
  chargeId: Id;
  method: OnlinePaymentMethod;
  amountCents: number;
  status: OnlinePaymentStatus;
  pixCopyPaste?: string; // "copia e cola" ficticio
  linkUrl?: string; // link ficticio
  expiresAt: DateTimeISO;
  paidAt?: DateTimeISO;
  createdAt: DateTimeISO;
}

export type RecurringAuthorizationStatus = "pending" | "active" | "revoked";

/** Pix Automatico: autorizacao do aluno para debito recorrente da mensalidade. */
export interface RecurringAuthorization {
  id: Id;
  organizationId: Id;
  studentId: Id;
  maxAmountCents: number;
  status: RecurringAuthorizationStatus;
  authorizedAt?: DateTimeISO;
  revokedAt?: DateTimeISO;
  createdAt: DateTimeISO;
}

/** Em `OrganizationSettings.onlinePayments`. */
export interface OnlinePaymentSettings {
  enabled: boolean;
  pixKey?: string; // exibida como dado da academia (simulado)
  defaultExpiresInMinutes?: number; // padrao 1440 (24 h)
}

/** Como a cobranca do aluno foi paga. */
export type ChargePaidVia = "manual" | "online" | "recurring";

// ---------------------------------------------------------------------------
// Read-models das telas
// ---------------------------------------------------------------------------

/** Origem de um item de caixa (para agregacao e links). */
export type CashFlowSource = "charge" | "entry" | "teacher_payout";

/** Cartoes do Resumo de uma competencia. Valores em centavos. */
export interface FinanceSummary {
  competence: string;
  /** Entrou (pago no mes). */
  incomePaidCents: number;
  /** Saiu (pago no mes). */
  expensePaidCents: number;
  /** Resultado do mes = entrou - saiu. */
  resultCents: number;
  /** A receber: entradas com vencimento no mes, ainda nao pagas. */
  incomeForecastCents: number;
  /** A pagar: saidas com vencimento no mes, ainda nao pagas. */
  expenseForecastCents: number;
  /** Atrasado: entradas vencidas e nao pagas (ate hoje). */
  incomeOverdueCents: number;
  /** Saidas vencidas e nao pagas. */
  expenseOverdueCents: number;
}

/** Ponto do grafico entradas x saidas (ultimos N meses). */
export interface FinanceMonthPoint {
  competence: string;
  incomeCents: number;
  expenseCents: number;
  resultCents: number;
}

/** Total por categoria (secao "Por categoria" do Resumo). */
export interface FinanceCategoryTotal {
  categoryId: Id;
  categoryName: string;
  type: FinancialEntryType;
  system?: boolean;
  totalCents: number;
  /** 0..100 sobre o total do mesmo type no periodo. */
  percent: number;
}

/**
 * Linha unificada da aba Lancamentos. `source = "entry"` e um lancamento manual;
 * `"charge"` e o agregado das cobrancas dos alunos do mes (uma linha por kind,
 * D7); `"teacher_payout"` e um pagamento de professor.
 */
export interface FinanceEntryView {
  /** Id estavel da linha (entry.id, payout.id ou "charges:<kind>:<competence>"). */
  id: string;
  source: CashFlowSource;
  type: FinancialEntryType;
  categoryId?: Id;
  categoryName: string;
  description: string;
  amountCents: number;
  dueDate: DateISO;
  status: FinancialEntryDisplayStatus;
  paidAt?: DateTimeISO;
  method?: PaymentMethod;
  /** Lancamento manual original (source = "entry"). */
  entry?: FinancialEntry;
  recurrenceId?: Id;
  /** Lancamento ja foi pago alguma vez (mesmo desfeito): nao pode ser excluido (D2). */
  everPaid?: boolean;
  /** A repeticao do lancamento ainda esta ativa (esconde "Encerrar repeticao"). */
  recurrenceActive?: boolean;
  /** Agregado de cobrancas: contagens por status. */
  chargeCounts?: { paid: number; pending: number; overdue: number };
  /** Pagamento de professor (source = "teacher_payout"). */
  professionalId?: Id;
  payoutId?: Id;
}

/** Proximo vencimento (contas a pagar e pagamentos de professores). */
export interface FinanceUpcomingItem {
  id: string;
  source: CashFlowSource;
  description: string;
  amountCents: number;
  dueDate: DateISO;
  overdue: boolean;
}
