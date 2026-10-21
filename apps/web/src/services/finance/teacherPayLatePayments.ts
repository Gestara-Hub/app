import type { Charge, Id, TeacherPayout, TeacherPayoutLine, TeacherPayRule } from "@gestarahub/contracts";
import {
  competenceOf,
  localDateOf,
  percentPayoutLines,
  type TeacherPayFacts,
} from "@gestarahub/core/finance";
import { store } from "@/services/world/store";
import {
  chargeCompetence,
  paidCourseInstallmentsIn,
  paidMembershipsIn,
  percentFactsOf,
} from "./teacherPayFacts";
import { closedPayoutsOf, competenceLabel, nextCompetence } from "./teacherPayHelpers";

/**
 * Cobranca de um mes ja fechado que ficou fora do fechamento (paga depois
 * dele). Fechamento antigo, sem a lista, compara a data do pagamento.
 */
export function missedByClosure(c: Charge, record: TeacherPayout, counted: Set<Id>): boolean {
  if (counted.has(c.id)) return false;
  if (record.countedChargeIds) return true;
  return Boolean(c.paidAt && record.closedAt && c.paidAt > record.closedAt);
}

/**
 * Pagas depois do fechamento: mensalidade ou parcela de curso de um mes ja
 * fechado do professor conta uma vez, no primeiro mes aberto dele a partir do
 * pagamento, com a atribuicao (turmas e titulares) do mes de origem.
 */
export function latePaymentShare(
  professionalId: Id,
  rule: TeacherPayRule,
  competence: string,
): { lines: TeacherPayoutLine[]; chargeIds: Id[] } {
  const out = { lines: [] as TeacherPayoutLine[], chargeIds: [] as Id[] };
  const percentComponents = rule.components.filter((c) => c.kind === "percent_of_memberships");
  const closed = closedPayoutsOf(professionalId).sort((a, b) => a.competence.localeCompare(b.competence));
  if (percentComponents.length === 0 || closed.length === 0) return out;
  const closedCompetences = new Set(closed.map((p) => p.competence));
  const counted = new Set(closed.flatMap((p) => p.countedChargeIds ?? []));
  const firstOpenFrom = (from: string) => {
    let c = from;
    while (closedCompetences.has(c)) c = nextCompetence(c);
    return c;
  };
  for (const record of closed) {
    if (record.competence >= competence) continue;
    const afterRecord = nextCompetence(record.competence);
    const late = new Set(
      store.charges
        .filter(
          (c) =>
            (c.kind === "membership" || c.kind === "course") &&
            c.status === "paid" &&
            chargeCompetence(c) === record.competence &&
            missedByClosure(c, record, counted),
        )
        .filter((c) => {
          const paidIn = c.paidAt ? competenceOf(localDateOf(c.paidAt)) : competence;
          return firstOpenFrom(paidIn > afterRecord ? paidIn : afterRecord) === competence;
        })
        .map((c) => c.id),
    );
    if (late.size === 0) continue;
    const base = percentFactsOf(record.competence);
    const facts: TeacherPayFacts = {
      ...base,
      professionalId,
      paidMemberships: paidMembershipsIn(record.competence).filter((m) => late.has(m.chargeId)),
      paidCourseInstallments: paidCourseInstallmentsIn(record.competence).filter((c) => late.has(c.chargeId)),
    };
    for (const component of percentComponents) {
      for (const line of percentPayoutLines(component, facts)) {
        if (!line.baseCents) continue;
        out.lines.push({ ...line, label: `Pagos com atraso de ${competenceLabel(record.competence)}: ${line.label}` });
      }
    }
    out.chargeIds.push(...late);
  }
  return out;
}
