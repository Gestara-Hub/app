import type { ClassGroupView, ClassMeetingSlot } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { PROGRESSION_TEMPLATES } from "@/lib/progression-tracks";
import { store } from "@/mocks/store";
import { categoriesService } from "@/services/catalog/categoriesService";
import { turmasService } from "@/services/classes";
import { clientsService } from "@/services/clients";
import { studentSummaryService } from "@/services/clients/studentSummaryService";
import { createInstructor, createStudent, resetAcademy } from "@/test/academy";

/**
 * Mudar de turma (doc product/30 §2, 13/11/2026): um passo, a matricula antiga
 * fica como "Mudou para {turma}" (nao e saida), tudo ou nada. Hoje nos testes: 22/09/2026.
 */

const MORNING: ClassMeetingSlot[] = [{ weekday: 2, start: "08:00", end: "09:00" }];
const summaries = () => store.auditLog.map((e) => e.summary);

let modalityId: string;

// Um professor por turma: turmas no mesmo horario nao chocam pelo professor.
async function newClass(name: string, over: Partial<{ capacity: number; slots: ClassMeetingSlot[]; course: boolean }> = {}) {
  const instructor = await createInstructor(`Prof ${name}`, modalityId);
  return turmasService.create({
    name,
    modalityId,
    instructorId: instructor.id,
    capacity: over.capacity ?? 10,
    meetingSlots: over.slots ?? MORNING,
    startDate: "2026-09-01",
    ...(over.course ? { endDate: "2026-12-15", billingMode: "course" as const, coursePriceCents: 50000, courseMaxInstallments: 1 } : {}),
    status: "active",
  });
}

async function enrolled(group: ClassGroupView, name: string): Promise<string> {
  const s = await createStudent(name);
  await turmasService.enroll({ classGroupId: group.id, studentId: s.id });
  return s.id;
}

const activeIn = (groupId: string) =>
  store.enrollments.filter((e) => e.classGroupId === groupId && e.status === "active").map((e) => e.studentId);

beforeEach(async () => {
  resetAcademy();
  const modality = await categoriesService.create({
    name: "Natação",
    progressionTrack: structuredClone(PROGRESSION_TEMPLATES.general_levels.track),
  });
  modalityId = modality.id;
});

