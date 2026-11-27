import type { Charge } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billing";
import { turmasService } from "@/services/classes";
import { createClass, createInstructor, createPlan, enrollStudent, resetAcademy } from "@/test/academy";

/**
 * Cancelar matricula com o dinheiro (27/11/2026, doc product/11 "Cancelar
 * matrícula: plano e cobranças"). Hoje congelado em 22/09/2026 (terca).
 */

const membership = (studentId: string): Charge[] =>
  store.charges.filter((c) => c.kind === "membership" && c.studentId === studentId);

async function studentInClasses(classCount: number) {
  const teacher = await createInstructor("Sensei");
  const plan = await createPlan("monthly", 15000, "Standard");
  const student = await enrollStudent({ name: "Pedro", plan, startDate: "2026-09-01" });
  const enrollments = [];
  for (let i = 0; i < classCount; i += 1) {
    const g = await createClass({ name: `Judô ${i + 1}`, instructorId: teacher.id, slots: [{ weekday: 2, start: `${15 + i}:00`, end: `${16 + i}:00` }] });
    enrollments.push(await turmasService.enroll({ classGroupId: g.id, studentId: student.id }));
  }
  return { student, plan, enrollments };
}

describe("cancelar matrícula: plano e cobranças", () => {
  beforeEach(() => resetAcademy());

  it("última turma do aluno: pergunta o plano e mostra a mensalidade em aberto", async () => {
    const { student, enrollments } = await studentInClasses(1);
    const [preview] = await turmasService.previewCancelEnrollments([enrollments[0].id]);
    expect(preview.plan).toMatchObject({ planName: "Standard", chargesUsedPeriod: false });
    expect(preview.otherClassNames).toEqual([]);
    expect(preview.membership.overdue.map((c) => c.label)).toEqual(["Mensalidade 09/2026"]);
    expect(preview.course).toEqual({ future: [], overdue: [], paid: [] });
    expect(membership(student.id)).toHaveLength(1);
  });

  it("aluno que continua em outra turma: o plano segue e nada é perguntado", async () => {
    const { enrollments } = await studentInClasses(2);
    const [preview] = await turmasService.previewCancelEnrollments([enrollments[0].id]);
    expect(preview.plan).toBeUndefined();
    expect(preview.otherClassNames).toEqual(["Judô 2"]);
    expect(preview.membership.overdue).toEqual([]);
  });

  it("com escolhas, cada pergunta precisa de resposta", async () => {
    const { enrollments } = await studentInClasses(1);
    await expect(turmasService.cancelEnrollment(enrollments[0].id, undefined, {})).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "plan", message: "Escolha o que fazer com o plano." }],
    });
    await expect(turmasService.cancelEnrollment(enrollments[0].id, undefined, { plan: "end" })).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "overdueCharges", message: "Escolha o que fazer com as cobranças vencidas." }],
    });
    // Nada mudou com a recusa.
    expect(store.enrollments.find((e) => e.id === enrollments[0].id)?.status).toBe("active");
  });

  it("encerrar o plano para de gerar mensalidade; a vencida fica como dívida", async () => {
    const { student, enrollments } = await studentInClasses(1);
    await turmasService.cancelEnrollment(enrollments[0].id, undefined, { plan: "end", overdueCharges: "keep" });
    expect(store.clients.find((c) => c.id === student.id)?.membershipStatus).toBe("canceled");
    const [sept] = membership(student.id);
    expect(sept.status === "pending" || sept.status === "overdue").toBe(true);
    // Outubro chega e o plano encerrado nao gera.
    await billingService.generateCharges("2026-10");
    expect(membership(student.id)).toHaveLength(1);
    expect(store.auditLog.at(-1)?.summary).toContain("(encerrou o plano)");
  });

  it("encerrar o plano e cancelar a vencida", async () => {
    const { student, enrollments } = await studentInClasses(1);
    await turmasService.cancelEnrollment(enrollments[0].id, undefined, { plan: "end", overdueCharges: "cancel" });
    const [sept] = membership(student.id);
    expect(sept).toMatchObject({ status: "canceled", canceledBy: "system", cancelReason: "Matrícula cancelada" });
  });

  it("manter o plano: as mensalidades não mudam", async () => {
    const { student, enrollments } = await studentInClasses(1);
    await turmasService.cancelEnrollment(enrollments[0].id, undefined, { plan: "keep" });
    expect(store.clients.find((c) => c.id === student.id)?.membershipStatus).toBe("active");
    expect(membership(student.id).every((c) => c.status !== "canceled")).toBe(true);
  });

  it("mensalidade do mês em curso já paga aparece para manter ou estornar", async () => {
    const { student, enrollments } = await studentInClasses(1);
    await billingService.markPaid(membership(student.id)[0].id, "pix");
    const [preview] = await turmasService.previewCancelEnrollments([enrollments[0].id]);
    expect(preview.membership.paid.map((c) => c.label)).toEqual(["Mensalidade 09/2026"]);
    expect(preview.membership.paid[0].paidOnline).toBeUndefined();
    expect(preview.membership.overdue).toEqual([]);
  });

  it("depois do uso: encerrar gera a mensalidade do período em uso", async () => {
    const teacher = await createInstructor("Sensei");
    const plan = await createPlan("monthly", 15000, "Standard");
    const student = await enrollStudent({ name: "Ana", plan, startDate: "2026-09-01", timing: "postpaid" });
    const g = await createClass({ name: "Judô", instructorId: teacher.id, slots: [{ weekday: 2, start: "15:00", end: "16:00" }] });
    const enrollment = await turmasService.enroll({ classGroupId: g.id, studentId: student.id });
    const [preview] = await turmasService.previewCancelEnrollments([enrollment.id]);
    expect(preview.plan?.chargesUsedPeriod).toBe(true);
    await expect(turmasService.cancelEnrollment(enrollment.id, undefined, { plan: "end" })).rejects.toMatchObject({
      fields: [{ field: "overdueCharges" }],
    });
    await turmasService.cancelEnrollment(enrollment.id, undefined, { plan: "end", overdueCharges: "keep" });
    expect(membership(student.id).some((c) => c.periodStart === "2026-09-01" && c.status !== "canceled")).toBe(true);
  });
});
