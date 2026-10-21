import type { CreatePlan, Id, Plan, PlanFilter, UpdatePlan } from "@gestarahub/contracts";
import { classBillingMode } from "@gestarahub/core/billing";
import { formatCents } from "@gestarahub/core/format";
import { store } from "@/mocks/store";
import { newId, notFoundError, nowIso, simulateRead, simulateWrite, textIncludes, validationError } from "@/mocks/helpers";
import { isSupabaseOrganization } from "@/lib/session";
import { auditLogService } from "../auditLogService";
import { createPlanInDb, updatePlanInDb } from "../billingBackend";
import { clone } from "./billingHelpers";
import { syncPlansFromDb } from "./billingSync";
import { validatePlan } from "./billingValidation";

/** Alunos ativos no plano (inclui o legado: sem plano proprio, em turma com o plano). */
function activeStudentsInPlan(planId: Id): number {
  const ids = new Set<Id>();
  for (const c of store.clients) {
    if (c.status === "active" && c.planId === planId) ids.add(c.id);
  }
  for (const e of store.enrollments) {
    if (e.status !== "active") continue;
    const turma = store.classGroups.find((t) => t.id === e.classGroupId);
    if (!turma || turma.planId !== planId || classBillingMode(turma) !== "membership" || e.paysWithPackage) continue;
    const student = store.clients.find((c) => c.id === e.studentId);
    if (student && student.status === "active" && !student.planId) ids.add(student.id);
  }
  return ids.size;
}

export const plansService = {
  // --- Planos -------------------------------------------------------------
  listPlans(filter?: PlanFilter): Promise<Plan[]> {
    return simulateRead(async () => {
      await syncPlansFromDb(store.organization.id);
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
    return simulateWrite(async () => {
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
      if (isSupabaseOrganization(store.organization.id)) {
        await createPlanInDb(plan);
      }
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
    return simulateWrite(async () => {
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
      if (isSupabaseOrganization(store.organization.id)) {
        await updatePlanInDb(id, payload, store.organization.id);
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
};
