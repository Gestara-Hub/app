import type { Charge, Client, Id, Plan } from "@gestarahub/contracts";
import { chargesDueIn, resolveMembershipTerms, type CompetenceCharge } from "@gestarahub/core/billing";
import {
  isPlanlessScholar as coreIsPlanlessScholar,
  membershipCompetencesToGenerate,
  membershipPeriodTaken as coreMembershipPeriodTaken,
  membershipStartDate,
  planMembershipCharges,
  plannedMembershipCharge,
  scholarshipChargeFields as coreScholarshipChargeFields,
  type ChargePeriod as CoreChargePeriod,
  type MembershipWorld,
  type PlannedMembershipCharge,
} from "@gestarahub/core/membership-generation";
import { addMonths, format, parseISO } from "date-fns";
import { persist, store } from "@/mocks/store";
import { newId, nowIso } from "@/mocks/helpers";
import { isSupabaseOrganization } from "@/lib/session";
import { generateMembershipChargesAction } from "../membershipBackend";
import { planOf, todayISO } from "./billingHelpers";
import { syncChargesFromDb } from "./billingSync";

type ChargePeriod = CoreChargePeriod;

/** Periodo ja tem mensalidade deste aluno (regra em @gestarahub/core/membership-generation). */
export function membershipPeriodTaken(
  studentId: Id,
  planId: Id | undefined,
  period: ChargePeriod,
  exceptChargeId?: Id,
): boolean {
  return coreMembershipPeriodTaken(store.charges, studentId, planId, period, exceptChargeId);
}

function hasMembershipCharge(studentId: Id, planId: Id | undefined, planned: CompetenceCharge): boolean {
  return membershipPeriodTaken(studentId, planId, planned);
}

/**
 * Bolsa do aluno nesta mensalidade: percentual, valor sem bolsa e status.
 * Bolsa integral (valor final zero) nasce "Isento" (`waived`), nunca pendente.
 */
export const scholarshipChargeFields = coreScholarshipChargeFields;

/** Bolsista integral sem plano: so ele tem mensalidade (isenta) sem plano. */
export const isPlanlessScholar = coreIsPlanlessScholar;

/**
 * Mensalidades "Isento" do bolsista integral sem plano na competencia: mensais,
 * no vencimento dele, sem valor de referencia. Para depois de `validUntil`
 * (sem plano nao ha valor cheio para voltar). Idempotente. Retorna quantas criou.
 */
export function planlessScholarCharges(student: Client, competence: string): number {
  if (!isPlanlessScholar(student) || student.status !== "active") return 0;
  if (student.membershipStatus === "paused" || student.membershipStatus === "canceled") return 0;
  const terms = resolveMembershipTerms(
    {
      period: "monthly",
      planPriceCents: 0,
      startDate: membershipStartDate(student),
      strategy: student.billingStrategy,
      timing: student.cyclePaymentTiming,
      dueDay: student.dueDay,
    },
    store.organization.settings,
  );
  const validUntil = student.discount?.validUntil;
  let created = 0;
  for (const planned of chargesDueIn(terms, competence)) {
    if (validUntil && planned.periodStart > validUntil) continue;
    if (hasMembershipCharge(student.id, undefined, planned)) continue;
    store.charges.push({
      ...membershipCharge(student.id, undefined, planned),
      status: "waived",
      scholarshipPercent: 100,
      notes: undefined,
    });
    created += 1;
  }
  return created;
}

function membershipCharge(
  studentId: Id,
  plan: Plan | undefined,
  planned: CompetenceCharge,
  classGroupId?: Id,
): Charge {
  const student = store.clients.find((c) => c.id === studentId);
  return withRecordFields(plannedMembershipCharge(student, studentId, plan, planned, classGroupId));
}

/** Da mensalidade planejada (core) a cobranca do store: id, organizacao, unidade e datas. */
function withRecordFields(planned: PlannedMembershipCharge): Charge {
  const ts = nowIso();
  return {
    ...planned,
    id: newId(),
    organizationId: store.organization.id,
    unitId: store.unit.id,
    createdAt: ts,
    updatedAt: ts,
  };
}

/** Inicio da vigencia de cobranca do aluno (data local, nao UTC). */

/** Termos de cobranca do aluno: a regra dele prevalece sobre a da academia. */
export function studentMembershipTerms(student: Client, plan: Plan) {
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
    store.organization.settings,
  );
}

/**
 * Cancela as mensalidades em aberto de um aluno cujo periodo comeca a partir
 * de `fromDate` (troca de plano, inativacao). Pagas e ja canceladas ficam como
 * estao. Uso interno de outros services, dentro da propria escrita deles.
 */
