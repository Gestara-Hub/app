import type {
  ApiErrorField,
  Charge,
  ChargeFilter,
  ChargeStatus,
  ChargeView,
  Client,
  CreatePlan,
  Id,
  PaymentMethod,
  Plan,
  PlanFilter,
  UpdatePlan,
} from "@gestarahub/contracts";
import {
  chargesDueIn,
  resolveMembershipTerms,
  type CompetenceCharge,
} from "@gestarahub/core/billing";
import { formatCents, plural } from "@gestarahub/core/format";
import { addMonths, format, parseISO } from "date-fns";
import { store } from "@/mocks/store";
import {
  apiError,
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  textIncludes,
  validationError,
} from "@/mocks/helpers";
import { auditLogService } from "./auditLogService";

/**
 * Modelo 3 (financeiro). Registro/status, sem gateway. As mensalidades seguem
 * as Regras de Cobranca (antecipado/depois do uso x proporcional/mes cheio),
 * calculadas pelo motor unico em @gestarahub/core/billing. Assinatura pausada
 * ou cancelada nao gera cobranca.
 */

function clone<T>(value: T): T {
  return structuredClone(value);
}

function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function studentName(id: Id): string {
  return store.clients.find((c) => c.id === id)?.name ?? "";
}
function planOf(id?: Id): Plan | undefined {
  return id ? store.plans.find((p) => p.id === id) : undefined;
}
function className(id?: Id): string | undefined {
  return id ? store.classGroups.find((t) => t.id === id)?.name : undefined;
}

/** "2026-10" -> "10/2026". */
function competenceLabel(competence: string): string {
  const [year, month] = competence.split("-");
  return `${month}/${year}`;
}

/**
 * Atraso e derivado na leitura: uma cobranca em aberto com vencimento passado
 * esta atrasada hoje, mesmo que tenha sido gravada como pendente.
 */
function effectiveStatus(c: Charge): ChargeStatus {
  if (c.status === "pending" || c.status === "overdue") {
    return c.dueDate < todayISO() ? "overdue" : "pending";
  }
  return c.status;
}

function toChargeView(c: Charge): ChargeView {
  return {
    ...c,
    status: effectiveStatus(c),
    cycleIndex: c.cycleIndex ?? 1,
    cycleTotal: c.cycleTotal ?? 1,
    studentName: studentName(c.studentId),
    planName: planOf(c.planId)?.name,
    planPeriod: planOf(c.planId)?.period,
    className: className(c.classGroupId),
  };
}

function chargeLabel(c: Charge): string {
  const who = studentName(c.studentId);
  return c.kind === "dropin" ? `aula avulsa de ${who}` : `mensalidade de ${who}`;
}

function recordChargeEvent(
  c: Charge,
  action: "status_changed" | "cancelled",
  verb: string,
): void {
  auditLogService.record({
    action,
    target: { type: "charge", id: c.id, label: chargeLabel(c) },
    predicate: `${verb} ${chargeLabel(c)} (${formatCents(c.amountCents)}, vence ${c.dueDate.split("-").reverse().join("/")})`,
  });
}

function validatePlan(payload: Partial<CreatePlan>): void {
  const fields: ApiErrorField[] = [];
  if (!payload.name || !payload.name.trim()) {
    fields.push({ field: "name", message: "Informe o nome do plano." });
  }
  if (payload.priceCents === undefined || payload.priceCents <= 0) {
    fields.push({ field: "priceCents", message: "Informe um valor maior que zero." });
  }
  if (fields.length > 0) throw validationError(fields);
}

/**
 * A cobranca existente ja cobre o periodo planejado? Com periodo completo vale a
 * sobreposicao (depois de mudar a regra os periodos podem nao bater o inicio, e
 * o mesmo dia nunca e cobrado duas vezes); dado antigo compara inicio/competencia.
 */
