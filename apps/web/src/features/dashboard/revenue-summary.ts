import { formatCents } from "@gestarahub/core/format";

interface MonthCharge {
  status: string;
  amountCents: number;
}

/**
 * Cartao "Mensalidades recebidas" do Painel: tudo do mesmo recorte (as
 * mensalidades do mes), para o selo e o texto de baixo nao contarem coisas
 * diferentes (achado 2 do teste de 23/10). O atraso de todos os meses fica nos
 * Lembretes e no Financeiro.
 */
export function monthlyRevenueSummary(charges: readonly MonthCharge[]) {
  const sum = (status: string) =>
    charges.filter((c) => c.status === status).reduce((total, c) => total + c.amountCents, 0);
  const paidRevenue = sum("paid");
  const pendingRevenue = sum("pending");
  const overdueRevenue = sum("overdue");
  const overdueCount = charges.filter((c) => c.status === "overdue").length;
  // "Quitadas" so quando ha mensalidade no mes e nenhuma em aberto (pendente ou atrasada).
  const billedCount = charges.filter((c) => c.status !== "canceled" && c.status !== "waived").length;
  const openParts = [
    pendingRevenue > 0 ? `${formatCents(pendingRevenue)} pendente` : null,
    overdueRevenue > 0 ? `${formatCents(overdueRevenue)} atrasado` : null,
  ].filter(Boolean);
  const revenueHint =
    openParts.length > 0
      ? openParts.join(" · ")
      : billedCount === 0
        ? "Nenhuma mensalidade gerada no mês"
        : "Todas as mensalidades quitadas";
  return { paidRevenue, pendingRevenue, overdueRevenue, overdueCount, revenueHint };
}
