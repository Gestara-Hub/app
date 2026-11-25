import type { FileAttachment } from "./attachment";
import type { PaymentMethod } from "./billing";
import type { DateISO, DateTimeISO, Id, RecordStatus, TenantScopeFields } from "./common";
import type { PaginationParams } from "./pagination";

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
export type FinancialSystemCategoryKey =
  | "memberships"
  | "dropins"
  | "extras"
  | "courses"
  | "packages"
  /** Inscricoes em eventos e seminarios (doc product/29; virou fonte automatica em 09/11/2026). */
  | "events"
  | "teachers"
  /** Taxas do pagamento online que ficaram com o espaco (saida automatica, 01/11/2026). */
  | "online_fees";

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
  /** Comprovantes, notas e boletos (entrada ou saida). */
  attachments?: FileAttachment[];
  /** Lancamento de um evento (cache do convidado, passagem): aparece no financeiro do evento tambem. */
  eventId?: Id;
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
  Pick<FinancialEntry, "categoryId" | "description" | "amountCents" | "dueDate" | "notes" | "attachments">
>;

/** Escopo da edicao de um lancamento de serie. */
export type FinancialEntryUpdateScope = "single" | "following";

export interface FinancialEntryFilter extends PaginationParams {
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
  percent?: number; // percent_of_memberships, "% do que os alunos pagaram" (0 < p <= 100)
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

/**
 * De onde vem a base do % (`percent_of_memberships`, "% do que os alunos
 * pagaram", decisao 7 do doc 20): mensalidades, parcelas de curso ou aulas de
 * pacote dadas.
 */
export type TeacherPayPercentSource = "memberships" | "courses" | "packages";

export interface TeacherPayoutLine {
  kind: TeacherPayoutLineKind;
  label: string; // "16 aulas × R$ 60,00", "40% de R$ 300,00 em mensalidades", "Bônus seminário"
  quantity?: number; // aulas, alunos, aulas de pacote
  baseCents?: number; // base do % (o que os alunos pagaram, nesta fonte)
  /** Fonte da base do % (uma linha por fonte). Ausente em linhas antigas e na linha zerada. */
  source?: TeacherPayPercentSource;
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
  /** Comprovantes anexados ao registrar o pagamento. */
  attachments?: FileAttachment[];
  /**
   * Mensalidades e parcelas de curso que entraram no % deste fechamento. Paga
   * depois do fechamento conta uma vez, no proximo mes aberto do professor.
   * Ausente em fechamentos antigos (compara `paidAt` com `closedAt`).
   */
  countedChargeIds?: Id[];
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
  /** Resumo da regra ("Fixo R$ 800,00 + 30% do que os alunos pagaram"). */
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

/**
 * Forma da cobranca online (uma por cobranca; no Asaas, um `billingType`):
 * "pix" (PIX, QR na hora), "link" (CREDIT_CARD: fatura com credito ou debito),
 * "boleto" (BOLETO) e "choice" (UNDEFINED: o aluno escolhe Pix, boleto ou cartao).
 */
export type OnlinePaymentMethod = "pix" | "link" | "boleto" | "choice";

/** Formas que o espaco aceita (Recebimentos online). Ausente: Pix e cartao sim, boleto nao. */
export interface AcceptedOnlineMethods {
  pix: boolean;
  card: boolean;
  boleto: boolean;
}
export type OnlinePaymentStatus = "awaiting" | "paid" | "expired" | "canceled";
/**
 * Estorno ou contestacao avisados pelo parceiro depois do pagamento (doc
 * product/25, urgencia): a cobranca continua paga no app; o dono e avisado no
 * sino, no topo e numa modal, e decide o que fazer.
 */
export type OnlinePaymentDisputeStatus =
  | "refund_in_progress"
  | "refunded"
  | "chargeback_requested"
  | "chargeback_dispute"
  | "chargeback_reversal_pending";

export interface OnlinePayment {
  id: Id;
  organizationId?: Id;
  chargeId: Id;
  method: OnlinePaymentMethod;
  amountCents: number;
  status: OnlinePaymentStatus;
  pixCopyPaste?: string; // codigo copia e cola Pix
  linkUrl?: string; // link de pagamento
  publicCode?: string; // codigo do endereco publico /p/<codigo> (pagina do Pix ou ida ao link)
  openedAt?: DateTimeISO; // primeira vez que o aluno abriu a pagina publica
  gatewayProvider?: string; // ex: 'asaas', 'pagbank'
  gatewayPaymentId?: string; // ID da transação no provedor ativo
  splitAmountCents?: number; // valor do split do GestaraHub retido
  gatewayFeeCents?: number; // tarifa do provedor (Asaas); no link e a pior estimativa ate o pagamento, depois a real
  paidMethod?: LinkPaymentMethodName; // meio que o aluno usou (webhook do Asaas)
  creditDate?: DateISO; // dia em que o valor fica (ou ficou) disponivel para saque
  fundsReleased?: boolean; // valor ja disponivel (cartao: pago antes, liberado ~32 dias depois)
  netAmountCents?: number; // valor liquido que a academia recebe (valor - tarifa - split)
  receiptUrl?: string; // comprovante do pagamento no provedor (webhook do Asaas)
  /** Estorno ou contestacao avisados pelo parceiro (ultimo aviso) e quando. */
  disputeStatus?: OnlinePaymentDisputeStatus;
  disputedAt?: DateTimeISO;
  feePassedToCustomer?: boolean; // indica se a taxa de cobranca foi repassada ao aluno
  canceledReason?: string; // motivo do cancelamento (ex: baixa manual, gerado novo código)
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
/** Meio que o aluno usou de fato: Pix direto ou o que escolheu na fatura do link. */
export type LinkPaymentMethodName = "pix" | "boleto" | "creditCard" | "debitCard";

/** Tarifa de um meio no provedor: percentual sobre o valor mais um fixo (centavos). */
export interface GatewayFeeRule {
  percent: number; // fracao: 1,99% = 0.0199
  fixedCents: number;
  minCents?: number; // piso quando a tarifa e percentual
  maxCents?: number; // teto quando a tarifa e percentual
}

/** Tarifa de um meio com a promocao, se houver (vale ate `promoUntil`, exclusive). */
export interface GatewayFeeWithPromo extends GatewayFeeRule {
  promo?: GatewayFeeRule;
  promoUntil?: DateISO;
}

/**
 * Tabela de tarifas da subconta do espaco no provedor (Asaas `GET /myAccount/fees`),
 * guardada crua: a promocao e escolhida pela data na hora de usar (doc 19, secao 4).
 */
export interface GatewayAccountFees {
  pix: GatewayFeeWithPromo;
  creditCard: GatewayFeeWithPromo;
  debitCard: GatewayFeeWithPromo;
  boleto: GatewayFeeWithPromo;
  syncedAt: DateTimeISO;
}

export interface OnlinePaymentSettings {
  enabled: boolean;
  pixKey?: string; // exibida como dado da academia (simulado)
  defaultExpiresInMinutes?: number; // padrao 1440 (24 h)
  gatewayProvider?: string; // 'asaas' | 'pagbank' | ...
  gatewayAccountId?: string; // subconta no provedor
  gatewayWalletId?: string; // carteira no provedor
  gatewayApiKey?: string; // chave da subconta no provedor (armazenada de forma segura)
  gatewayStatus?: "not_configured" | "pending" | "approved" | "rejected";
  passFeeToCustomer?: boolean; // repassar taxa da cobranca ao aluno por padrao
  passFeePix?: boolean; // repassar taxa no Pix
  passFeeCard?: boolean; // repassar taxa no Cartao (link)
  passFeeBoleto?: boolean; // repassar taxa no boleto
  passFeeChoice?: boolean; // repassar taxa quando o aluno escolhe
  acceptedMethods?: AcceptedOnlineMethods; // formas que o espaco aceita
  gatewayFees?: GatewayAccountFees; // tarifas da subconta (lidas da coluna gateway_fees, nunca gravadas em settings)
  /** Analise da conta no Asaas (25/11/2026): so `general` APPROVED e conta pronta de verdade. */
  asaasStatus?: AsaasAccountStatus;
}

/** Situacao de cada parte da analise da conta no Asaas. */
export type AsaasApprovalStatus = "PENDING" | "AWAITING_APPROVAL" | "APPROVED" | "REJECTED";

/** Situacao cadastral da subconta no Asaas (GET /myAccount/status e avisos ACCOUNT_STATUS_*). */
export interface AsaasAccountStatus {
  general: AsaasApprovalStatus;
  documentation?: AsaasApprovalStatus;
  commercialInfo?: AsaasApprovalStatus;
  bankAccountInfo?: AsaasApprovalStatus;
  /** Quando foi lida ou avisada pela ultima vez (ISO). */
  checkedAt: string;
}

/** Situacao de um grupo de documentos pedido pelo Asaas. */
export type AsaasDocumentStatus = "NOT_SENT" | "PENDING" | "APPROVED" | "REJECTED" | "IGNORED";

/** Documento (grupo) que o Asaas pede para aprovar a conta. */
export interface SubaccountDocumentView {
  id: string;
  type: string;
  title: string;
  description?: string;
  status: AsaasDocumentStatus;
  /** Link de envio do Asaas (modelo BaaS); sem ele, o envio e pelo site do Asaas. */
  onboardingUrl?: string;
}

/** O que falta para a conta de recebimento ficar pronta (cartao "Deixe sua conta pronta"). */
export interface SubaccountOnboardingView {
  status: AsaasAccountStatus;
  documents: SubaccountDocumentView[];
  /** Motivo da recusa, quando o Asaas informa. */
  rejectReasons?: string;
}

/** Como a cobranca do aluno foi paga. */
export type ChargePaidVia = "manual" | "online" | "recurring";

// ---------------------------------------------------------------------------
// Read-models das telas
// ---------------------------------------------------------------------------

/** Origem de um item de caixa (para agregacao e links). */
export type CashFlowSource = "charge" | "entry" | "teacher_payout" | "online_fee";

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
  /**
   * Bolsas concedidas nas mensalidades do mes (valor do plano - valor cobrado).
   * Informativo: nao entra no caixa nem no resultado.
   */
  scholarshipGrantedCents?: number;
  /** Alunos com bolsa nas mensalidades do mes. */
  scholarshipStudents?: number;
  /** Parte do "Saiu" que sao taxas do pagamento online (popover do card, 01/11/2026). */
  onlineFeesPaidCents?: number;
  /**
   * So no mes atual: atrasos ate hoje de TODOS os meses (divida nao some na
   * virada do mes). Os campos `*OverdueCents` acima continuam so do mes.
   */
  overdueToDate?: FinanceOverdueToDate;
}

/** Atrasos acumulados ate hoje (todas as competencias). */
export interface FinanceOverdueToDate {
  incomeCents: number;
  incomeCount: number;
  expenseCents: number;
  /** Entradas atrasadas por mes do vencimento, do mais antigo ao mais novo. */
  incomeByCompetence: { competence: string; amountCents: number }[];
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
  /** Lancamento ligado a um evento (doc product/29): aparece tambem no financeiro do evento. */
  eventId?: Id;
  eventName?: string;
  recurrenceId?: Id;
  /** Lancamento ja foi pago alguma vez (mesmo desfeito): nao pode ser excluido (D2). */
  everPaid?: boolean;
  /** A repeticao do lancamento ainda esta ativa (esconde "Encerrar repeticao"). */
  recurrenceActive?: boolean;
  /** Agregado de cobrancas: contagens por status. */
  chargeCounts?: { paid: number; pending: number; overdue: number };
  /** Agregado de cobrancas: quanto ja foi pago (o resto e "a receber"). */
  chargePaidCents?: number;
  /** Pagamento de professor (source = "teacher_payout"). */
  professionalId?: Id;
  payoutId?: Id;
  /** Taxas do pagamento online (source = "online_fee"): quantos pagamentos somaram a linha. */
  onlinePaymentCount?: number;
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
