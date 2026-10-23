import type { CreatePlan, Id, Plan, PlanFilter, UpdatePlan } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { store } from "@/services/world/store";
import { newId, notFoundError, nowIso, readOp, writeOp, textIncludes } from "@/services/world/ops";
import { realAccountInBrowser } from "../world/delegate";
import { auditLogService } from "../audit/auditLogService";
import { unwrap } from "../server/action";
import { clone } from "./billingHelpers";
import { validatePlan } from "./billingValidation";
import { createPlanAction, listPlansAction, updatePlanAction } from "./catalogActions";
import { activeStudentsInPlan, periodChangeError, sortByName } from "./planRules";
import { encodeArgs } from "../world/transport";

/**
 * Planos. Conta real: banco pelo servidor (`catalogActions`, doc 15, fatia
 * 2.1). Demonstracao: store.
 */

function isRealAccount(): boolean {
  return realAccountInBrowser();
}

/**
 * Transicao (doc 15, fatia 2): cobrancas, alunos e turmas ainda leem os planos
 * no store. Ate migrarem, a conta real mantem la uma copia. Sai na fatia 4.
 */
function cachePlans(plans: Plan[]): void {
  const ids = new Set(plans.map((p) => p.id));
  store.plans = [...store.plans.filter((p) => !ids.has(p.id)), ...plans];
}

function recordCreated(plan: Plan): void {
  auditLogService.record({
    action: "created",
    target: { type: "plan", id: plan.id, label: plan.name },
    predicate: `criou o plano ${plan.name} (${formatCents(plan.priceCents)})`,
  });
}

function recordUpdated(id: Id, before: Plan, after: Plan): void {
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
}

export const plansService = {
  // --- Planos -------------------------------------------------------------
  listPlans(filter?: PlanFilter): Promise<Plan[]> {
    return readOp(async () => {
      if (isRealAccount()) {
        const plans = await unwrap(listPlansAction(filter));
        if (!filter?.search && !filter?.period && !filter?.status) cachePlans(plans);
        return plans;
      }
      let result = store.plans;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter((p) => textIncludes(p.name, term));
      }
      if (filter?.period) result = result.filter((p) => p.period === filter.period);
      if (filter?.status) result = result.filter((p) => p.status === filter.status);
      return clone(sortByName(result));
    });
  },

  createPlan(payload: CreatePlan): Promise<Plan> {
    return writeOp(async () => {
      if (isRealAccount()) {
        const created = await unwrap(createPlanAction(payload));
        cachePlans([created]);
        recordCreated(created);
        return created;
      }
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
      recordCreated(plan);
      return clone(plan);
    });
  },

  updatePlan(id: Id, payload: UpdatePlan): Promise<Plan> {
    return writeOp(async () => {
      if (isRealAccount()) {
        const { before, after } = await unwrap(updatePlanAction(id, encodeArgs(payload) as typeof payload));
        cachePlans([after]);
        recordUpdated(id, before, after);
        return after;
      }
      const idx = store.plans.findIndex((p) => p.id === id);
      if (idx === -1) throw notFoundError("Plano não encontrado.");
      const before = store.plans[idx];
      validatePlan({ ...before, ...payload });
      // Mudar a periodicidade reinterpretaria os periodos ja cobrados dos alunos.
      if (payload.period && payload.period !== before.period && activeStudentsInPlan(store, id) > 0) {
        throw periodChangeError();
      }
      store.plans[idx] = {
        ...before,
        ...payload,
        updatedAt: nowIso(),
      };
      const after = store.plans[idx];
      recordUpdated(id, before, after);
      return clone(after);
    });
  },
};
