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
  const charges = upcomingCharges(terms, 2).map((c, idx) => {
    const range = `${shortDate(c.periodStart)} a ${shortDate(c.periodEnd)}`;
    const monthName = format(parseISO(c.periodStart), "MMMM", { locale: ptBR });
    const dueOnEnrollment = c.dueDate === start;

    return {
      ...c,
      orderLabel: `${idx + 1}ª mensalidade`,
      dueLabel: dueOnEnrollment
        ? `${shortDate(c.dueDate)} (na matrícula)`
        : shortDate(c.dueDate),
      reference: c.isProrated
        ? `${range} (${c.proratedDays} dias)`
        : midMonthStrategy === "prorated"
          ? `${range} (${monthName})`
          : range,
    };
  });

  const postpaid = billingTiming === "postpaid";
  const recurring =
    midMonthStrategy === "full_cycle"
      ? postpaid
        ? `todo dia ${terms.dueDay}, cobrindo os 30 dias que acabaram de passar`
        : `todo dia ${terms.dueDay}, cobrindo sempre os 30 dias seguintes`
      : postpaid
        ? `todo dia ${terms.dueDay}, referente ao mês que acabou de fechar`
        : `todo dia ${terms.dueDay}, referente ao mês em andamento`;

  return { start, charges, recurring };
}

export function BillingRulesPreview(props: BillingRulesPreviewProps) {
  const result = simulate(props);

  return (
    <div className="rounded-lg bg-muted/40 px-4 py-3" aria-live="polite">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Eye className="size-3.5 shrink-0" />
        <span>
          Simulação: aluno matriculado em{" "}
          <strong className="font-semibold text-foreground">{shortDate(result.start)}</strong> no
          plano de{" "}
          <strong className="font-semibold text-foreground">
            {formatCents(EXAMPLE_PRICE_CENTS)}
          </strong>
        </span>
      </p>

      <div className="mt-2.5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 text-[11px] font-medium text-muted-foreground/75">
              <th className="pb-1.5 pr-3 text-left font-medium">Cobrança</th>
              <th className="pb-1.5 pr-3 text-left font-medium">Vencimento</th>
              <th className="pb-1.5 pr-3 text-left font-medium">Valor</th>
              <th className="pb-1.5 text-right font-medium">Período de aulas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {result.charges.map((charge) => (
              <tr key={charge.periodStart}>
                <td className="whitespace-nowrap py-1.5 pr-3 text-xs font-medium text-muted-foreground">
                  {charge.orderLabel}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums text-muted-foreground">
                  {charge.dueLabel}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3 font-semibold tabular-nums text-foreground">
                  {formatCents(charge.amountCents)}
                </td>
                <td className="whitespace-nowrap py-1.5 text-right tabular-nums text-muted-foreground">
                  {charge.reference}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 border-t border-border/40 pt-2 text-xs text-muted-foreground">
        Nos meses seguintes:{" "}
        <strong className="font-medium text-foreground">
          {formatCents(EXAMPLE_PRICE_CENTS)} {result.recurring}
        </strong>
        .
      </p>
    </div>
  );
}
