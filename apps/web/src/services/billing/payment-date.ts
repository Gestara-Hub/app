import type { DateISO, DateTimeISO } from "@gestarahub/contracts";
import { format, parseISO } from "date-fns";
import { nowIso, validationError } from "@/services/world/ops";
import { dateInSpace } from "@gestarahub/core/date";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Instante gravado do pagamento a partir do dia informado (data local): hoje,
 * ou sem data, e agora; outro dia vira o meio-dia local daquele dia (o caixa e
 * o fechamento usam o mes da data). Data no futuro nao vale.
 */
export function paidAtFromDate(paidOn?: DateISO): DateTimeISO {
  const today = dateInSpace();
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
  const today = dateInSpace();
  return paidOn && paidOn !== today ? ` em ${format(parseISO(paidOn), "dd/MM/yyyy")}` : "";
}

/**
 * Dia da devolucao (doc product/15): padrao hoje, nunca no futuro. Mesmo
 * formato do dia do pagamento.
 */
export function refundedOnDate(refundedOn?: DateISO): DateISO {
  const today = dateInSpace();
  if (!refundedOn) return today;
  if (!DATE_RE.test(refundedOn) || Number.isNaN(parseISO(refundedOn).getTime())) {
    throw validationError([{ field: "refundedOn", message: "Informe a data do estorno." }]);
  }
  if (refundedOn > today) {
    throw validationError([{ field: "refundedOn", message: "A data do estorno não pode ser futura." }]);
  }
  return refundedOn;
}
