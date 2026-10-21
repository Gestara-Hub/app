import type { Charge, ChargeStatus, ChargeView, Id, StudentPackage, StudentPackageView } from "@gestarahub/contracts";
import { describeCharge } from "@gestarahub/core/billing";
import { formatCents } from "@gestarahub/core/format";
import { packageState } from "@gestarahub/core/packages";
import { store } from "@/mocks/store";
import { auditLogService } from "../auditLogService";
import { className, planOf, studentName, todayISO } from "./billingHelpers";

/**
 * Atraso e derivado na leitura: uma cobranca em aberto com vencimento passado
 * esta atrasada hoje, mesmo que tenha sido gravada como pendente.
 */
function effectiveStatus(c: Charge): ChargeStatus {
  if (c.status === "pending" || c.status === "overdue") {
    return c.dueDate < todayISO() ? "overdue" : "pending";
  }
  return c.status;
}

/**
 * Fechamento de professor em que a cobranca paga ja entrou no % (competencia).
 * Fechamento antigo, sem a lista, vale pelo mes do periodo e pela data.
 */
function teacherPayClosedIn(c: Charge): string | undefined {
  if (c.status !== "paid" || (c.kind !== "membership" && c.kind !== "course")) return undefined;
  const competence = (c.periodStart ?? c.competence ?? "").slice(0, 7);
  const payout = (store.teacherPayouts ?? []).find(
    (p) =>
      p.status !== "open" &&
      (p.countedChargeIds
        ? p.countedChargeIds.includes(c.id)
        : p.competence === competence && Boolean(c.paidAt && p.closedAt && c.paidAt <= p.closedAt)),
  );
  return payout?.competence;
}

export function toChargeView(c: Charge): ChargeView {
  return {
    ...c,
    teacherPayClosedIn: teacherPayClosedIn(c),
    status: effectiveStatus(c),
    cycleIndex: c.cycleIndex ?? 1,
    cycleTotal: c.cycleTotal ?? 1,
    studentName: studentName(c.studentId),
    studentPhone: store.clients.find((s) => s.id === c.studentId)?.phone || undefined,
    // Bolsista integral sem plano: rotulo proprio, sempre mensal.
    planName: planOf(c.planId)?.name ?? (!c.planId && c.scholarshipPercent ? "Bolsa integral" : undefined),
    planPeriod: planOf(c.planId)?.period ?? (!c.planId && c.scholarshipPercent ? "monthly" : undefined),
    className: className(c.classGroupId),
  };
}

function chargeLabel(c: Charge): string {
  return describeCharge(c, studentName(c.studentId));
}

export function recordChargeEvent(
  c: Charge,
  action: "status_changed" | "cancelled",
  verb: string,
  reason?: string,
): void {
  auditLogService.record({
    action,
    target: { type: "charge", id: c.id, label: chargeLabel(c) },
    predicate: `${verb} ${chargeLabel(c)} (${formatCents(c.amountCents)}, vence ${c.dueDate.split("-").reverse().join("/")})${reason ? `: ${reason}` : ""}`,
  });
}

/**
 * Pacote de aulas (doc 20, fase C). Catalogo do espaco (`LessonPackage`),
 * venda ao aluno (`StudentPackage` + cobrancas "package") e o gasto de aula
 * na chamada. As regras puras (saldo, validade, qual pacote paga a aula,
 * renovacao) ficam em @gestarahub/core/packages.
 */

function modalityNames(ids: Id[]): string[] {
  return ids
    .map((id) => store.categories.find((c) => c.id === id)?.name)
    .filter((name): name is string => Boolean(name));
}

function classNames(ids: Id[] | undefined): string[] {
  return (ids ?? [])
    .map((id) => store.classGroups.find((g) => g.id === id)?.name)
    .filter((name): name is string => Boolean(name));
}

export function toView(p: StudentPackage): StudentPackageView {
  return {
    ...p,
    studentName: studentName(p.studentId),
    ...packageState(p, todayISO()),
    modalityNames: modalityNames(p.modalityIds),
    classNames: classNames(p.classGroupIds),
  };
}
