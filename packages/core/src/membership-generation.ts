import { addMonths, format, parseISO } from "date-fns";
import type { Charge, ClassGroup, Client, DateISO, Enrollment, Id, Plan } from "@gestarahub/contracts";
import {
  chargesDueIn,
  classBillingMode,
  resolveMembershipTerms,
  type BillingDefaults,
  type CompetenceCharge,
  type ScheduledCharge,
} from "@gestarahub/core/billing";
import { dateInSpace } from "@gestarahub/core/date";

/**
 * Geracao automatica das mensalidades, pura (doc 15, fatia 1). A mesma regra
 * roda no navegador (demonstracao, sobre o store) e no servidor (conta real,
 * sobre o banco): recebe os dados e devolve o que falta criar, sem id nem
 * datas de registro, que ficam com quem grava.
 */

/** Mensalidade a criar: a cobranca sem id, organizacao, unidade e datas de registro. */
export type PlannedMembershipCharge = Omit<Charge, "id" | "organizationId" | "unitId" | "createdAt" | "updatedAt">;

export interface MembershipWorld {
  clients: Client[];
  plans: Plan[];
  classGroups: ClassGroup[];
  enrollments: Enrollment[];
  /** Cobrancas existentes (bastam as mensalidades). */
  charges: Charge[];
  settings?: BillingDefaults;
  /** "AAAA-MM-DD" de hoje no horario do espaco. */
  today: DateISO;
}

/** Inicio da vigencia: o do plano ou, sem ele, o dia do cadastro. */
export function membershipStartDate(student: Pick<Client, "planStartDate" | "createdAt">): DateISO {
  return student.planStartDate || dateInSpace(student.createdAt);
}

/** Bolsista integral sem plano: gera mensalidades isentas. */
export function isPlanlessScholar(student: Pick<Client, "planId" | "discount">): boolean {
  return !student.planId && Boolean(student.discount?.scholarship);
}

export type ChargePeriod = Pick<CompetenceCharge, "periodStart" | "periodEnd" | "competence" | "cycleIndex">;

/**
 * A cobranca existente ja cobre o periodo planejado? Com periodo completo vale a
 * sobreposicao (depois de mudar a regra os periodos podem nao bater o inicio, e
 * o mesmo dia nunca e cobrado duas vezes); dado antigo compara inicio/competencia.
 */
export function coversPeriod(c: Charge, planned: ChargePeriod): boolean {
  if (c.periodStart && c.periodEnd) {
    return c.periodStart <= planned.periodEnd && c.periodEnd >= planned.periodStart;
  }
  if (c.periodStart) return c.periodStart === planned.periodStart;
  return c.competence === planned.competence && (c.cycleIndex ?? 1) === planned.cycleIndex;
}

/**
 * O periodo ja tem mensalidade deste aluno? Vale para QUALQUER plano: nunca duas
 * cobrancas para os mesmos dias. Cancelada pelo usuario so ocupa o periodo no
 * mesmo plano; cancelada pelo sistema libera o periodo.
 */
export function membershipPeriodTaken(
  charges: Charge[],
  studentId: Id,
  planId: Id | undefined,
  period: ChargePeriod,
  exceptChargeId?: Id,
): boolean {
  return charges.some(
    (c) =>
      c.id !== exceptChargeId &&
      c.kind === "membership" &&
      c.studentId === studentId &&
      (c.status !== "canceled" || (c.canceledBy === "user" && c.planId === planId)) &&
      coversPeriod(c, period),
  );
}

/** Status e campos de bolsa da mensalidade planejada. */
export function scholarshipChargeFields(
  student: Pick<Client, "discount"> | undefined,
  planned: Pick<ScheduledCharge, "amountCents" | "discountApplied" | "listAmountCents">,
): Pick<Charge, "status" | "scholarshipPercent" | "listAmountCents"> {
  const discount = student?.discount;
  if (!discount || !planned.discountApplied) return { status: "pending" };
  // Desconto do valor todo (100% ou o preco do plano) e isento, nunca R$ 0 a cobrar.
  if (!discount.scholarship) return { status: planned.amountCents === 0 ? "waived" : "pending" };
  // Bolsa por "valor a pagar" e guardada como valor fixo: a % sai da conta.
  const percent =
    discount.type === "percentage"
      ? discount.value
      : planned.listAmountCents > 0
        ? Math.round(((planned.listAmountCents - planned.amountCents) / planned.listAmountCents) * 100)
        : 100;
  return {
    status: planned.amountCents === 0 ? "waived" : "pending",
    scholarshipPercent: Math.min(100, Math.max(0, percent)),
    listAmountCents: planned.listAmountCents,
  };
}

/** Termos da mensalidade do aluno no plano, com a regra do espaco como padrao. */
export function studentMembershipTerms(student: Client, plan: Plan, settings?: BillingDefaults) {
  return resolveMembershipTerms(
    {
      period: plan.period,
      planPriceCents: plan.priceCents,
      startDate: membershipStartDate(student),
      strategy: student.billingStrategy,
      timing: student.cyclePaymentTiming,
      dueDay: student.dueDay,
      discount: student.discount,
    },
    settings,
  );
}

