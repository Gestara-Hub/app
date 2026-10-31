import type { DREStatementReportData } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { reportsService } from "@/services/reports";
import { subscriptionService } from "@/services/subscription/subscriptionService";
import { resetAcademy } from "@/test/academy";

/**
 * DRE x Resumo do Financeiro (revisao de valores, 30/10/2026): os dois contam
 * pelo dia do pagamento. Antes o DRE contava lancamentos pelo vencimento e o
 * repasse dos professores pelo mes trabalhado, e nunca fechava com o Resumo.
 */

const TS = "2026-10-05T15:00:00.000Z";

async function dre(competence: string): Promise<DREStatementReportData> {
  const report = await reportsService.generateReport("financial_income_statement", { competence });
  return report.data as DREStatementReportData;
}

beforeEach(async () => {
  resetAcademy();
  await subscriptionService.setTier("pro");
  const category = store.financialCategories.find((c) => c.type === "expense")!;
  store.financialEntries.push({
    id: "fe-aluguel",
    organizationId: store.organization.id,
    type: "expense",
    categoryId: category.id,
    description: "Aluguel de setembro",
    amountCents: 100000,
    dueDate: "2026-09-30",
    status: "paid",
    paidAt: TS,
    createdAt: TS,
    updatedAt: TS,
  } as never);
  store.teacherPayouts.push({
    id: "tp-set",
    professionalId: "p-x",
    competence: "2026-09",
    totalCents: 50000,
    status: "paid",
    paidAt: TS,
    createdAt: TS,
    updatedAt: TS,
  } as never);
});

describe("DRE pelo dia do pagamento", () => {
  it("despesa e repasse de setembro pagos em 05/10 entram em outubro, não em setembro", async () => {
    const october = await dre("2026-10");
    expect(october.operatingExpensesCents).toBe(150000);
    expect(october.expenseCategories.map((c) => c.name)).toContain("Repasse de Professores");
    const september = await dre("2026-09");
    expect(september.operatingExpensesCents).toBe(0);
  });
});
