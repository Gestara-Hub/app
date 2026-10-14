import { format, parseISO } from "date-fns";
import { splitInstallments } from "@gestarahub/core/billing";
import { formatCents } from "@gestarahub/core/format";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const shortDate = (iso: string) => format(parseISO(iso), "dd/MM");
const fullDate = (iso: string) => format(parseISO(iso), "dd/MM/yyyy");

/** "a, b e c". */
function joinDates(dates: string[]): string {
  return dates.length <= 1 ? dates.join("") : `${dates.slice(0, -1).join(", ")} e ${dates.at(-1)}`;
}

/**
 * Conta ao vivo das parcelas (cobranca avulsa e curso), pelo mesmo calculo do
 * servico: "3x de R$ 33,34 (a primeira) e R$ 33,33: 10/10, 10/11 e 10/12."
 * A vista (ou dados incompletos) nao tem conta: `null`.
 */
export function installmentsSummary(totalCents: number, installments: number, firstDueDate: string): string | null {
  if (installments < 2 || !Number.isInteger(totalCents) || totalCents < installments) return null;
  if (!DATE_RE.test(firstDueDate) || Number.isNaN(parseISO(firstDueDate).getTime())) return null;
  const parts = splitInstallments(totalCents, installments, firstDueDate);
  const first = parts[0].amountCents;
  const rest = parts[1].amountCents;
  const amounts =
    first === rest
      ? `${installments}x de ${formatCents(rest)}`
      : `${installments}x de ${formatCents(first)} (a primeira) e ${formatCents(rest)}`;
  const dates =
    parts.length <= 4
      ? joinDates(parts.map((p) => shortDate(p.dueDate)))
      : `de ${fullDate(parts[0].dueDate)} a ${fullDate(parts.at(-1)!.dueDate)}`;
  return `${amounts}: ${dates}.`;
}

/**
 * Conta do pagamento (curso e pacote): a vista "À vista: R$ 800,00, vence
 * 15/10." ou a conta das parcelas. Dados incompletos: `null`.
 */
export function paymentSummary(totalCents: number, installments: number, firstDueDate: string): string | null {
  if (installments > 1) return installmentsSummary(totalCents, installments, firstDueDate);
  if (!totalCents || !DATE_RE.test(firstDueDate) || Number.isNaN(parseISO(firstDueDate).getTime())) return null;
  return `À vista: ${formatCents(totalCents)}, vence ${shortDate(firstDueDate)}.`;
}
