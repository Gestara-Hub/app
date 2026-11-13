import type { Charge, ClassGroup, Client, Enrollment, EnrollmentCourseChoice, Id } from "@gestarahub/contracts";
import { classBillingMode, splitInstallments } from "@gestarahub/core/billing";
import { formatCents } from "@gestarahub/core/format";
import { withKind } from "@/lib/text";
import { newId, nowIso, validationError } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { auditLogService } from "../audit/auditLogService";
import { hasUsablePackage } from "../billing";
import { todayISO, studentName } from "./classShared";

/**
 * Matricula ativa + parcelas do curso (se for curso), com auditoria. Unica
 * escrita de matricula: matricular e promover da lista de espera passam aqui.
 */
export async function createEnrollment(
  g: ClassGroup,
  studentId: Id,
  course?: EnrollmentCourseChoice,
  paysWithPackage?: boolean,
  /** Mudar de turma grava a propria linha na Auditoria ("mudou ... de ... para ..."). */
  opts: { skipAudit?: boolean } = {},
): Promise<Enrollment> {
  const ts = nowIso();
  const enrollment: Enrollment = {
    id: newId(),
    classGroupId: g.id,
    studentId,
    status: "active",
    enrolledAt: ts,
    ...(paysWithPackage ? { paysWithPackage: true } : {}),
  };
  const name = studentName(studentId);
  if (course) {
    const installmentGroupId = newId();
    enrollment.course = { ...course, installmentGroupId };
    const parts = splitInstallments(course.priceCents, course.installments, course.firstDueDate);
    const courseCharges = parts.map(
      (part): Charge => ({
        id: newId(),
        organizationId: store.organization.id,
        unitId: g.unitId,
        studentId,
        kind: "course",
        classGroupId: g.id,
        enrollmentId: enrollment.id,
        description: g.name,
        installmentGroupId,
        competence: part.dueDate.slice(0, 7),
        dueDate: part.dueDate,
        amountCents: part.amountCents,
        status: "pending",
        cycleIndex: part.index,
        cycleTotal: part.total,
        createdAt: ts,
        updatedAt: ts,
      }),
    );
    store.charges.push(...courseCharges);
  }
  store.enrollments.push(enrollment);
  if (opts.skipAudit) return enrollment;
  auditLogService.record({
    action: "created",
    target: { type: "enrollment", id: enrollment.id, label: `${name} em ${g.name}` },
    predicate: course
      ? `matriculou ${name} no ${withKind("curso", g.name)} (${formatCents(course.priceCents)}${course.installments > 1 ? `, em ${course.installments} parcelas` : ""})`
      : `matriculou ${name} na turma ${g.name}${paysWithPackage ? " (paga com pacote)" : ""}`,
  });
  return enrollment;
}

/**
 * Pagar com pacote na turma de mensalidade (doc 20): so nela, e o aluno
 * precisa ter pacote com aulas para a modalidade hoje. Nas demais formas a
 * turma ja decide (pacote gasta sempre; curso e sem cobranca nunca).
 */
export function resolvePaysWithPackage(g: ClassGroup, studentId: Id, paysWithPackage?: boolean): boolean {
  if (!paysWithPackage || classBillingMode(g) !== "membership") return false;
  if (!hasUsablePackage(studentId, g, todayISO())) {
    throw validationError([
      {
        field: "paysWithPackage",
        message: `${studentName(studentId)} não tem pacote com aulas para esta turma.`,
      },
    ]);
  }
  return true;
}

/**
 * Padrao sem escolha explicita (promover da lista de espera): na turma de
 * mensalidade, quem nao tem plano e tem pacote valido paga com o pacote.
 */
export function defaultPaysWithPackage(g: ClassGroup, student: Client): boolean {
  return (
    classBillingMode(g) === "membership" &&
    !student.planId &&
    hasUsablePackage(student.id, g, todayISO())
  );
}
