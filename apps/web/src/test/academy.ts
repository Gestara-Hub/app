import type {
  Charge,
  Client,
  OrganizationSettings,
  Plan,
  PlanPeriod,
  StudentBillingStrategy,
  StudentCyclePaymentTiming,
} from "@gestarahub/contracts";
import { firstCharge, resolveMembershipTerms } from "@gestarahub/core/billing";
import { resetStore, setActiveOrganization, store } from "@/mocks/store";
import { billingService } from "@/services/billingService";
import { clientsService } from "@/services/clientsService";

export const ACADEMY_ORG = "org-academia-x";
export const ACADEMY_UNIT = "unit-academia-x";

/** Mundo limpo, tenant da academia ativo, regras de cobranca e horario definidos. */
export function resetAcademy(settings: OrganizationSettings = {}): void {
  resetStore();
  setActiveOrganization(ACADEMY_ORG);
  store.organization.settings = {
    defaultDueDay: 10,
    billingTiming: "prepaid",
    midMonthStrategy: "prorated",
    ...settings,
  };
  const open = (weekday: 1 | 2 | 3 | 4 | 5 | 6) => ({
    weekday,
    closed: false,
    start: "06:00",
    end: "22:00",
    shifts: [{ start: "06:00", end: "22:00" }],
  });
  store.unit.businessHours = [
    { weekday: 0, closed: true, shifts: [] },
    open(1),
    open(2),
    open(3),
    open(4),
    open(5),
    open(6),
  ];
}

export function createPlan(period: PlanPeriod, priceCents: number, name = `Plano ${period}`): Promise<Plan> {
  return billingService.createPlan({ name, period, priceCents, status: "active" });
}

interface EnrollOptions {
  name?: string;
  plan: Plan;
  startDate: string;
  timing?: StudentCyclePaymentTiming;
  strategy?: StudentBillingStrategy;
}

/**
 * Cadastra um aluno com plano do jeito que o formulario faz: resolve a regra
 * (aluno > academia), calcula a 1a cobranca pelo motor e envia como initialCharge.
 */
export async function enrollStudent(opts: EnrollOptions): Promise<Client> {
  const settings = store.organization.settings ?? {};
  const strategy = opts.strategy ?? settings.midMonthStrategy ?? "prorated";
  const timing = opts.timing ?? settings.billingTiming ?? "prepaid";
  const terms = resolveMembershipTerms(
    {
      period: opts.plan.period,
      planPriceCents: opts.plan.priceCents,
      startDate: opts.startDate,
      strategy,
      timing,
      dueDay: strategy === "full_cycle" ? undefined : settings.defaultDueDay,
    },
    settings,
  );
  const first = firstCharge(terms);
  return clientsService.create({
    name: opts.name ?? `Aluno ${opts.startDate}`,
    phone: "11977770000",
    status: "active",
    membershipStatus: "active",
    planId: opts.plan.id,
    planStartDate: opts.startDate,
    billingStrategy: strategy,
    cyclePaymentTiming: timing,
    dueDay: terms.dueDay,
    initialCharge: {
      amountCents: first.amountCents,
      dueDate: first.dueDate,
      periodStart: first.periodStart,
      periodEnd: first.periodEnd,
      isProrated: first.isProrated,
      proratedDays: first.proratedDays,
    },
  });
}

/** Mensalidades de um aluno como "vencimento valor" em ordem, para asserts legiveis. */
export function chargesOf(studentId: string, opts: { includeCanceled?: boolean } = {}): string[] {
  return store.charges
    .filter((c: Charge) => c.studentId === studentId && (opts.includeCanceled || c.status !== "canceled"))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((c) => `${c.dueDate} ${c.amountCents}`);
}
