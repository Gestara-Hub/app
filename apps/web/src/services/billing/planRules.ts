import type { ClassGroup, Client, Enrollment, Id, Plan } from "@gestarahub/contracts";
import { classBillingMode } from "@gestarahub/core/billing";
import { validationError } from "@gestarahub/core/api-error";

/** Regras de planos sem store nem banco (doc 15, fatia 2.1). */

export interface PlanStudentsWorld {
  clients: Pick<Client, "id" | "status" | "planId">[];
  enrollments: Pick<Enrollment, "status" | "classGroupId" | "studentId" | "paysWithPackage">[];
  classGroups: Pick<ClassGroup, "id" | "planId" | "billingMode">[];
}

/** Alunos ativos no plano (inclui o legado: sem plano proprio, em turma com o plano). */
export function activeStudentsInPlan(world: PlanStudentsWorld, planId: Id): number {
  const ids = new Set<Id>();
  for (const c of world.clients) {
    if (c.status === "active" && c.planId === planId) ids.add(c.id);
  }
  for (const e of world.enrollments) {
    if (e.status !== "active") continue;
    const turma = world.classGroups.find((t) => t.id === e.classGroupId);
    if (!turma || turma.planId !== planId || classBillingMode(turma) !== "membership" || e.paysWithPackage) continue;
    const student = world.clients.find((c) => c.id === e.studentId);
    if (student && student.status === "active" && !student.planId) ids.add(student.id);
  }
  return ids.size;
}

/** Mudar a periodicidade reinterpretaria os periodos ja cobrados dos alunos. */
export function periodChangeError() {
  return validationError([
    {
      field: "period",
      message: "Não é possível mudar a periodicidade de um plano com alunos ativos. Crie um novo plano.",
    },
  ]);
}

export function sortByName<T extends Pick<Plan, "name">>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
