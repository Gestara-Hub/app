import { describe, expect, it } from "vitest";
import { monthlyRevenueSummary } from "../revenue-summary";

const charge = (status: string, amountCents: number) => ({ status, amountCents });

describe("cartão Mensalidades recebidas (achado 2)", () => {
  it("o selo e o texto contam as mesmas mensalidades do mês", () => {
    const summary = monthlyRevenueSummary([
      charge("paid", 10000),
      charge("overdue", 20000),
      charge("overdue", 29161),
      charge("pending", 5000),
    ]);
    expect(summary.overdueCount).toBe(2);
    expect(summary.overdueRevenue).toBe(49161);
    expect(summary.revenueHint).toMatch(/491,61\satrasado/);
    expect(summary.paidRevenue).toBe(10000);
  });

  it("sem atraso não há selo, e o texto diz quando tudo está quitado", () => {
    expect(monthlyRevenueSummary([charge("paid", 100)])).toMatchObject({
      overdueCount: 0,
      revenueHint: "Todas as mensalidades quitadas",
    });
    expect(monthlyRevenueSummary([]).revenueHint).toBe("Nenhuma mensalidade gerada no mês");
  });
});
