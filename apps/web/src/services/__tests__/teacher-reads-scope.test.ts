import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { categoriesService } from "@/services/catalog/categoriesService";
import { gradesService } from "@/services/grades";
import { turmasService } from "@/services/classes";
import { createInstructor, createStudent, resetAcademy } from "@/test/academy";

/**
 * Revisao geral de 31/10/2026: o professor lia o boletim de qualquer aluno e
 * as avaliacoes de qualquer turma (so a gravacao era escopada). Agora a
 * leitura segue o mesmo escopo: so os alunos e as turmas em que e o titular.
 */

beforeEach(() => resetAcademy());

async function setup() {
  const modality = await categoriesService.create({
    name: "Inglês",
    assessments: { enabled: true, scale: "zero_ten", passingGrade: 6 },
  });
  const mine = await createInstructor("Prof Ana", modality.id);
  const other = await createInstructor("Prof Bia", modality.id);
  const group = (name: string, instructorId: string, start: string) =>
    turmasService.create({
      name,
      modalityId: modality.id,
      instructorId,
      capacity: 10,
      meetingSlots: [{ weekday: 2, start, end: `${String(Number(start.slice(0, 2)) + 1).padStart(2, "0")}:00` }],
      startDate: "2026-09-01",
      status: "active",
    });
  const myClass = await group("Turma da Ana", mine.id, "08:00");
  const otherClass = await group("Turma da Bia", other.id, "10:00");
  const myStudent = await createStudent("Aluno da Ana");
  const otherStudent = await createStudent("Aluno da Bia");
  await turmasService.enroll({ classGroupId: myClass.id, studentId: myStudent.id });
  await turmasService.enroll({ classGroupId: otherClass.id, studentId: otherStudent.id });
  const otherAssessment = await gradesService.create({ classGroupId: otherClass.id, name: "Prova", date: "2026-09-15" });
  store.users.push({
    id: "usr-prof-ana",
    organizationId: store.organization.id,
    name: "Prof Ana",
    email: "ana@teste.local",
    profile: "professional",
    professionalId: mine.id,
    status: "active",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  });
  setCurrentActor({ userId: "usr-prof-ana", name: "Prof Ana", profile: "professional" });
  return { myClass, otherClass, myStudent, otherStudent, otherAssessment };
}

describe("professor: leitura de notas só nas turmas dele", () => {
  it("boletim: o do aluno dele abre; o de outro aluno é recusado", async () => {
    const { myStudent, otherStudent } = await setup();
    await expect(gradesService.getReportCard(myStudent.id)).resolves.toMatchObject({ studentId: myStudent.id });
    await expect(gradesService.getReportCard(otherStudent.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("avaliações e lançamento: só da turma em que é o titular", async () => {
    const { myClass, otherClass, otherAssessment } = await setup();
    await expect(gradesService.listClassAssessments(myClass.id)).resolves.toMatchObject({ classGroupId: myClass.id });
    await expect(gradesService.listClassAssessments(otherClass.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(gradesService.getSheet(otherAssessment.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
