import type { Charge } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billing";
import { createStudent, resetAcademy } from "@/test/academy";

/**
 * Selo "Em atraso" na lista de Alunos (decisao 10A do teste geral, 13/11/2026):
 * so os ids de quem tem cobranca vencida, de qualquer tipo. Hoje nos testes: 22/09/2026.
 */

const TS = "2026-09-01T12:00:00.000Z";
function charge(id: string, studentId: string, over: Partial<Charge>): Charge {
  return {
    id,
    organizationId: store.organization.id,
    unitId: store.unit.id,
    studentId,
    kind: "extra",
    description: "Uniforme",
    competence: "2026-09",
    dueDate: "2026-09-10",
    amountCents: 8000,
    status: "pending",
    createdAt: TS,
    updatedAt: TS,
    ...over,
  } as Charge;
}

beforeEach(() => resetAcademy());

describe("alunos em atraso", () => {
  it("vencida (pendente ou marcada em atraso) entra; a vencer, paga e cancelada nao", async () => {
    const [ana, bia, caio, duda, edu] = await Promise.all(["Ana", "Bia", "Caio", "Duda", "Edu"].map((n) => createStudent(n)));
    store.charges.push(
      charge("c1", ana.id, {}),
      charge("c2", bia.id, { status: "overdue", kind: "course", dueDate: "2026-09-15" }),
      charge("c3", caio.id, { dueDate: "2026-09-30" }),
      charge("c4", duda.id, { status: "paid", paidAt: "2026-09-12T12:00:00.000Z" }),
      charge("c5", edu.id, { status: "canceled" }),
      // Vence hoje: ainda nao esta em atraso.
      charge("c6", edu.id, { dueDate: "2026-09-22" }),
    );
    const ids = await billingService.listOverdueStudentIds();
    expect(new Set(ids)).toEqual(new Set([ana.id, bia.id]));
  });
});
