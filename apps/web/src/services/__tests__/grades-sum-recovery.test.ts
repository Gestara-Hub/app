import type { ClassGroupView, ModalityAssessmentSettings } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { categoriesService } from "@/services/catalog/categoriesService";
import { gradesService } from "@/services/grades";
import { turmasService } from "@/services/classes";
import { createInstructor, createStudent, resetAcademy } from "@/test/academy";

/**
 * Notas, fase A (31/10/2026): soma dos pontos, recuperacao (vale a maior nota)
 * e frequencia minima no boletim. Hoje nos testes: 22/09/2026.
 */

const SUM: ModalityAssessmentSettings = { enabled: true, scale: "zero_ten", passingGrade: 6, resultMode: "sum" };
const TEN: ModalityAssessmentSettings = { enabled: true, scale: "zero_ten", passingGrade: 6 };

async function setupClass(assessments: ModalityAssessmentSettings): Promise<ClassGroupView> {
  const modality = await categoriesService.create({ name: "Reforço", assessments });
  const instructor = await createInstructor("Prof Reforço", modality.id);
  return turmasService.create({
    name: "Reforço Turma A",
    modalityId: modality.id,
    instructorId: instructor.id,
    capacity: 10,
    meetingSlots: [{ weekday: 2, start: "08:00", end: "09:00" }],
    startDate: "2026-09-01",
    status: "active",
  });
}

async function enroll(groupId: string, name: string): Promise<string> {
  const s = await createStudent(name);
  const e = await turmasService.enroll({ classGroupId: groupId, studentId: s.id });
  store.enrollments.find((x) => x.id === e.id)!.enrolledAt = "2026-09-01T12:00:00.000Z";
  return s.id;
}

const card = async (studentId: string) => (await gradesService.getReportCard(studentId)).modalities[0];

beforeEach(() => resetAcademy());

describe("soma dos pontos", () => {
  it("cada avaliação vale uma parte; o total é a soma, e a nota não passa do que ela vale", async () => {
    const group = await setupClass(SUM);
    const ana = await enroll(group.id, "Ana");
    const prova = await gradesService.create({ classGroupId: group.id, name: "Prova 1", date: "2026-09-15", points: 3 });
    const trabalho = await gradesService.create({ classGroupId: group.id, name: "Trabalho", date: "2026-09-16", points: 2.5 });

    await expect(gradesService.setGrades(prova.id, [{ studentId: ana, status: "graded", value: 3.5 }])).rejects.toMatchObject({
      fields: [{ field: `grades.${ana}`, message: "A nota vai de 0 a 3." }],
    });
    await gradesService.setGrades(prova.id, [{ studentId: ana, status: "graded", value: 2.5 }]);
    await gradesService.setGrades(trabalho.id, [{ studentId: ana, status: "graded", value: 2 }]);

    const modality = await card(ana);
    expect(modality.overall).toMatchObject({ value: 4.5, outOf: 5.5, belowPassing: false });
    expect(modality.entries.map((e) => e.points)).toEqual([2.5, 3]);
    const sheet = await gradesService.getSheet(prova.id);
    expect(sheet.maxGrade).toBe(3);
  });

  it("sem dizer quanto vale, a avaliação não é criada", async () => {
    const group = await setupClass(SUM);
    await expect(
      gradesService.create({ classGroupId: group.id, name: "Prova", date: "2026-09-15" }),
    ).rejects.toMatchObject({ fields: [{ field: "points", message: "Informe quanto a avaliação vale." }] });
  });
});