export function cancelOpenMembershipCharges(
  studentId: Id,
  fromDate: string,
  note: string,
  /** `replaced`: outra cobranca toma o lugar (troca), nao e perda. */
  opts: { inclusive?: boolean; replaced?: boolean } = {},
): number {
  let count = 0;
  for (const c of store.charges) {
    if (c.kind !== "membership" || c.studentId !== studentId) continue;
    // Isento (bolsa) futuro tambem sai: a regra nova recria o que valer.
    if (c.status !== "pending" && c.status !== "overdue" && c.status !== "waived") continue;
    const start = c.periodStart ?? c.dueDate;
    const affected = opts.inclusive ? start >= fromDate : start > fromDate;
    if (!affected) continue;
    c.status = "canceled";
    c.canceledBy = "system";
    c.replaced = opts.replaced || undefined;
    c.notes = note;
    c.updatedAt = nowIso();
    count += 1;
  }
  return count;
}

/**
 * Garante a mensalidade dos periodos ja iniciados ate `untilDate` que ainda nao
 * foram gerados (ex.: aluno "depois do uso" inativado antes da geracao do mes
 * do vencimento). Olha as competencias de `untilDate` em diante, onde vencem os
 * periodos em uso; o valor e o vencimento vem do motor. Retorna quantas criou.
 */
export function chargeStartedMembershipPeriods(student: Client, untilDate: string): number {
  if (!student.planId) return 0;
  if (student.membershipStatus === "paused" || student.membershipStatus === "canceled") return 0;
  const plan = planOf(student.planId);
  if (!plan) return 0;
  const terms = studentMembershipTerms(student, plan);
  const base = parseISO(`${untilDate.slice(0, 7)}-01`);
  let created = 0;
  // O periodo em uso vence no maximo 2 meses depois (mensal "depois do uso").
  for (let k = 0; k <= 2; k++) {
    const competence = format(addMonths(base, k), "yyyy-MM");
    for (const planned of chargesDueIn(terms, competence)) {
      if (planned.periodStart > untilDate) continue;
      if (hasMembershipCharge(student.id, plan.id, planned)) continue;
      store.charges.push(membershipCharge(student.id, plan, planned));
      created += 1;
    }
  }
  return created;
}


/**
 * Geracao automatica na leitura: todo mes desde o inicio da vigencia mais
 * antiga ate o atual (mes em que ninguem abriu o app tambem gera, e o atraso
 * nao muda com a navegacao) e o mes consultado, se ja chegou. Meses futuros
 * aparecem quando chegarem. Idempotente. Sem auditoria (e o sistema).
 */
export function autoGenerateMembershipCharges(...competences: (string | undefined)[]): number {
  const world = storeMembershipWorld();
  const planned = planMembershipCharges(world, membershipCompetencesToGenerate(world, competences));
  for (const p of planned) store.charges.push(withRecordFields(p));
  if (planned.length > 0) persist();
  return planned.length;
}

/**
 * Garante as mensalidades geradas antes de uma leitura. Conta real: gera no
 * servidor (`generateMembershipChargesAction`) e traz do banco; nunca cria so
 * no navegador, onde a mensalidade nao chegava ao banco (doc 15, fatia 1).
 * Demonstracao: gera no store, como antes. Retorna quantas criou.
 */
export async function ensureMembershipCharges(...competences: (string | undefined)[]): Promise<number> {
  if (isSupabaseOrganization(store.organization.id)) {
    const requested = competences.filter((c): c is string => Boolean(c));
    let created = 0;
    try {
      created = await generateMembershipChargesAction(store.organization.id, requested);
    } catch (err) {
      console.error("[billingService] Erro ao gerar mensalidades no servidor:", err);
    }
    await syncChargesFromDb(store.organization.id);
    return created;
  }
  return autoGenerateMembershipCharges(...competences);
}

/** Gera so a competencia pedida (botao "Gerar cobrancas"). Retorna quantas criou. */
export function generateMembershipChargesFor(competence: string): number {
  const planned = planMembershipCharges(storeMembershipWorld(), [competence]);
  for (const p of planned) store.charges.push(withRecordFields(p));
  return planned.length;
}

/** O store no formato que o planejamento puro recebe. */
function storeMembershipWorld(): MembershipWorld {
  return {
    clients: store.clients,
    plans: store.plans,
    classGroups: store.classGroups,
    enrollments: store.enrollments,
    charges: store.charges,
    settings: store.organization.settings,
    today: todayISO(),
  };
}
