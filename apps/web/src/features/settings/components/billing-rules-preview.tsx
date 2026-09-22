"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye } from "lucide-react";
import { dayInMonth, resolveMembershipTerms, upcomingCharges } from "@gestarahub/core/billing";
import { formatCents } from "@gestarahub/core/format";

const EXAMPLE_PRICE_CENTS = 15000;
const EXAMPLE_START_DAY = 20;

interface BillingRulesPreviewProps {
  billingTiming: "prepaid" | "postpaid";
  midMonthStrategy: "prorated" | "full_cycle";
  defaultDueDay: number;
}

const shortDate = (iso: string) => format(parseISO(iso), "dd/MM");

/**
 * Simula as duas primeiras cobrancas de um aluno que entra no dia 20 do mes
 * corrente, com o mesmo motor usado no cadastro e na geracao em lote.
 */
function simulate({ billingTiming, midMonthStrategy, defaultDueDay }: BillingRulesPreviewProps) {
  const start = format(dayInMonth(new Date(), EXAMPLE_START_DAY), "yyyy-MM-dd");
  const terms = resolveMembershipTerms(
    { planPriceCents: EXAMPLE_PRICE_CENTS, startDate: start },
    { billingTiming, midMonthStrategy, defaultDueDay },
  );
  const charges = upcomingCharges(terms, 2).map((c) => ({
    ...c,
    reference: c.isProrated
      ? `${c.periodStart.slice(8)} a ${shortDate(c.periodEnd)} (${c.proratedDays} dias)`
      : midMonthStrategy === "prorated"
        ? format(parseISO(c.periodStart), "MMMM", { locale: ptBR })
        : `${shortDate(c.periodStart)} a ${shortDate(c.periodEnd)}`,
  }));
  const postpaid = billingTiming === "postpaid";
  const recurring =
    midMonthStrategy === "full_cycle"
      ? `todo dia ${terms.dueDay}, ${postpaid ? "pelo ciclo anterior" : "pelo ciclo seguinte"}`
      : `todo dia ${terms.dueDay}, ${postpaid ? "pelo mês anterior" : "pelo mês corrente"}`;
  return { start, charges, recurring };
}

export function BillingRulesPreview(props: BillingRulesPreviewProps) {
  const result = simulate(props);

  return (
    <div className="rounded-lg bg-muted/40 px-4 py-3" aria-live="polite">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Eye className="size-3.5" />
        Na prática: aluno entra em {shortDate(result.start)}, plano de{" "}
        {formatCents(EXAMPLE_PRICE_CENTS)}
      </p>
      <table className="mt-2.5 w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th>Vencimento</th>
            <th>Valor</th>
            <th>Referente a</th>
          </tr>
        </thead>
        <tbody>
          {result.charges.map((charge) => (
            <tr key={charge.periodStart}>
              <td className="w-px whitespace-nowrap py-0.5 pr-4 tabular-nums text-muted-foreground">
                {shortDate(charge.dueDate)}
              </td>
              <td className="w-px whitespace-nowrap py-0.5 pr-4 font-medium tabular-nums text-foreground">
                {formatCents(charge.amountCents)}
              </td>
              <td className="py-0.5 text-right text-muted-foreground">{charge.reference}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 border-t border-border/40 pt-2 text-xs text-muted-foreground">
        Depois: {formatCents(EXAMPLE_PRICE_CENTS)} {result.recurring}.
      </p>
    </div>
  );
}