/** Mensalidade planejada pronta para gravar. */
export function plannedMembershipCharge(
  student: Client | undefined,
  studentId: Id,
  plan: Plan | undefined,
  planned: CompetenceCharge,
  classGroupId?: Id,
): PlannedMembershipCharge {
  return {
    studentId,
    kind: "membership",
    planId: plan?.id,
    classGroupId,
    competence: planned.competence,
    periodStart: planned.periodStart,
    periodEnd: planned.periodEnd,
    dueDate: planned.dueDate,
    amountCents: planned.amountCents,
    ...scholarshipChargeFields(student, planned),
    cycleIndex: planned.cycleIndex,
    cycleTotal: planned.cycleTotal,
    isProrated: planned.isProrated,
    proratedDays: planned.proratedDays,
    notes: planned.isProrated ? `Mensalidade proporcional (${planned.proratedDays} dias)` : undefined,
  };
}

/**
 * Competencias a gerar: todo mes desde o inicio da vigencia mais antiga ate o
 * atual (mes em que ninguem abriu o app tambem gera) e as pedidas, se ja
 * chegaram. Meses futuros aparecem quando chegarem.
 */
export function membershipCompetencesToGenerate(
  world: Pick<MembershipWorld, "clients" | "today">,
  requested: (string | undefined)[] = [],
): string[] {
  const current = world.today.slice(0, 7);
  const wanted = new Set(requested.filter((c): c is string => Boolean(c) && c! <= current));
  let from = current;
  for (const student of world.clients) {
    if (student.status !== "active") continue;
    const start = membershipStartDate(student).slice(0, 7);
    if (start < from) from = start;
  }
  for (let month = parseISO(`${from}-01`); ; month = addMonths(month, 1)) {
    const competence = format(month, "yyyy-MM");
    if (competence > current) break;
    wanted.add(competence);
  }
  return [...wanted].sort();
}

/**
 * Mensalidades que faltam nas competencias, pela regra de cada aluno ativo:
 * plano proprio, bolsista integral sem plano (isenta) e o legado sem plano
 * proprio em turma com plano. Idempotente: considera as existentes e as ja
 * planejadas nesta mesma chamada.
 */
export function planMembershipCharges(world: MembershipWorld, competences: string[]): PlannedMembershipCharge[] {
  const planned: PlannedMembershipCharge[] = [];
  // Existentes + planejadas, para nao planejar o mesmo periodo duas vezes.
  const taken = (studentId: Id, planId: Id | undefined, period: ChargePeriod) =>
    membershipPeriodTaken(world.charges, studentId, planId, period) ||
    planned.some(
      (p) =>
        p.studentId === studentId &&
        coversPeriod({ ...p, id: "", createdAt: "", updatedAt: "" } as Charge, period),
    );
  const planById = new Map(world.plans.map((p) => [p.id, p]));
  const clientById = new Map(world.clients.map((c) => [c.id, c]));
  const groupById = new Map(world.classGroups.map((g) => [g.id, g]));

  for (const competence of competences) {
    for (const student of world.clients) {
      if (student.status !== "active") continue;
      if (student.membershipStatus === "paused" || student.membershipStatus === "canceled") continue;

      if (isPlanlessScholar(student)) {
        const terms = resolveMembershipTerms(
          {
            period: "monthly",
            planPriceCents: 0,
            startDate: membershipStartDate(student),
            strategy: student.billingStrategy,
            timing: student.cyclePaymentTiming,
            dueDay: student.dueDay,
          },
          world.settings,
        );
        const validUntil = student.discount?.validUntil;
        for (const p of chargesDueIn(terms, competence)) {
          if (validUntil && p.periodStart > validUntil) continue;
          if (taken(student.id, undefined, p)) continue;
          planned.push({
            ...plannedMembershipCharge(student, student.id, undefined, p),
            status: "waived",
            scholarshipPercent: 100,
            notes: undefined,
          });
        }
        continue;
      }

      if (!student.planId) continue;
      const plan = planById.get(student.planId);
      if (!plan) continue;
      for (const p of chargesDueIn(studentMembershipTerms(student, plan, world.settings), competence)) {
        if (taken(student.id, plan.id, p)) continue;
        planned.push(plannedMembershipCharge(student, student.id, plan, p));
      }
    }

    // Retrocompatibilidade: aluno sem plano proprio matriculado em turma com
    // plano (dado legado) segue a regra da academia a partir do cadastro.
    for (const e of world.enrollments) {
      if (e.status !== "active") continue;
      const student = clientById.get(e.studentId);
      if (!student || student.planId || isPlanlessScholar(student) || student.status !== "active") continue;
      const turma = groupById.get(e.classGroupId);
      // Curso, turma sem cobranca e quem paga a turma com pacote nunca geram
      // mensalidade pelo plano da turma.
      if (!turma || classBillingMode(turma) !== "membership" || e.paysWithPackage) continue;
      const plan = turma.planId ? planById.get(turma.planId) : undefined;
      if (!plan) continue;
      for (const p of chargesDueIn(studentMembershipTerms(student, plan, world.settings), competence)) {
        if (taken(student.id, plan.id, p)) continue;
        planned.push(plannedMembershipCharge(student, student.id, plan, p, turma.id));
      }
    }
  }
  return planned;
}
