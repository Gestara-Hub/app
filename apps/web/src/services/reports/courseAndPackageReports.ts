import type {
Charge,CourseReportData,
CourseReportRow,PackageReportData,
PackageReportRow
} from "@gestarahub/contracts";
import { classBillingMode,isCourseEnded } from "@gestarahub/core/billing";
import { firstDayOfCompetence,lastDayOfCompetence,localDateOf } from "@gestarahub/core/finance";
import { ownLessons,packageState } from "@gestarahub/core/packages";
import { store } from "@/services/world/store";

/**
 * Relatorios de cursos e de pacotes de aulas (valores do curso inteiro e saldo de hoje).
 */

export const OPEN_STATUSES = new Set<Charge["status"]>(["pending", "overdue"]);

export const VOID_STATUSES = new Set<Charge["status"]>(["canceled", "waived"]);

/** Pago no mes (data local do pagamento). */
export function paidIn(charge: Charge, competence: string): boolean {
  return charge.status === "paid" && Boolean(charge.paidAt) && localDateOf(charge.paidAt!).slice(0, 7) === competence;
}

/**
 * Cursos do mes: turmas de curso com aula no mes (inicio ate o fim, ou ate hoje
 * sem fim) ou com parcela vencendo ou paga no mes. Valores do curso inteiro;
 * o recebido no mes vem a parte. So dados reais (sem curso, lista vazia).
 */
export function buildCourseReport(competence: string, today: string): Omit<CourseReportData, "header"> {
  const first = firstDayOfCompetence(competence);
  const last = lastDayOfCompetence(competence);
  const courseCharges = store.charges.filter((c) => c.kind === "course");
  const enrollmentClass = new Map(store.enrollments.map((e) => [e.id, e.classGroupId]));
  const classOf = (c: Charge) => c.classGroupId ?? (c.enrollmentId ? enrollmentClass.get(c.enrollmentId) : undefined);

  const rows: CourseReportRow[] = [];
  let receivedInPeriodCents = 0;
  for (const g of store.classGroups) {
    if (classBillingMode(g) !== "course") continue;
    const charges = courseCharges.filter((c) => classOf(c) === g.id);
    const runsInMonth = g.startDate <= last && (g.endDate ?? today) >= first;
    const chargedInMonth = charges.some((c) => c.dueDate.slice(0, 7) === competence || paidIn(c, competence));
    if (!runsInMonth && !chargedInMonth) continue;

    const enrollments = store.enrollments.filter((e) => e.classGroupId === g.id);
    const valid = enrollments.filter((e) => e.status !== "canceled");
    const ended = isCourseEnded(g, today);
    const sum = (list: Charge[]) => list.reduce((acc, c) => acc + c.amountCents, 0);
    receivedInPeriodCents += sum(charges.filter((c) => paidIn(c, competence)));
    rows.push({
      classGroupId: g.id,
      className: g.name,
      teacherName: store.professionals.find((p) => p.id === g.instructorId)?.name ?? "",
      startDate: g.startDate,
      endDate: g.endDate,
      enrolled: valid.length,
      completed: ended ? valid.filter((e) => e.status === "active").length : 0,
      canceled: enrollments.length - valid.length,
      contractedCents: sum(charges.filter((c) => !VOID_STATUSES.has(c.status))),
      receivedCents: sum(charges.filter((c) => c.status === "paid")),
      openCents: sum(charges.filter((c) => OPEN_STATUSES.has(c.status))),
    });
  }
  rows.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.className.localeCompare(b.className, "pt-BR"));
  return {
    totalContractedCents: rows.reduce((acc, r) => acc + r.contractedCents, 0),
    totalReceivedCents: rows.reduce((acc, r) => acc + r.receivedCents, 0),
    totalOpenCents: rows.reduce((acc, r) => acc + r.openCents, 0),
    receivedInPeriodCents,
    rows,
  };
}

/**
 * Pacotes do mes, um por pacote do catalogo: vendas e aulas compradas no mes
 * (sem as canceladas nem as aulas trazidas), aulas gastas no mes, saldo de
 * hoje e cobrancas pagas no mes. Linha sem nenhum numero nao aparece.
 */
export function buildPackageReport(competence: string, today: string): Omit<PackageReportData, "header"> {
  const rowsById = new Map<string, PackageReportRow>();
  const rowOf = (packageId: string, fallbackName: string): PackageReportRow => {
    let row = rowsById.get(packageId);
    if (!row) {
      row = {
        packageId,
        packageName: store.lessonPackages.find((p) => p.id === packageId)?.name ?? fallbackName,
        sold: 0,
        lessonsSold: 0,
        lessonsUsed: 0,
        lessonsRemaining: 0,
        receivedCents: 0,
      };
      rowsById.set(packageId, row);
    }
    return row;
  };
  const studentPackages = store.studentPackages ?? [];
  const byStudentPackage = new Map(studentPackages.map((p) => [p.id, p]));
  for (const sp of studentPackages) {
    const row = rowOf(sp.packageId, sp.name);
    if (sp.status !== "canceled" && sp.purchasedAt.slice(0, 7) === competence) {
      row.sold += 1;
      row.lessonsSold += ownLessons(sp);
    }
    row.lessonsUsed += sp.usages.filter((u) => u.date.slice(0, 7) === competence).length;
    row.lessonsRemaining += packageState(sp, today).remaining;
  }
  for (const c of store.charges) {
    if (c.kind !== "package" || !c.studentPackageId || !paidIn(c, competence)) continue;
    const sp = byStudentPackage.get(c.studentPackageId);
    if (sp) rowOf(sp.packageId, sp.name).receivedCents += c.amountCents;
  }
  const rows = [...rowsById.values()]
    .filter((r) => r.sold + r.lessonsUsed + r.lessonsRemaining + r.receivedCents > 0)
    .sort((a, b) => a.packageName.localeCompare(b.packageName, "pt-BR"));
  return {
    totalSold: rows.reduce((acc, r) => acc + r.sold, 0),
    totalLessonsUsed: rows.reduce((acc, r) => acc + r.lessonsUsed, 0),
    totalLessonsRemaining: rows.reduce((acc, r) => acc + r.lessonsRemaining, 0),
    totalReceivedCents: rows.reduce((acc, r) => acc + r.receivedCents, 0),
    rows,
  };
}