describe("mudar de turma", () => {
  it("fecha a matricula antiga como mudanca e abre a nova, no mesmo horario sem choque", async () => {
    const a = await newClass("Natação A");
    const b = await newClass("Natação B");
    const ana = await enrolled(a, "Ana");
    store.auditLog.length = 0;

    const result = await turmasService.moveStudents({ fromClassGroupId: a.id, toClassGroupId: b.id, studentIds: [ana] });

    expect(result).toEqual({ moved: 1, promoted: 0 });
    expect(activeIn(a.id)).toEqual([]);
    expect(activeIn(b.id)).toEqual([ana]);
    const old = store.enrollments.find((e) => e.classGroupId === a.id && e.studentId === ana);
    expect(old).toMatchObject({ status: "canceled", movedToClassGroupId: b.id, cancellationReason: "Mudou para Natação B" });
    expect(old?.canceledAt).toBeDefined();
    expect((await turmasService.listEnrollments(a.id)).map((e) => e.studentId)).toEqual([]);
    // Uma linha so na Auditoria: mudanca, nao cancelamento nem matricula nova.
    expect(summaries()).toHaveLength(1);
    expect(summaries()[0]).toContain("mudou Ana da turma Natação A para Natação B");

    const summary = await studentSummaryService.getStudentSummary(ana);
    expect(summary.enrollments.find((e) => e.classGroupId === a.id)).toMatchObject({
      state: "canceled",
      movedToClassName: "Natação B",
    });
  });

  it("varios alunos: confere as vagas antes; sem confirmar, ninguem muda", async () => {
    const a = await newClass("Natação A");
    const b = await newClass("Natação B", { capacity: 2 });
    await enrolled(b, "Já lá");
    const ana = await enrolled(a, "Ana");
    const bia = await enrolled(a, "Bia");

    await expect(
      turmasService.moveStudents({ fromClassGroupId: a.id, toClassGroupId: b.id, studentIds: [ana, bia] }),
    ).rejects.toMatchObject({ code: "CLASS_FULL", message: "Natação B tem 1 vaga livre para 2 alunos." });
    expect(activeIn(a.id).sort()).toEqual([ana, bia].sort());

    const result = await turmasService.moveStudents(
      { fromClassGroupId: a.id, toClassGroupId: b.id, studentIds: [ana, bia] },
      { allowOverCapacity: true },
    );
    expect(result.moved).toBe(2);
    expect(activeIn(b.id)).toHaveLength(3);
  });

  it("tudo ou nada: quem ja esta na turma de destino barra o grupo", async () => {
    const a = await newClass("Natação A");
    const b = await newClass("Natação B", { slots: [{ weekday: 4, start: "08:00", end: "09:00" }] });
    const ana = await enrolled(a, "Ana");
    const bia = await enrolled(a, "Bia");
    await turmasService.enroll({ classGroupId: b.id, studentId: bia });

    await expect(
      turmasService.moveStudents({ fromClassGroupId: a.id, toClassGroupId: b.id, studentIds: [ana, bia] }),
    ).rejects.toMatchObject({ fields: [{ field: "studentIds", message: "Bia já está em Natação B." }] });
    expect(activeIn(a.id).sort()).toEqual([ana, bia].sort());
  });

  it("recusa curso, a mesma turma e aluno que nao esta na turma", async () => {
    const a = await newClass("Natação A");
    const course = await newClass("Curso de verão", { course: true, slots: [{ weekday: 5, start: "08:00", end: "09:00" }] });
    const ana = await enrolled(a, "Ana");
    const caio = await createStudent("Caio");

    await expect(
      turmasService.moveStudents({ fromClassGroupId: a.id, toClassGroupId: course.id, studentIds: [ana] }),
    ).rejects.toMatchObject({ fields: [{ field: "toClassGroupId", message: "Curso não muda de turma: matricule no próximo curso." }] });
    await expect(
      turmasService.moveStudents({ fromClassGroupId: a.id, toClassGroupId: a.id, studentIds: [ana] }),
    ).rejects.toMatchObject({ fields: [{ field: "toClassGroupId", message: "Escolha outra turma." }] });
    const b = await newClass("Natação B");
    await expect(
      turmasService.moveStudents({ fromClassGroupId: a.id, toClassGroupId: b.id, studentIds: [caio.id] }),
    ).rejects.toMatchObject({ fields: [{ field: "studentIds", message: "Caio não está ativo nesta turma." }] });
  });

  it("subir de nivel junto: cada aluno vai para o proximo nivel; no ultimo, fica", async () => {
    const a = await newClass("Natação Iniciante");
    const b = await newClass("Natação Intermediário");
    const ana = await enrolled(a, "Ana");
    const bia = await enrolled(a, "Bia");
    await clientsService.promoteStudent({
      studentId: bia,
      modalityId,
      toLevelId: "lvl-gen-adv",
      toLevelName: "Avançado",
      toSubLevel: 0,
      date: "2026-09-10",
    });

    const result = await turmasService.moveStudents({
      fromClassGroupId: a.id,
      toClassGroupId: b.id,
      studentIds: [ana, bia],
      promote: true,
    });

    expect(result).toEqual({ moved: 2, promoted: 1 });
    const anaProgress = (await clientsService.getById(ana)).progressions?.[modalityId];
    expect(anaProgress).toMatchObject({ levelId: "lvl-gen-int", levelName: "Intermediário", promotedAt: "2026-09-22" });
    expect(anaProgress?.promotionHistory[0]).toMatchObject({ toLevelName: "Intermediário", notes: "Mudou para a turma Natação Intermediário" });
    expect((await clientsService.getById(bia)).progressions?.[modalityId]?.levelName).toBe("Avançado");
  });
});
