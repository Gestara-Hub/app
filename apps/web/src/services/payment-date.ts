import type { DateISO, DateTimeISO } from "@gestarahub/contracts";
import { format, parseISO } from "date-fns";
import { nowIso, validationError } from "@/mocks/helpers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Instante gravado do pagamento a partir do dia informado (data local): hoje,
 * ou sem data, e agora; outro dia vira o meio-dia local daquele dia (o caixa e
 * o fechamento usam o mes da data). Data no futuro nao vale.
 */
export function paidAtFromDate(paidOn?: DateISO): DateTimeISO {
  const today = format(new Date(), "yyyy-MM-dd");
  if (!paidOn || paidOn === today) return nowIso();
  if (!DATE_RE.test(paidOn) || Number.isNaN(parseISO(paidOn).getTime())) {
    throw validationError([{ field: "paidOn", message: "Informe a data do pagamento." }]);
  }
  if (paidOn > today) {
    throw validationError([{ field: "paidOn", message: "A data do pagamento não pode ser futura." }]);
  }
  return new Date(`${paidOn}T12:00:00`).toISOString();
}

/** " em 05/10" quando o pagamento nao e de hoje (texto da auditoria). */
export function paidOnNote(paidOn?: DateISO): string {
  const today = format(new Date(), "yyyy-MM-dd");
  return paidOn && paidOn !== today ? ` em ${format(parseISO(paidOn), "dd/MM/yyyy")}` : "";
}