describe("recuperação", () => {
  it("vale a maior nota; a recuperação aparece no boletim e não conta sozinha", async () => {
    const group = await setupClass(TEN);
    const ana = await enroll(group.id, "Ana");
    const bia = await enroll(group.id, "Bia");
    const caio = await enroll(group.id, "Caio");
    const prova = await gradesService.create({ classGroupId: group.id, name: "Prova 1", date: "2026-09-15" });
    await gradesService.setGrades(prova.id, [
      { studentId: ana, status: "graded", value: 4 },
      { studentId: bia, status: "absent" },
      { studentId: caio, status: "graded", value: 3 },
    ]);
    const rec = await gradesService.create({ classGroupId: group.id, name: "Recuperação", date: "2026-09-18", recoveryOf: prova.id });
    expect(rec.recoveryOfName).toBe("Prova 1");
    const sheet = await gradesService.getSheet(rec.id);
    expect(sheet.rows.find((r) => r.studentId === ana)?.original).toEqual({ status: "graded", value: 4 });
    await gradesService.setGrades(rec.id, [
      { studentId: ana, status: "graded", value: 7 },
      { studentId: bia, status: "graded", value: 8 },
      { studentId: caio, status: "graded", value: 5 },
    ]);

    const anaCard = await card(ana);
    expect(anaCard.overall).toMatchObject({ value: 7, count: 1, belowPassing: false });
    // A nota original segue abaixo; a que passou a valer, nao.
    expect(anaCard.entries.find((e) => e.assessmentId === prova.id)).toMatchObject({
      belowPassing: true,
      recoveredValue: 7,
      recoveredBelowPassing: false,
    });
    expect((await card(caio)).entries.find((e) => e.assessmentId === prova.id)).toMatchObject({
      recoveredValue: 5,
      recoveredBelowPassing: true,
    });
    expect(anaCard.entries.find((e) => e.assessmentId === rec.id)).toMatchObject({ recoveryOf: prova.id, recoveryOfName: "Prova 1" });
    // Faltou na prova: a recuperacao vale como segunda chamada.
    expect((await card(bia)).overall).toMatchObject({ value: 8, count: 1 });
  });

  it("não recupera outra recuperação; excluir a prova leva a recuperação junto", async () => {
    const group = await setupClass(TEN);
    const prova = await gradesService.create({ classGroupId: group.id, name: "Prova 1", date: "2026-09-15" });
    const rec = await gradesService.create({ classGroupId: group.id, name: "Recuperação", date: "2026-09-18", recoveryOf: prova.id });
    await expect(
      gradesService.create({ classGroupId: group.id, name: "Rec da rec", date: "2026-09-19", recoveryOf: rec.id }),
    ).rejects.toMatchObject({ fields: [{ field: "recoveryOf", message: "Escolha uma avaliação que não seja recuperação." }] });
    await gradesService.remove(prova.id);
    expect(store.assessments ?? []).toHaveLength(0);
  });
});

describe("frequência mínima", () => {
  it("o boletim mostra a frequência nas turmas da modalidade e se ficou abaixo", async () => {
    const group = await setupClass({ ...TEN, minAttendancePercent: 75 });
    const ana = await enroll(group.id, "Ana");
    const mark = (date: string, status: "present" | "absent") =>
      store.attendances.push({
        id: `at-${date}`,
        sessionId: `${group.id}~${date}~08:00`,
        studentId: ana,
        status,
        markedAt: `${date}T12:00:00.000Z`,
      } as (typeof store.attendances)[number]);
    mark("2026-09-08", "present");
    mark("2026-09-15", "absent");
    expect((await card(ana)).attendance).toEqual({ percent: 50, below: true });
    mark("2026-09-22", "present");
    mark("2026-09-01", "present");
    expect((await card(ana)).attendance).toEqual({ percent: 75, below: false });
  });

  it("modalidade guarda só o que vale: soma só nas escalas numéricas, frequência de 1 a 100", async () => {
    const concept = await categoriesService.create({
      name: "Música",
      assessments: { enabled: true, scale: "concept", passingGrade: "C", resultMode: "sum", minAttendancePercent: 80 },
    });
    expect(concept.assessments).toEqual({ enabled: true, scale: "concept", passingGrade: "C", minAttendancePercent: 80 });
    await expect(
      categoriesService.create({ name: "Idiomas", assessments: { ...TEN, minAttendancePercent: 0 } }),
    ).rejects.toMatchObject({ fields: [{ field: "assessments.minAttendancePercent" }] });
  });
});

describe("troca de escala com notas lançadas (achado V5 de 31/10/2026)", () => {
  it("modalidade com nota não troca para soma nem de escala; sem nota, troca", async () => {
    const group = await setupClass(TEN);
    const ana = await enroll(group.id, "Ana");
    const modalityId = group.modalityId!;
    await expect(categoriesService.update(modalityId, { assessments: SUM })).resolves.toBeTruthy();
    await categoriesService.update(modalityId, { assessments: TEN });
    const prova = await gradesService.create({ classGroupId: group.id, name: "Prova", date: "2026-09-15" });
    await gradesService.setGrades(prova.id, [{ studentId: ana, status: "graded", value: 5 }]);
    await expect(categoriesService.update(modalityId, { assessments: SUM })).rejects.toMatchObject({
      fields: [{ field: "assessments.scale" }],
    });
    await expect(
      categoriesService.update(modalityId, { assessments: { enabled: true, scale: "zero_hundred", passingGrade: 60 } }),
    ).rejects.toMatchObject({ fields: [{ field: "assessments.scale" }] });
    // Mudar so a minima segue valendo.
    await expect(categoriesService.update(modalityId, { assessments: { ...TEN, passingGrade: 7 } })).resolves.toBeTruthy();
  });

  it("na soma, a avaliação não vale menos do que uma nota já lançada", async () => {
    const group = await setupClass(SUM);
    const ana = await enroll(group.id, "Ana");
    const prova = await gradesService.create({ classGroupId: group.id, name: "Prova", date: "2026-09-15", points: 4 });
    await gradesService.setGrades(prova.id, [{ studentId: ana, status: "graded", value: 3.5 }]);
    await expect(gradesService.update(prova.id, { points: 3 })).rejects.toMatchObject({ fields: [{ field: "points" }] });
    await expect(gradesService.update(prova.id, { points: 3.5 })).resolves.toBeTruthy();
  });
});
