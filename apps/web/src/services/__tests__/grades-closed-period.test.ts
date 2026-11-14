import type { ModalityAssessmentSettings } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { PROGRESSION_TEMPLATES } from "@/lib/progression-tracks";
import { store } from "@/mocks/store";
import { categoriesService } from "@/services/catalog/categoriesService";
import { turmasService } from "@/services/classes";
import { clientsService } from "@/services/clients";
import { gradesService } from "@/services/grades";
import { createInstructor, createStudent, resetAcademy } from "@/test/academy";

/**
 * Soma dos pontos com o periodo fechado (sobra da revisao geral de 31/10/2026,
 * feita em 13/11/2026): curso que terminou e etapa ja passada comparam o total
 * com o minimo; no meio do periodo, segue o ritmo. Hoje nos testes: 22/09/2026.
 */

const SUM: ModalityAssessmentSettings = { enabled: true, scale: "zero_ten", passingGrade: 6, resultMode: "sum" };

beforeEach(() => resetAcademy());

async function gradedStudent(groupId: string) {
  const s = await createStudent("Ana");
  const e = await turmasService.enroll({
    classGroupId: groupId,
    studentId: s.id,
    course: { priceCents: 50000, installments: 1, firstDueDate: "2026-09-25" },
  });
  store.enrollments.find((x) => x.id === e.id)!.enrolledAt = "2026-09-01T12:00:00.000Z";
  // 4 dos 6 pontos dados: pelo ritmo (66%) passa; contra o minimo de 6, nao.
  for (const [name, value] of [["Prova 1", 3], ["Prova 2", 1]] as const) {
    const a = await gradesService.create({ classGroupId: groupId, name, date: "2026-09-15", points: 3 });
    await gradesService.setGrades(a.id, [{ studentId: s.id, status: "graded", value }]);
  }
  return s.id;
}

describe("soma dos pontos no fim do periodo", () => {
  it("curso que terminou: boletim e media da turma pelo total contra o minimo", async () => {
    const modality = await categoriesService.create({ name: "Reforço", assessments: SUM });
    const instructor = await createInstructor("Prof", modality.id);
    const group = await turmasService.create({
      name: "Reforço Setembro",
      modalityId: modality.id,
      instructorId: instructor.id,
      capacity: 10,
      meetingSlots: [{ weekday: 2, start: "08:00", end: "09:00" }],
      startDate: "2026-09-01",
      endDate: "2026-12-15",
      billingMode: "course",
      coursePriceCents: 50000,
      courseMaxInstallments: 1,
      status: "active",
    });
    const ana = await gradedStudent(group.id);

    // Curso andando: segue o ritmo.
    let card = (await gradesService.getReportCard(ana)).modalities[0];
    expect(card.overall).toMatchObject({ value: 4, outOf: 6, belowPassing: false });
    expect((await gradesService.listClassAssessments(group.id)).classAverage?.belowPassing).toBe(false);

    // O curso terminou: o total contra o minimo.
    store.classGroups.find((g) => g.id === group.id)!.endDate = "2026-09-20";
    card = (await gradesService.getReportCard(ana)).modalities[0];
    expect(card.overall).toMatchObject({ value: 4, belowPassing: true });
    expect((await gradesService.listClassAssessments(group.id)).classAverage?.belowPassing).toBe(true);
  });

  it("etapa ja passada fecha no boletim; a atual segue o ritmo; o Apto fecha a etapa", async () => {
    const modality = await categoriesService.create({
      name: "Inglês",
      assessments: SUM,
      progressionTrack: structuredClone(PROGRESSION_TEMPLATES.general_levels.track),
    });
    const instructor = await createInstructor("Prof", modality.id);
    const group = await turmasService.create({
      name: "Inglês A1",
      modalityId: modality.id,
      instructorId: instructor.id,
      capacity: 10,
      meetingSlots: [{ weekday: 2, start: "08:00", end: "09:00" }],
      startDate: "2026-09-01",
      status: "active",
    });
    const s = await createStudent("Bia");
    const e = await turmasService.enroll({ classGroupId: group.id, studentId: s.id });
    store.enrollments.find((x) => x.id === e.id)!.enrolledAt = "2026-09-01T12:00:00.000Z";
    for (const [levelId, value] of [["lvl-gen-beg", 3], ["lvl-gen-beg", 1], ["lvl-gen-int", 3], ["lvl-gen-int", 1]] as const) {
      const a = await gradesService.create({ classGroupId: group.id, name: `Prova ${levelId} ${value}`, date: "2026-09-15", points: 3, levelId });
      await gradesService.setGrades(a.id, [{ studentId: s.id, status: "graded", value }]);
    }
    await clientsService.promoteStudent({ studentId: s.id, modalityId: modality.id, toLevelId: "lvl-gen-int", toLevelName: "Intermediário", toSubLevel: 0, date: "2026-09-10" });

    const card = (await gradesService.getReportCard(s.id)).modalities[0];
    expect(card.levels.map((l) => [l.levelName, l.average?.belowPassing])).toEqual([
      ["Iniciante", true],
      ["Intermediário", false],
    ]);
    // No Apto, a etapa atual e decidida: fechada tambem.
    const item = (await clientsService.getProgressionOverview(s.id)).items.find((i) => i.modality.id === modality.id);
    expect(item?.stageGrades?.average).toMatchObject({ value: 4, belowPassing: true });
  });
});
