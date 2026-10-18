import type { FileAttachment } from "./attachment";
import type { DateISO, DateTimeISO, Id, RecordStatus, TenantScopeFields } from "./common";
import type { ChargePaidVia } from "./finance";

/**
 * Billing & plans (financial). Record/status only, no payment gateway.
 * Membership charges follow the organization's billing rules (prepaid or
 * postpaid, prorated or full cycle), computed by @gestarahub/core/billing.
 * Paused/canceled memberships generate no charge; drop-in = drop-in charge;
 * extra = one-off charge (fee, material, event), optionally in installments;
 * course = installment of a closed-price course, created by the enrollment;
 * package = installment of a lesson package sold to the student.
 */

/** Plan periodicity: monthly, biweekly, or weekly (recurring memberships). */
export type PlanPeriod = "monthly" | "biweekly" | "weekly";

/** Access or membership plan. */
export interface Plan {
  id: Id;
  organizationId: Id;
  name: string;
  priceCents: number;
  period: PlanPeriod;
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreatePlan = Omit<Plan, "id" | "createdAt" | "updatedAt" | TenantScopeFields>;
export type UpdatePlan = Partial<CreatePlan>;

export interface PlanFilter {
  search?: string;
  period?: PlanPeriod;
  status?: RecordStatus;
}

/**
 * Student charge: recurring membership, single drop-in session or extra
 * (one-off charge such as enrollment fee, material, uniform, exam or event)
 * or course (installment of a closed-price course, created at enrollment)
 * or package (installment of a lesson package sold to the student).
 */
export type ChargeKind = "membership" | "dropin" | "extra" | "course" | "package";
/** `waived` = isento (bolsa integral): R$ 0, nunca pendente nem em atraso. */
export type ChargeStatus = "pending" | "paid" | "overdue" | "canceled" | "waived";
export type PaymentMethod = "cash" | "pix" | "card" | "other";
/**
 * Quem cancelou: "user" (acao manual, pode ser reaberta) ou "system" (troca de
 * plano/regra, inativacao, saida da aula; nao pode ser reaberta).
 */
export type ChargeCanceledBy = "system" | "user";

export interface Charge {
  id: Id;
  organizationId: Id;
  unitId?: Id; // unidade onde a cobranca nasceu (relatorios por unidade); ausente em dados antigos
  studentId: Id;
  kind: ChargeKind;
  planId?: Id; // membership
  classGroupId?: Id;
  competence?: string; // "YYYY-MM" of the due date (membership)
  periodStart?: DateISO; // usage period this membership charge pays for
  periodEnd?: DateISO;
  sessionId?: Id; // dropin (reserved session)
  dueDate: DateISO;
  amountCents: number;
  status: ChargeStatus;
  paidAt?: DateTimeISO;
  method?: PaymentMethod;
  /** Como foi paga (ausente em dados antigos = manual). */
  paidVia?: ChargePaidVia;
  /** Comprovantes anexados ao registrar o pagamento manual. */
  attachments?: FileAttachment[];
  canceledBy?: ChargeCanceledBy; // so quando status = "canceled"; ausente em dados antigos
  /** Motivo do cancelamento manual (texto livre, ex.: "Plano errado"). */
  cancelReason?: string;
  /**
   * Cancelada pelo sistema porque outra cobranca tomou o lugar (troca de plano,
   * regra, desconto ou bolsa). Mostrada como "Substituída", fora do total de
   * canceladas (nao e dinheiro perdido) e oculta da lista por padrao.
   */
  replaced?: boolean;
  /** Bolsa aplicada nesta mensalidade (100 = integral). */
  scholarshipPercent?: number;
  /** Valor sem desconto/bolsa (base para "bolsas concedidas"). So com bolsa. */
  listAmountCents?: number;
  /** Extra charge: what is being charged ("Taxa de matrícula", "Kimono"). Course: the class name. Package: the package name. */
  description?: string;
  /** Extra, course or package in installments: shared by every installment of the same purchase. */
  installmentGroupId?: Id;
  /** Course installment: the enrollment that created it. */
  enrollmentId?: Id;
  /** Package installment: the student package that created it. */
  studentPackageId?: Id;
  /** Position in the competence (membership) or installment number (extra/course/package, "2 de 3"). */
  cycleIndex?: number;
  cycleTotal?: number;
  isProrated?: boolean;
  proratedDays?: number;
  notes?: string;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

/**
 * Pagamento registrado a mao (cobranca, lancamento, professor): o dia em que o
 * dinheiro entrou (data local; ausente = hoje, nunca no futuro) e os comprovantes.
 */
export interface ManualPaymentDetails {
  paidOn?: DateISO;
  receipts?: FileAttachment[];
}

/**
 * New extra charge (cobranca avulsa). `totalCents` is split into
 * `installments` monthly charges (1 to 12) starting at `firstDueDate`.
 * Tenant fields are stamped by the service.
 */
export interface CreateExtraCharge {
  studentId: Id;
  description: string;
  totalCents: number;
  firstDueDate: DateISO;
  installments: number;
}

export interface ChargeFilter {
  competence?: string;
  kind?: ChargeKind;
  status?: ChargeStatus;
  studentId?: Id;
}

export interface ChargeView extends Charge {
  studentName: string;
  /**
   * Paga e ja contada no pagamento fechado de um professor: competencia
   * ("YYYY-MM") desse fechamento. Desfazer o pagamento nao muda o valor fechado.
   */
  teacherPayClosedIn?: string;
  /** Telefone do aluno (lembrete pelo WhatsApp). */
  studentPhone?: string;
  planName?: string;
  planPeriod?: PlanPeriod;
  className?: string;
}

// Backward compatibility aliases during transition
export type Plano = Plan;
export type CreatePlano = CreatePlan;
export type UpdatePlano = UpdatePlan;
export type PlanoFilter = PlanFilter;
export type CobrancaKind = ChargeKind;
export type CobrancaStatus = ChargeStatus;
export type Cobranca = Charge;
export type CobrancaFilter = ChargeFilter;
export type CobrancaView = ChargeView;