function coversPeriod(c: Charge, planned: CompetenceCharge): boolean {
  if (c.periodStart && c.periodEnd) {
    return c.periodStart <= planned.periodEnd && c.periodEnd >= planned.periodStart;
  }
  if (c.periodStart) return c.periodStart === planned.periodStart;
  return c.competence === planned.competence && (c.cycleIndex ?? 1) === planned.cycleIndex;
}

/**
 * Ja existe cobranca deste aluno/plano para o periodo planejado? Canceladas nao
 * contam: o periodo cancelado pode ser gerado de novo.
 */
function hasMembershipCharge(studentId: Id, planId: Id, planned: CompetenceCharge): boolean {
  return store.charges.some(
    (c) =>
      c.kind === "membership" &&
      c.studentId === studentId &&
      c.planId === planId &&
      c.status !== "canceled" &&
      coversPeriod(c, planned),
  );
}

/** Alunos ativos no plano (inclui o legado: sem plano proprio, em turma com o plano). */
function activeStudentsInPlan(planId: Id): number {
  const ids = new Set<Id>();
  for (const c of store.clients) {
    if (c.status === "active" && c.planId === planId) ids.add(c.id);
  }
  for (const e of store.enrollments) {
    if (e.status !== "active") continue;
    const turma = store.classGroups.find((t) => t.id === e.classGroupId);
    if (turma?.planId !== planId) continue;
    const student = store.clients.find((c) => c.id === e.studentId);
    if (student && student.status === "active" && !student.planId) ids.add(student.id);
  }
  return ids.size;
}

function membershipCharge(
  studentId: Id,
  plan: Plan,
  planned: CompetenceCharge,
  classGroupId?: Id,
): Charge {
  const ts = nowIso();
  return {
    id: newId(),
    organizationId: store.organization.id,
    unitId: store.unit.id,
    studentId,
    kind: "membership",
    planId: plan.id,
    classGroupId,
    competence: planned.competence,
    periodStart: planned.periodStart,
    periodEnd: planned.periodEnd,
    dueDate: planned.dueDate,
    amountCents: planned.amountCents,
    status: "pending",
    cycleIndex: planned.cycleIndex,
    cycleTotal: planned.cycleTotal,
    isProrated: planned.isProrated,
    proratedDays: planned.proratedDays,
    notes: planned.isProrated ? `Mensalidade proporcional (${planned.proratedDays} dias)` : undefined,
    createdAt: ts,
    updatedAt: ts,
  };
}

