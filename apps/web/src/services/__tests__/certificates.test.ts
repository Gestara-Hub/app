import type { AttendanceStatus, ClassGroupView } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { turmasService } from "@/services/turmasService";
import { createInstructor, createStudent, resetAcademy, sessionIdOf } from "@/test/academy";

/**
 * Certificado de conclusao do curso (doc 20, fase D): recurso pago
 * (`certificates`, Pro e Scale), so para matricula ativa em curso terminado.
 * Hoje congelado em 22/09/2026 (terca).
 */

async function courseClass(): Promise<ClassGroupView> {
  const teacher = await createInstructor("Chef Bia");
  return turmasService.create({
    name: "Confeitaria",
    modalityId: teacher.modalityIds?.[0] ?? "",
    instructorId: teacher.id,
    capacity: 10,
    allowDropin: false,
    // Segundas de 03/08 a 21/09: 8 aulas.
    meetingSlots: [{ weekday: 1, start: "19:00", end: "21:00" }],
    startDate: "2026-08-03",
    endDate: "2026-12-14",
    billingMode: "course",
    coursePriceCents: 80000,
    courseMaxInstallments: 1,
    status: "active",
  });
}

/** Matricula no curso e encerra o curso ontem (21/09). */
async function completedEnrollment() {
  const g = await courseClass();
  const student = await createStudent("Rui Lima");
  const enrollment = await turmasService.enroll({
    classGroupId: g.id,
    studentId: student.id,
    course: { priceCents: 80000, installments: 1, firstDueDate: "2026-09-22" },
  });
  await turmasService.update(g.id, { endDate: "2026-09-21" });
  return { g, student, enrollment };
}

function mark(classGroupId: string, studentId: string, date: string, status: AttendanceStatus) {
  store.attendances.push({
    id: `att-${date}-${studentId}`,
    sessionId: sessionIdOf(classGroupId, date, "19:00"),
    studentId,
    status,
    markedAt: `${date}T22:00:00.000Z`,
  });
}

function setTier(tier: "free" | "pro" | "scale") {
  store.organization.subscription = { tier };
}

describe("certificado de conclusão", () => {
  beforeEach(() => resetAcademy());

  it("é do Plano Pro: o grátis recebe FEATURE_NOT_IN_PLAN", async () => {
    const { enrollment } = await completedEnrollment();
    await expect(turmasService.getCourseCertificate(enrollment.id)).rejects.toMatchObject({
      code: "FEATURE_NOT_IN_PLAN",
      httpStatus: 403,
      message: "Certificado de conclusão está disponível no Plano Pro.",
    });
  });

  it("Pro e Scale geram o certificado com aulas, frequência, instrutor e cidade", async () => {
    const { g, student, enrollment } = await completedEnrollment();
    mark(g.id, student.id, "2026-09-07", "present");
    mark(g.id, student.id, "2026-09-14", "present");
    mark(g.id, student.id, "2026-09-21", "absent");
    mark(g.id, student.id, "2026-09-21", "justified");
    store.unit.address = {
      postalCode: "01000-000",
      street: "Rua A",
      number: "1",
      neighborhood: "Centro",
      city: "Campinas",
      state: "SP",
    };
    for (const tier of ["pro", "scale"] as const) {
      setTier(tier);
      expect(await turmasService.getCourseCertificate(enrollment.id)).toMatchObject({
        enrollmentId: enrollment.id,
        classGroupId: g.id,
        organizationName: "Academia X",
        studentName: "Rui Lima",
        courseName: "Confeitaria",
        startDate: "2026-08-03",
        endDate: "2026-09-21",
        lessonsCount: 8,
        attendancePercent: 67,
        instructorName: "Chef Bia",
        city: "Campinas",
        issuedOn: "2026-09-22",
      });
    }
  });

  it("curso ainda em andamento não tem certificado", async () => {
    setTier("pro");
    const g = await courseClass();
    const student = await createStudent("Ana");
    const enrollment = await turmasService.enroll({
      classGroupId: g.id,
      studentId: student.id,
      course: { priceCents: 80000, installments: 1, firstDueDate: "2026-09-22" },
    });
    await expect(turmasService.getCourseCertificate(enrollment.id)).rejects.toMatchObject({
      code: "VALIDATION",
      message: "O certificado sai quando o curso termina.",
    });
  });

  it("matrícula cancelada ou inexistente não tem certificado", async () => {
    setTier("pro");
    const { enrollment } = await completedEnrollment();
    await turmasService.cancelEnrollment(enrollment.id);
    await expect(turmasService.getCourseCertificate(enrollment.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(turmasService.getCourseCertificate("enr-x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("sem chamada, a frequência fica de fora (null)", async () => {
    setTier("pro");
    const { enrollment } = await completedEnrollment();
    const cert = await turmasService.getCourseCertificate(enrollment.id);
    expect(cert.attendancePercent).toBeNull();
    expect("city" in cert).toBe(false);
  });
});
