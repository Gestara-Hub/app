import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { loadCertificatePage } from "../certificatePage";

/**
 * Pagina publica do certificado (doc 21 §1.3): le pelo codigo, com o nome do
 * aluno mascarado; cancelado diz que nao vale; codigo errado nao existe.
 */

const admin = adminClient();
let tenant: TestTenant;
const code = "GH-7K3M-2A9F";

beforeEach(async () => {
  tenant = await createTestTenant();
  const org = tenant.organizationId;
  const studentId = randomUUID();
  const classId = randomUUID();
  const enrollmentId = randomUUID();
  await admin.from("clients").insert({ id: studentId, organization_id: org, name: "Ana Souza", phone: "11977770000", status: "active" }).throwOnError();
  const { data: modality } = await admin.from("categories").insert({ organization_id: org, name: "Confeitaria" }).select("id").single();
  const { data: teacher } = await admin
    .from("professionals")
    .insert({ organization_id: org, unit_id: tenant.unitId, name: "Carla Mendes", modality_ids: [modality?.id], service_ids: [], working_hours: [] })
    .select("id")
    .single();
  await admin
    .from("class_groups")
    .insert({ id: classId, organization_id: org, unit_id: tenant.unitId, name: "Confeitaria Básica", modality_id: modality?.id, instructor_id: teacher?.id, capacity: 10, meeting_slots: [], start_date: "2026-08-04", end_date: "2026-09-22", status: "active" })
    .throwOnError();
  await admin.from("enrollments").insert({ id: enrollmentId, organization_id: org, class_group_id: classId, student_id: studentId, status: "active", enrolled_at: "2026-08-04" }).throwOnError();
  await admin
    .from("issued_certificates")
    .insert({
      id: randomUUID(),
      organization_id: org,
      enrollment_id: enrollmentId,
      class_group_id: classId,
      student_id: studentId,
      code,
      snapshot: {
        enrollmentId,
        classGroupId: classId,
        organizationName: "Ateliê Doce",
        studentName: "Ana Souza",
        courseName: "Confeitaria Básica",
        modalityName: "Confeitaria",
        startDate: "2026-08-04",
        endDate: "2026-09-22",
        lessonsCount: 8,
        workloadMinutes: 960,
        attendancePercent: 92,
        instructorName: "Carla Mendes",
        issuedOn: "2026-09-22",
      },
    })
    .throwOnError();
});

afterEach(async () => {
  await tenant.remove();
});

describe("página pública do certificado", () => {
  it("código válido: dados do certificado com o nome mascarado", async () => {
    const view = await loadCertificatePage(code.toLowerCase());
    expect(view).toMatchObject({
      code,
      status: "valid",
      studentName: "Ana S.",
      courseName: "Confeitaria Básica",
      organizationName: "Ateliê Doce",
      attendancePercent: 92,
    });
    expect(JSON.stringify(view)).not.toContain("Souza");
  });

  it("cancelado diz que não vale; código errado não existe", async () => {
    await admin.from("issued_certificates").update({ status: "canceled" }).eq("code", code).throwOnError();
    expect((await loadCertificatePage(code))?.status).toBe("canceled");
    expect(await loadCertificatePage("GH-AAAA-BBBB")).toBeNull();
    expect(await loadCertificatePage("' OR 1=1 --")).toBeNull();
  });
});
