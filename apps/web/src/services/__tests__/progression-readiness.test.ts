import type { ModalityAssessmentSettings } from "@gestarahub/contracts";
import { promotionReadiness } from "@gestarahub/core/progression";
import { beforeEach, describe, expect, it } from "vitest";
import { PROGRESSION_TEMPLATES } from "@/lib/progression-tracks";
import { store } from "@/mocks/store";
import { categoriesService } from "@/services/catalog/categoriesService";
import { turmasService } from "@/services/classes";
import { clientsService } from "@/services/clients";
import { gradesService } from "@/services/grades";
import { createInstructor, createStudent, resetAcademy } from "@/test/academy";

/**
 * "Apto" com notas (doc product/30 §1, 13/11/2026): a visao da graduacao leva
 * a media da etapa atual e a frequencia. Hoje nos testes: 22/09/2026.
 */

const TEN: ModalityAssessmentSettings = { enabled: true, scale: "zero_ten", passingGrade: 6 };

async function setup(assessments?: ModalityAssessmentSettings) {
  const modality = await categoriesService.create({
    name: "Inglês",
    progressionTrack: structuredClone(PROGRESSION_TEMPLATES.general_levels.track),
    ...(assessments ? { assessments } : {}),
  });
  const instructor = await createInstructor("Prof Inglês", modality.id);
  const group = await turmasService.create({
    name: "Inglês Turma A",
    modalityId: modality.id,
    instructorId: instructor.id,
    capacity: 10,
    meetingSlots: [{ weekday: 2, start: "08:00", end: "09:00" }],
    startDate: "2026-09-01",
    status: "active",
  });
  const student = await createStudent("Ana");
  const e = await turmasService.enroll({ classGroupId: group.id, studentId: student.id });
  store.enrollments.find((x) => x.id === e.id)!.enrolledAt = "2026-09-01T12:00:00.000Z";
  return { modalityId: modality.id, groupId: group.id, studentId: student.id };
}

async function grade(groupId: string, studentId: string, name: string, date: string, value: number, extra: { levelId?: string; recoveryOf?: string } = {}) {
  const a = await gradesService.create({ classGroupId: groupId, name, date, ...extra });
  await gradesService.setGrades(a.id, [{ studentId, status: "graded", value }]);
  return a.id;
}

async function overviewItem(studentId: string, modalityId: string) {
  const overview = await clientsService.getProgressionOverview(studentId);
  const item = overview.items.find((i) => i.modality.id === modalityId);
  if (!item) throw new Error("modalidade fora da visao");
  return item;
}

beforeEach(() => resetAcademy());

describe("notas da etapa na visao da graduacao", () => {
  it("sem avaliacoes na modalidade, nada de notas", async () => {
    const { studentId, modalityId } = await setup();
    expect((await overviewItem(studentId, modalityId)).stageGrades).toBeUndefined();
  });

  it("conta as avaliacoes do nivel atual e as sem etapa desde a ultima graduacao, com a recuperacao", async () => {
    const { studentId, modalityId, groupId } = await setup(TEN);
    await grade(groupId, studentId, "Prova Iniciante", "2026-09-05", 9, { levelId: "lvl-gen-beg" });
    await grade(groupId, studentId, "Trabalho antigo", "2026-09-06", 10);
    await clientsService.promoteStudent({
      studentId,
      modalityId,
      toLevelId: "lvl-gen-int",
      toLevelName: "Intermediário",
      toSubLevel: 0,
      date: "2026-09-10",
    });
    const prova = await grade(groupId, studentId, "Prova Intermediário", "2026-09-15", 4, { levelId: "lvl-gen-int" });
    await grade(groupId, studentId, "Trabalho", "2026-09-18", 7);

    let item = await overviewItem(studentId, modalityId);
    // (4 + 7) / 2: a prova do Iniciante e o trabalho de antes da graduacao ficam fora.
    expect(item.stageGrades?.average).toMatchObject({ value: 5.5, count: 2, belowPassing: true });
    expect(promotionReadiness({
      criteriaType: "manual_exam",
      targetAttendances: 24,
      targetMonths: 6,
      presentSincePromotion: item.presentSincePromotion,
      monthsInLevel: 0,
      hasNextStep: true,
      grades: item.stageGrades,
    })).toEqual({ ready: false, gaps: ["Média 5,5, mínima 6"] });

    await grade(groupId, studentId, "Recuperação", "2026-09-20", 8, { recoveryOf: prova });
    item = await overviewItem(studentId, modalityId);
    expect(item.stageGrades?.average).toMatchObject({ value: 7.5, belowPassing: false });
  });

  it("frequencia so com a minima na modalidade; sem chamada fica sem numero", async () => {
    const { studentId, modalityId } = await setup({ ...TEN, minAttendancePercent: 75 });
    const item = await overviewItem(studentId, modalityId);
    expect(item.stageGrades).toMatchObject({ average: null, attendancePercent: null });
  });
});