/** Termos de cobranca do aluno: a regra dele prevalece sobre a da academia. */
export function studentMembershipTerms(student: Client, plan: Plan) {
  return resolveMembershipTerms(
    {
      period: plan.period,
      planPriceCents: plan.priceCents,
      startDate: student.planStartDate || format(parseISO(student.createdAt), "yyyy-MM-dd"), // data local, nao UTC
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
  opts: { inclusive?: boolean } = {},
): number {
  let count = 0;
  for (const c of store.charges) {
    if (c.kind !== "membership" || c.studentId !== studentId) continue;
    if (c.status !== "pending" && c.status !== "overdue") continue;
    const start = c.periodStart ?? c.dueDate;
    const affected = opts.inclusive ? start >= fromDate : start > fromDate;
    if (!affected) continue;
    c.status = "canceled";
    c.canceledBy = "system";
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

export const billingService = {
  // --- Planos -------------------------------------------------------------
  listPlans(filter?: PlanFilter): Promise<Plan[]> {
    return simulateRead(() => {
      let result = store.plans;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter((p) => textIncludes(p.name, term));
      }
      if (filter?.period) result = result.filter((p) => p.period === filter.period);
      if (filter?.status) result = result.filter((p) => p.status === filter.status);
      return clone(
        [...result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
    });
  },

  createPlan(payload: CreatePlan): Promise<Plan> {
    return simulateWrite(() => {
      validatePlan(payload);
      const ts = nowIso();
      const plan: Plan = {
        ...payload,
        organizationId: store.organization.id,
        period: payload.period || "monthly",
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
      };
      store.plans.push(plan);
      auditLogService.record({
        action: "created",
        target: { type: "plan", id: plan.id, label: plan.name },
        predicate: `criou o plano ${plan.name} (${formatCents(plan.priceCents)})`,
      });
      return clone(plan);
    });
  },

  updatePlan(id: Id, payload: UpdatePlan): Promise<Plan> {
    return simulateWrite(() => {
      const idx = store.plans.findIndex((p) => p.id === id);
      if (idx === -1) throw notFoundError("Plano não encontrado.");
      const before = store.plans[idx];
      validatePlan({ ...before, ...payload });
      // Mudar a periodicidade reinterpretaria os periodos ja cobrados dos alunos.
      if (payload.period && payload.period !== before.period && activeStudentsInPlan(id) > 0) {
        throw validationError([
          {
            field: "period",
            message:
              "Não é possível mudar a periodicidade de um plano com alunos ativos. Crie um novo plano.",
          },
        ]);
      }
      store.plans[idx] = {
        ...before,
        ...payload,
        updatedAt: nowIso(),
      };
      const after = store.plans[idx];
      auditLogService.record({
        action: before.status !== after.status ? (after.status === "active" ? "activated" : "inactivated") : "updated",
        target: { type: "plan", id, label: after.name },
        predicate:
          before.status !== after.status
            ? `${after.status === "active" ? "reativou" : "inativou"} o plano ${after.name}`
            : `atualizou o plano ${after.name}`,
        changes:
          before.priceCents !== after.priceCents
            ? [
                {
                  field: "priceCents",
                  label: "Valor",
                  before: formatCents(before.priceCents),
                  after: formatCents(after.priceCents),
                },
              ]
            : undefined,
      });
      return clone(after);
    });
  },

  // --- Cobrancas (Charges) ------------------------------------------------
  listCharges(filter?: ChargeFilter): Promise<ChargeView[]> {
    return simulateRead(() => {
      let result = store.charges.map(toChargeView);
      if (filter?.competence) {
        result = result.filter((c) => c.competence === filter.competence);
      }
      if (filter?.kind) result = result.filter((c) => c.kind === filter.kind);
      if (filter?.status) result = result.filter((c) => c.status === filter.status);
      if (filter?.studentId) {
        result = result.filter((c) => c.studentId === filter.studentId);
      }
      return clone(
        result.sort(
          (a, b) =>
            a.studentName.localeCompare(b.studentName, "pt-BR") ||
            a.dueDate.localeCompare(b.dueDate),
        ),
      );
    });
  },

  /**
   * Gera as mensalidades que vencem na competencia (`YYYY-MM`) para cada aluno
   * ativo com plano, pela regra de cobranca dele. Idempotente: um periodo de
   * uso nunca gera duas cobrancas (inclusive a 1a, criada no cadastro).
   */
  generateCharges(competence: string): Promise<{ created: number }> {
    return simulateWrite(() => {
      let created = 0;

      for (const student of store.clients) {
        if (student.status !== "active") continue;
        if (student.membershipStatus === "paused" || student.membershipStatus === "canceled") continue;
        if (!student.planId) continue;
        const plan = store.plans.find((p) => p.id === student.planId);
        if (!plan) continue;

        for (const planned of chargesDueIn(studentMembershipTerms(student, plan), competence)) {
          if (hasMembershipCharge(student.id, plan.id, planned)) continue;
          store.charges.push(membershipCharge(student.id, plan, planned));
          created += 1;
        }
      }

      // Retrocompatibilidade: aluno sem plano proprio matriculado em turma com
      // plano (dado legado) segue a regra da academia a partir do cadastro.
      for (const e of store.enrollments) {
        if (e.status !== "active") continue;
        const student = store.clients.find((c) => c.id === e.studentId);
        if (!student || student.planId || student.status !== "active") continue;
        const turma = store.classGroups.find((t) => t.id === e.classGroupId);
        const plan = turma?.planId ? store.plans.find((p) => p.id === turma.planId) : undefined;
        if (!turma || !plan) continue;

        for (const planned of chargesDueIn(studentMembershipTerms(student, plan), competence)) {
          if (hasMembershipCharge(student.id, plan.id, planned)) continue;
          store.charges.push(membershipCharge(student.id, plan, planned, turma.id));
          created += 1;
        }
      }

      if (created > 0) {
        auditLogService.record({
          action: "created",
          target: { type: "charge", label: `Competência ${competenceLabel(competence)}` },
          predicate: `gerou ${plural(created, "mensalidade", "mensalidades")} da competência ${competenceLabel(competence)}`,
        });
      }
      return { created };
    });
  },

  markPaid(id: Id, method?: PaymentMethod): Promise<ChargeView> {
    return simulateWrite(() => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      c.status = "paid";
      c.paidAt = nowIso();
      c.method = method;
      c.updatedAt = nowIso();
      recordChargeEvent(c, "status_changed", "registrou o pagamento da");
      return clone(toChargeView(c));
    });
  },

  // Desfaz o pagamento (volta a ficar em aberto; o atraso e derivado na leitura).
  markPending(id: Id): Promise<ChargeView> {
    return simulateWrite(() => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      c.status = "pending";
      c.paidAt = undefined;
      c.method = undefined;
      c.updatedAt = nowIso();
      recordChargeEvent(c, "status_changed", "desfez o pagamento da");
      return clone(toChargeView(c));
    });
  },

  // Cancela a cobrança (mantém o título no histórico sem compor o total a receber).
  cancelCharge(id: Id): Promise<ChargeView> {
    return simulateWrite(() => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      c.status = "canceled";
      c.canceledBy = "user";
      c.paidAt = undefined;
      c.method = undefined;
      c.updatedAt = nowIso();
      recordChargeEvent(c, "cancelled", "cancelou a");
      return clone(toChargeView(c));
    });
  },

  // Reverte o cancelamento manual da cobrança (volta a ficar em aberto). Cancelada
  // pelo sistema (troca de plano/regra, inativacao, saida da aula) nao reabre:
  // voltaria a cobrar um periodo que o novo arranjo ja cobre.
  reopenCharge(id: Id): Promise<ChargeView> {
    return simulateWrite(() => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      if (c.status !== "canceled") {
        throw apiError("VALIDATION", "Só é possível reabrir uma cobrança cancelada.", { httpStatus: 409 });
      }
      if (c.canceledBy === "system") {
        throw apiError(
          "VALIDATION",
          "Esta cobrança foi cancelada automaticamente pelo sistema e não pode ser reaberta.",
          { httpStatus: 409 },
        );
      }
      c.status = "pending";
      c.canceledBy = undefined;
      c.updatedAt = nowIso();
      recordChargeEvent(c, "status_changed", "reabriu a");
      return clone(toChargeView(c));
    });
  },

  /**
   * Remove as mensalidades em aberto ou canceladas da competencia, para gerar de
   * novo. Pagas nunca sao apagadas (sao registro de recebimento) e aulas
   * avulsas ficam (nao sao recriadas pela geracao).
   */
  clearCharges(competence: string): Promise<{ deleted: number; keptPaid: number }> {
    return simulateWrite(() => {
      const inCompetence = store.charges.filter(
        (c) => c.kind === "membership" && c.competence === competence,
      );
      const keptPaid = inCompetence.filter((c) => c.status === "paid").length;
      const removed = new Set(inCompetence.filter((c) => c.status !== "paid").map((c) => c.id));
      store.charges = store.charges.filter((c) => !removed.has(c.id));
      const deleted = removed.size;
      if (deleted > 0) {
        auditLogService.record({
          action: "deleted",
          target: { type: "charge", label: `Competência ${competenceLabel(competence)}` },
          predicate: `removeu ${plural(deleted, "mensalidade em aberto ou cancelada", "mensalidades em aberto ou canceladas")} da competência ${competenceLabel(competence)}`,
          security: true,
        });
      }
      return { deleted, keptPaid };
    });
  },
};
