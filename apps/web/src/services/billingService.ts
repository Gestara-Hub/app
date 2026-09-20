import type {
  ApiErrorField,
  Charge,
  ChargeFilter,
  ChargeView,
  CreatePlan,
  Id,
  PaymentMethod,
  Plan,
  PlanFilter,
  UpdatePlan,
} from "@gestarahub/contracts";
import { format } from "date-fns";
import { store } from "@/mocks/store";
import {
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  textIncludes,
  validationError,
} from "@/mocks/helpers";

/**
 * Modelo 3 — Fatia 2 (financeiro). Registro/status, sem gateway. Turma fixa gera
 * mensalidade (plano da turma) por competencia; cobranca CHEIA; matricula
 * pausada/cancelada nao gera.
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
function planName(id?: Id): string | undefined {
  return id ? store.plans.find((p) => p.id === id)?.name : undefined;
}
function className(id?: Id): string | undefined {
  return id ? store.classGroups.find((t) => t.id === id)?.name : undefined;
}

function getCycleDueDate(
  competence: string,
  dueDay: number,
  cycle: number,
  totalCycles: number,
): string {
  if (totalCycles === 1) {
    const pad = String(Math.min(Math.max(dueDay, 1), 31)).padStart(2, "0");
    return `${competence}-${pad}`;
  }
  if (totalCycles === 2) {
    // Quinzenal: dia dueDay (até 15) e dia + 15
    const base = Math.min(Math.max(dueDay, 1), 15);
    const day = cycle === 1 ? base : Math.min(base + 15, 28);
    const pad = String(day).padStart(2, "0");
    return `${competence}-${pad}`;
  }
  // Semanal: 4 ciclos no mês, espaçados em 7 dias
  const baseDay = Math.min(Math.max(dueDay % 7 || 7, 1), 7);
  const day = baseDay + (cycle - 1) * 7;
  const pad = String(Math.min(day, 28)).padStart(2, "0");
  return `${competence}-${pad}`;
}

function toChargeView(c: Charge): ChargeView {
  const plan = c.planId ? store.plans.find((p) => p.id === c.planId) : undefined;
  const inferredTotal =
    c.cycleTotal ??
    (plan
      ? plan.period === "weekly"
        ? 4
        : plan.period === "biweekly"
          ? 2
          : 1
      : 1);
  const inferredIndex = c.cycleIndex ?? 1;

  return {
    ...c,
    cycleIndex: inferredIndex,
    cycleTotal: inferredTotal,
    studentName: studentName(c.studentId),
    planName: planName(c.planId),
    className: className(c.classGroupId),
  };
}

function validatePlan(payload: Partial<CreatePlan>): void {
  const fields: ApiErrorField[] = [];
  if (!payload.name || !payload.name.trim()) {
    fields.push({ field: "name", message: "Informe o nome do plano." });
  }
  if (payload.priceCents === undefined || payload.priceCents < 0) {
    fields.push({ field: "priceCents", message: "Informe um valor válido." });
  }
  if (fields.length > 0) throw validationError(fields);
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
        period: payload.period || "monthly",
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
      };
      store.plans.push(plan);
      return clone(plan);
    });
  },

  updatePlan(id: Id, payload: UpdatePlan): Promise<Plan> {
    return simulateWrite(() => {
      const idx = store.plans.findIndex((p) => p.id === id);
      if (idx === -1) throw notFoundError("Plano não encontrado.");
      validatePlan({ ...store.plans[idx], ...payload });
      store.plans[idx] = {
        ...store.plans[idx],
        ...payload,
        updatedAt: nowIso(),
      };
      return clone(store.plans[idx]);
    });
  },

  // --- Cobrancas (Charges) ------------------------------------------------
  listCharges(filter?: ChargeFilter): Promise<ChargeView[]> {
    return simulateRead(() => {
      let result = store.charges;
      if (filter?.competence) {
        result = result.filter((c) => c.competence === filter.competence);
      }
      if (filter?.kind) result = result.filter((c) => c.kind === filter.kind);
      if (filter?.status) result = result.filter((c) => c.status === filter.status);
      if (filter?.studentId) {
        result = result.filter((c) => c.studentId === filter.studentId);
      }
      return clone(
        [...result]
          .map(toChargeView)
          .sort((a, b) => a.studentName.localeCompare(b.studentName, "pt-BR")),
      );
    });
  },

  /**
   * Gera as mensalidades de uma competencia (`YYYY-MM`): uma cobranca por
   * aluno ativo com plano contratado (calculando desconto e dia de vencimento
   * individual). Idempotente (uma fatura por aluno x competencia).
   */
  generateCharges(competence: string): Promise<{ created: number }> {
    return simulateWrite(() => {
      const today = todayISO();
      const defaultDay = store.organization.settings?.defaultDueDay ?? 10;
      let created = 0;

      // 1. Gera cobrança para alunos que possuem plano associado diretamente
      for (const student of store.clients) {
        if (student.status !== "active") continue;
        if (student.membershipStatus === "paused" || student.membershipStatus === "canceled") continue;
        if (!student.planId) continue;

        // Data de ingresso/matrícula do aluno
        const studentJoinDate = student.createdAt ? student.createdAt.slice(0, 10) : today;
        const studentJoinMonth = studentJoinDate.slice(0, 7);

        // Se o aluno ingressou em um mês futuro em relação à competência, não é cobrado neste mês
        if (studentJoinMonth > competence) continue;

        const isJoinMonth = studentJoinMonth === competence;

        const plan = store.plans.find((p) => p.id === student.planId);
        if (!plan) continue;

        const period = plan.period || "monthly";
        const totalCycles = period === "weekly" ? 4 : period === "biweekly" ? 2 : 1;

        let amountCents = plan.priceCents;
        if (student.discount && student.discount.value > 0) {
          if (student.discount.type === "fixed") {
            amountCents = Math.max(0, amountCents - student.discount.value);
          } else if (student.discount.type === "percentage") {
            const discountAmount = Math.round((amountCents * student.discount.value) / 100);
            amountCents = Math.max(0, amountCents - discountAmount);
          }
        }

        const dueDay = student.dueDay ?? defaultDay;

        for (let cycle = 1; cycle <= totalCycles; cycle++) {
          let dueDate = getCycleDueDate(competence, dueDay, cycle, totalCycles);

          // No mês de ingresso do aluno:
          if (isJoinMonth) {
            // Ciclos semanais/quinzenais anteriores à matrícula não são gerados
            if (totalCycles > 1 && dueDate < studentJoinDate) {
              continue;
            }
            // Para plano mensal: se a data padrão já passou da matrícula, o 1º vencimento é ajustado para a data da matrícula
            if (totalCycles === 1 && dueDate < studentJoinDate) {
              dueDate = studentJoinDate;
            }
          }

          const exists = store.charges.some(
            (c) =>
              c.kind === "membership" &&
              c.studentId === student.id &&
              c.competence === competence &&
              (c.cycleIndex === cycle || (totalCycles === 1 && !c.cycleIndex)),
          );
          if (exists) continue;

          // Se existe cobrança legada de 1 ciclo sem cycleIndex, migra ela para o ciclo 1
          if (cycle === 1 && totalCycles > 1) {
            const legacy = store.charges.find(
              (c) =>
                c.kind === "membership" &&
                c.studentId === student.id &&
                c.competence === competence &&
                !c.cycleIndex,
            );
            if (legacy) {
              legacy.cycleIndex = 1;
              legacy.cycleTotal = totalCycles;
              continue;
            }
          }

          const ts = nowIso();

          store.charges.push({
            id: newId(),
            organizationId: store.organization.id,
            studentId: student.id,
            kind: "membership",
            planId: plan.id,
            competence,
            dueDate,
            amountCents,
            status: dueDate < today ? "overdue" : "pending",
            cycleIndex: cycle,
            cycleTotal: totalCycles,
            createdAt: ts,
            updatedAt: ts,
          });
          created += 1;
        }
      }

      // 2. Fallback de retrocompatibilidade: alunos matriculados em turmas com planId antigo
      for (const e of store.enrollments) {
        if (e.status !== "active") continue;
        const student = store.clients.find((c) => c.id === e.studentId);
        if (!student || student.planId) continue; // Já tratado acima se tiver plano direto

        const studentJoinDate = student.createdAt ? student.createdAt.slice(0, 10) : today;
        const studentJoinMonth = studentJoinDate.slice(0, 7);
        if (studentJoinMonth > competence) continue;
        const isJoinMonth = studentJoinMonth === competence;

        const turma = store.classGroups.find((t) => t.id === e.classGroupId);
        if (!turma || !turma.planId) continue;

        const plan = store.plans.find((p) => p.id === turma.planId);
        if (!plan) continue;

        const period = plan.period || "monthly";
        const totalCycles = period === "weekly" ? 4 : period === "biweekly" ? 2 : 1;

        for (let cycle = 1; cycle <= totalCycles; cycle++) {
          let dueDate = getCycleDueDate(competence, 10, cycle, totalCycles);

          if (isJoinMonth) {
            if (totalCycles > 1 && dueDate < studentJoinDate) {
              continue;
            }
            if (totalCycles === 1 && dueDate < studentJoinDate) {
              dueDate = studentJoinDate;
            }
          }

          const exists = store.charges.some(
            (c) =>
              c.kind === "membership" &&
              c.studentId === e.studentId &&
              c.competence === competence &&
              (c.cycleIndex === cycle || (totalCycles === 1 && !c.cycleIndex)),
          );
          if (exists) continue;

          const ts = nowIso();

          store.charges.push({
            id: newId(),
            organizationId: store.organization.id,
            studentId: e.studentId,
            kind: "membership",
            planId: plan.id,
            classGroupId: turma.id,
            competence,
            dueDate,
            amountCents: plan.priceCents,
            status: dueDate < today ? "overdue" : "pending",
            cycleIndex: cycle,
            cycleTotal: totalCycles,
            createdAt: ts,
            updatedAt: ts,
          });
          created += 1;
        }
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
      return clone(toChargeView(c));
    });
  },

  // Desfaz o pagamento (volta a pendente/atrasado conforme o vencimento).
  markPending(id: Id): Promise<ChargeView> {
    return simulateWrite(() => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      c.status = c.dueDate < todayISO() ? "overdue" : "pending";
      c.paidAt = undefined;
      c.method = undefined;
      c.updatedAt = nowIso();
      return clone(toChargeView(c));
    });
  },

  // Cancela a cobrança (mantém o título no histórico sem compor o total a receber).
  cancelCharge(id: Id): Promise<ChargeView> {
    return simulateWrite(() => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      c.status = "canceled";
      c.paidAt = undefined;
      c.method = undefined;
      c.updatedAt = nowIso();
      return clone(toChargeView(c));
    });
  },

  // Reverte o cancelamento da cobrança (restaura para pendente ou atrasado conforme vencimento).
  reopenCharge(id: Id): Promise<ChargeView> {
    return simulateWrite(() => {
      const c = store.charges.find((x) => x.id === id);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      c.status = c.dueDate < todayISO() ? "overdue" : "pending";
      c.updatedAt = nowIso();
      return clone(toChargeView(c));
    });
  },

  // Limpa cobranças da competência selecionada (para fins de teste/regeração).
  clearCharges(competence?: string): Promise<{ deleted: number }> {
    return simulateWrite(() => {
      const initialCount = store.charges.length;
      if (competence) {
        store.charges = store.charges.filter((c) => c.competence !== competence);
      } else {
        store.charges = [];
      }
      return { deleted: initialCount - store.charges.length };
    });
  },
};

