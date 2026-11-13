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
 * "Graduar vários" (doc product/30 §3, 13/11/2026): os candidatos com nivel,
 * aulas e notas; a gravacao de todos de uma vez, tudo ou nada. Hoje nos testes: 22/09/2026.
 */

const TEN: ModalityAssessmentSettings = { enabled: true, scale: "zero_ten", passingGrade: 6 };
const summaries = () => store.auditLog.map((e) => e.summary);

async function setup(opts: { assessments?: boolean; belts?: boolean } = {}) {
  const modality = await categoriesService.create({
    name: opts.belts ? "Jiu-Jitsu" : "Inglês",
    progressionTrack: structuredClone(
      opts.belts ? PROGRESSION_TEMPLATES.bjj_adult.track : PROGRESSION_TEMPLATES.general_levels.track,
    ),
    ...(opts.assessments ? { assessments: TEN } : {}),
  });
  const instructor = await createInstructor("Prof", modality.id);
  const group = await turmasService.create({
    name: "Turma A",
    modalityId: modality.id,
    instructorId: instructor.id,
    capacity: 10,
    meetingSlots: [{ weekday: 2, start: "08:00", end: "09:00" }],
    startDate: "2026-09-01",
    status: "active",
  });
  return { modalityId: modality.id, groupId: group.id };
}

async function student(groupId: string, name: string): Promise<string> {
  const s = await createStudent(name);
  const e = await turmasService.enroll({ classGroupId: groupId, studentId: s.id });
  // Matriculado desde o inicio da turma (a nota pede matricula no dia da avaliacao).
  store.enrollments.find((x) => x.id === e.id)!.enrolledAt = "2026-09-01T12:00:00.000Z";
  return s.id;
}

beforeEach(() => resetAcademy());

describe("candidatos do graduar varios", () => {
  it("traz cada aluno com o progresso, as aulas e as notas da etapa, em ordem de nome", async () => {
    const { modalityId, groupId } = await setup({ assessments: true });
    const bia = await student(groupId, "Bia");
    const ana = await student(groupId, "Ana");
    const prova = await gradesService.create({ classGroupId: groupId, name: "Prova", date: "2026-09-15", levelId: "lvl-gen-beg" });
    await gradesService.setGrades(prova.id, [{ studentId: ana, status: "graded", value: 8 }]);

    const { modality, candidates } = await clientsService.listPromotionCandidates(modalityId, [bia, ana]);
    expect(modality.progressionTrack?.enabled).toBe(true);
    expect(candidates.map((c) => c.studentName)).toEqual(["Ana", "Bia"]);
    expect(candidates[0]).toMatchObject({ presentSincePromotion: 0, stageGrades: { average: { value: 8 } } });
    expect(candidates[1].stageGrades?.average).toBeNull();
  });
});

describe("graduar varios", () => {
  it("grava a graduacao de cada um com a mesma data, examinador e observacao", async () => {
    const { modalityId, groupId } = await setup();
    const ana = await student(groupId, "Ana");
    const bia = await student(groupId, "Bia");
    store.auditLog.length = 0;

    const result = await clientsService.promoteStudents({
      modalityId,
      date: "2026-09-20",
      examiner: "Banca de setembro",
      notes: "Fim do módulo",
      items: [
        { studentId: ana, toLevelId: "lvl-gen-int", toSubLevel: 0 },
        { studentId: bia, toLevelId: "lvl-gen-int", toSubLevel: 0 },
      ],
    });

    expect(result).toEqual({ promoted: 2 });
    for (const id of [ana, bia]) {
      const progression = (await clientsService.getById(id)).progressions?.[modalityId];
      expect(progression).toMatchObject({ levelName: "Intermediário", promotedAt: "2026-09-20" });
      expect(progression?.promotionHistory[0]).toMatchObject({
        toLevelName: "Intermediário",
        examiner: "Banca de setembro",
        notes: "Fim do módulo",
      });
    }
    expect(summaries().filter((s) => s.includes("para Intermediário"))).toHaveLength(2);
  });

  it("faixa com grau: o grau fica na mesma faixa", async () => {
    const { modalityId, groupId } = await setup({ belts: true });
    const ana = await student(groupId, "Ana");
    const white = PROGRESSION_TEMPLATES.bjj_adult.track.levels[0];
    await clientsService.promoteStudents({
      modalityId,
      date: "2026-09-20",
      items: [{ studentId: ana, toLevelId: white.id, toSubLevel: 1 }],
    });
    expect((await clientsService.getById(ana)).progressions?.[modalityId]).toMatchObject({
      levelId: white.id,
      subLevel: 1,
    });
  });

  it("tudo ou nada: data futura, nivel de hoje ou nivel que nao existe barram todos", async () => {
    const { modalityId, groupId } = await setup();
    const ana = await student(groupId, "Ana");
    const bia = await student(groupId, "Bia");

    await expect(
      clientsService.promoteStudents({
        modalityId,
        date: "2026-09-30",
        items: [{ studentId: ana, toLevelId: "lvl-gen-int", toSubLevel: 0 }],
      }),
    ).rejects.toMatchObject({ fields: [{ field: "date", message: "A data não pode ser futura." }] });

    await expect(
      clientsService.promoteStudents({
        modalityId,
        date: "2026-09-20",
        items: [
          { studentId: ana, toLevelId: "lvl-gen-int", toSubLevel: 0 },
          { studentId: bia, toLevelId: "lvl-gen-beg", toSubLevel: 0 },
        ],
      }),
    ).rejects.toMatchObject({ fields: [{ field: "items", message: "Bia já está em Iniciante." }] });

    await expect(
      clientsService.promoteStudents({
        modalityId,
        date: "2026-09-20",
        items: [{ studentId: ana, toLevelId: "nao-existe", toSubLevel: 0 }],
      }),
    ).rejects.toMatchObject({ fields: [{ field: "items", message: "Escolha para onde Ana vai." }] });

    expect((await clientsService.getById(ana)).progressions?.[modalityId]).toBeUndefined();
  });
});
