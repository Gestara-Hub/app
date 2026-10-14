import type { DREStatementReportData } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { billingService } from "@/services/billingService";
import { reportsService } from "@/services/reportsService";
import { subscriptionService } from "@/services/subscriptionService";
import { createStudent, resetAcademy } from "@/test/academy";

async function incomeStatement(competence: string): Promise<DREStatementReportData> {
  const report = await reportsService.generateReport("financial_income_statement", { competence });
  if (report.type !== "financial_income_statement") throw new Error("relatorio errado");
  return report.data;
}

describe("resultado do mes (DRE)", () => {
  beforeEach(async () => {
    resetAcademy();
    await subscriptionService.setTier("pro");
  });

  it("mes sem lancamento pago sai zerado, sem numeros de exemplo nem taxa estimada", async () => {
    const data = await incomeStatement("2026-09");
    expect(data).toMatchObject({
      grossRevenueCents: 0,
      deductionsCents: 0,
      netRevenueCents: 0,
      operatingExpensesCents: 0,
      operationalResultCents: 0,
      incomeCategories: [],
      expenseCategories: [],
    });
  });

  it("separa as cobrancas avulsas das mensalidades, sem deducao", async () => {
    const s = await createStudent("Ana");
    await billingService.createExtraCharge({
      studentId: s.id,
      description: "Kimono",
      totalCents: 25000,
      firstDueDate: "2026-09-20",
      installments: 1,
    });
    const [charge] = (await billingService.listCharges({ competence: "2026-09", kind: "extra" }));
    await billingService.markPaid(charge.id, "pix");

    const data = await incomeStatement("2026-09");
    expect(data.incomeCategories).toEqual([{ name: "Cobranças Avulsas", amountCents: 25000, percent: 100 }]);
    expect(data).toMatchObject({ grossRevenueCents: 25000, deductionsCents: 0, netRevenueCents: 25000 });
  });
});
