import type { DateISO, DateTimeISO, Id, RecordStatus } from "./common";

/**
 * Billing & plans (financial). Record/status only, no payment gateway.
 * Membership charges follow the organization's billing rules (prepaid or
 * postpaid, prorated or full cycle), computed by @gestarahub/core/billing.
 * Paused/canceled memberships generate no charge; drop-in = drop-in charge.
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

export type CreatePlan = Omit<Plan, "id" | "createdAt" | "updatedAt">;
export type UpdatePlan = Partial<CreatePlan>;

export interface PlanFilter {
  search?: string;
  period?: PlanPeriod;
  status?: RecordStatus;
}

/** Student charge (recurring membership or single drop-in session). */
export type ChargeKind = "membership" | "dropin";
export type ChargeStatus = "pending" | "paid" | "overdue" | "canceled";
export type PaymentMethod = "cash" | "pix" | "card" | "other";

export interface Charge {
  id: Id;
  organizationId: Id;
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
  cycleIndex?: number;
  cycleTotal?: number;
  isProrated?: boolean;
  proratedDays?: number;
  notes?: string;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export interface ChargeFilter {
  competence?: string;
  kind?: ChargeKind;
  status?: ChargeStatus;
  studentId?: Id;
}

export interface ChargeView extends Charge {
  studentName: string;
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
