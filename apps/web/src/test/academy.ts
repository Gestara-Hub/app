import type {
  Charge,
  ClassGroupView,
  ClassMeetingSlot,
  Client,
  OrganizationSettings,
  Plan,
  PlanPeriod,
  ProfessionalView,
  StudentBillingStrategy,
  StudentCyclePaymentTiming,
} from "@gestarahub/contracts";
import { firstCharge, resolveMembershipTerms } from "@gestarahub/core/billing";
import { resetStore, setActiveOrganization, store } from "@/mocks/store";
import { billingService } from "@/services/billingService";
import { categoriesService } from "@/services/categoriesService";
import { clientsService } from "@/services/clientsService";
import { professionalsService } from "@/services/professionalsService";
import { turmasService } from "@/services/turmasService";

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

// --- Turmas -----------------------------------------------------------------

/** Instrutor ativo (com modalidade propria criada se nao informada). */
export async function createInstructor(name: string, modalityId?: string): Promise<ProfessionalView> {
  const modality = modalityId ?? (await categoriesService.create({ name: `Modalidade ${name}` })).id;
  return professionalsService.create({
    name,
    status: "active",
    workingHours: [],
    serviceIds: [],
    modalityIds: [modality],
  });
}

interface ClassOptions {
  name?: string;
  instructorId: string;
  slots: ClassMeetingSlot[];
  capacity?: number;
  allowDropin?: boolean;
  sessionPriceCents?: number;
  startDate?: string;
}

/** Turma ativa desde 14/09/2026 (segunda da semana passada), na modalidade do instrutor. */
export function createClass(opts: ClassOptions): Promise<ClassGroupView> {
  const instructor = store.professionals.find((p) => p.id === opts.instructorId);
  return turmasService.create({
    name: opts.name ?? "Turma",
    modalityId: instructor?.modalityIds?.[0] ?? "",
    instructorId: opts.instructorId,
    capacity: opts.capacity ?? 10,
    allowDropin: opts.allowDropin ?? true,
    sessionPriceCents: opts.sessionPriceCents ?? 4000,
    meetingSlots: opts.slots,
    startDate: opts.startDate ?? "2026-09-14",
    status: "active",
  });
}

/** Aluno ativo sem plano. */
export function createStudent(name: string): Promise<Client> {
  return clientsService.create({ name, phone: "11977770000", status: "active" });
}

/** Id da aula gerada (`turma~data~inicio`). */
export const sessionIdOf = (classGroupId: string, date: string, start: string) =>
  `${classGroupId}~${date}~${start}`;
