import type { ClassGroupView, ModalityAssessmentSettings } from "@gestarahub/contracts";
import { PROGRESSION_TEMPLATES } from "@/lib/progression-tracks";
import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { categoriesService } from "@/services/catalog/categoriesService";
import { gradesService } from "@/services/grades";
import { turmasService } from "@/services/classes";
import { createInstructor, createStudent, resetAcademy } from "@/test/academy";

const summaries = () => store.auditLog.map((e) => e.summary);

const TEN: ModalityAssessmentSettings = { enabled: true, scale: "zero_ten", passingGrade: 6 };

async function setupClass(
  assessments: ModalityAssessmentSettings | null = TEN,
  name = "Inglês",
): Promise<{ group: ClassGroupView; modalityId: string; instructorId: string }> {
  const modality = await categoriesService.create({
    name,
    assessments: assessments ?? undefined,
    progressionTrack: structuredClone(PROGRESSION_TEMPLATES.modules.track),
  });
  const instructor = await createInstructor(`Prof ${name}`, modality.id);
  const group = await turmasService.create({
    name: `${name} Turma A`,
    modalityId: modality.id,
    instructorId: instructor.id,
    capacity: 10,
    meetingSlots: [{ weekday: 2, start: `${String(8 + store.classGroups.length).padStart(2, "0")}:00`, end: `${String(9 + store.classGroups.length).padStart(2, "0")}:00` }],
    startDate: "2026-09-14",
    status: "active",
  });
  return { group, modalityId: modality.id, instructorId: instructor.id };
}

/** Matricula no inicio do mes (as provas dos testes sao de 20/09). */
async function enroll(groupId: string, name: string): Promise<string> {
  const s = await createStudent(name);
  const e = await turmasService.enroll({ classGroupId: groupId, studentId: s.id });
  store.enrollments.find((x) => x.id === e.id)!.enrolledAt = "2026-09-01T12:00:00.000Z";
  return s.id;
}

function loginAs(profile: "owner" | "manager" | "attendant" | "professional", professionalId?: string) {
  const id = `usr-${profile}-${professionalId ?? "x"}`;
  if (!store.users.some((u) => u.id === id)) {
    store.users.push({
      id,
      organizationId: store.organization.id,
      name: `Usuário ${profile}`,
      email: `${id}@teste.local`,
      profile,
      ...(professionalId ? { professionalId } : {}),
      status: "active",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    });
  }
  setCurrentActor({ userId: id, name: `Usuário ${profile}`, profile });
}

describe("notas: padrão da área nas modalidades novas", () => {
  beforeEach(() => resetAcademy());

  it.each([
    ["languages", true],
    ["music", true],
    ["beauty_courses", true],
    ["martial_arts", false],
    ["pilates_yoga", false],
    ["custom", false],
  ] as const)("área %s liga avaliações: %s", async (segment, enabled) => {
    store.organization.classSegment = segment;
    const modality = await categoriesService.create({ name: "Nova" });
    if (enabled) {
      expect(modality.assessments).toEqual({ enabled: true, scale: "zero_ten", passingGrade: 6 });
    } else {
      expect(modality.assessments).toBeUndefined();
    }
  });

  it("a escolha explícita vence o padrão e a nota mínima é validada na escala", async () => {
    store.organization.classSegment = "languages";
    const off = await categoriesService.create({ name: "Conversação", assessments: { ...TEN, enabled: false } });
    expect(off.assessments?.enabled).toBe(false);
    await expect(
      categoriesService.create({ name: "Gramática", assessments: { enabled: true, scale: "concept", passingGrade: "F" as never } }),
    ).rejects.toMatchObject({ code: "VALIDATION", fields: [{ field: "assessments.passingGrade" }] });
    const updated = await categoriesService.update(off.id, {
      assessments: { enabled: true, scale: "zero_hundred", passingGrade: 70 },
    });
    expect(updated.assessments).toEqual({ enabled: true, scale: "zero_hundred", passingGrade: 70 });
  });
});

describe("notas: avaliações da turma", () => {
  beforeEach(() => resetAcademy());

  it("só cria avaliação quando a modalidade da turma tem avaliações", async () => {
    const { group } = await setupClass(null, "Jiu-Jitsu");
    await expect(
      gradesService.create({ classGroupId: group.id, name: "Prova", date: "2026-09-20" }),
    ).rejects.toMatchObject({ code: "VALIDATION", message: "A modalidade desta turma não tem avaliações." });
  });

  it("cria com peso padrão 1 e valida nome, data, peso e etapa", async () => {
    const { group } = await setupClass();
    const created = await gradesService.create({ classGroupId: group.id, name: "  Prova 1 ", date: "2026-09-20", levelId: "lvl-mod-basic" });
    expect(created).toMatchObject({ name: "Prova 1", weight: 1, levelId: "lvl-mod-basic", gradedCount: 0, enrolledCount: 0, average: null });
    expect(created.levelName).toBeTruthy();

    await expect(
      gradesService.create({ classGroupId: group.id, name: " ", date: "", weight: 0, levelId: "nao-existe" }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "name" }, { field: "date" }, { field: "weight" }, { field: "levelId" }],
    });
  });

  it("edita, exclui e registra na auditoria", async () => {
    const { group } = await setupClass();
    const a = await gradesService.create({ classGroupId: group.id, name: "Prova 1", date: "2026-09-20" });
    const edited = await gradesService.update(a.id, { name: "Prova final", weight: 2, levelId: "lvl-mod-pre" });
    expect(edited).toMatchObject({ name: "Prova final", weight: 2, levelId: "lvl-mod-pre" });
    const cleared = await gradesService.update(a.id, { levelId: null });
    expect(cleared.levelId).toBeUndefined();
    await expect(gradesService.update(a.id, { weight: -1 })).rejects.toMatchObject({ fields: [{ field: "weight" }] });

    await gradesService.remove(a.id);
    expect((await gradesService.listClassAssessments(group.id)).assessments).toHaveLength(0);
    expect(summaries()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("criou a avaliação Prova 1 da turma Inglês Turma A"),
        expect.stringContaining("editou a avaliação Prova final"),
        expect.stringContaining("excluiu a avaliação Prova final"),
      ]),
    );
    await expect(gradesService.remove(a.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("notas: lançamento em lote", () => {
  beforeEach(() => resetAcademy());

  it("lança só para matriculados, valida a escala e guarda faltou", async () => {
    const { group } = await setupClass();
    const ana = await enroll(group.id, "Ana");
    const bia = await enroll(group.id, "Bia");
    const caio = await enroll(group.id, "Caio");
    const outsider = (await createStudent("Fora")).id;
    const a = await gradesService.create({ classGroupId: group.id, name: "Prova 1", date: "2026-09-20" });

    await expect(
      gradesService.setGrades(a.id, [
        { studentId: outsider, status: "graded", value: 8 },
        { studentId: ana, status: "graded", value: 11 },
        { studentId: bia, status: "graded", value: "7,55" as never },
      ]),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [
        { field: `grades.${outsider}`, message: "Fora não está matriculado nesta turma." },
        { field: `grades.${ana}`, message: "A nota vai de 0 a 10." },
        { field: `grades.${bia}`, message: "Use no máximo uma casa decimal." },
      ],
    });

    const saved = await gradesService.setGrades(a.id, [
      { studentId: ana, status: "graded", value: "7,5" as never },
      { studentId: bia, status: "graded", value: 5 },
      { studentId: caio, status: "absent" },
    ]);
    expect(saved).toMatchObject({ gradedCount: 3, enrolledCount: 3 });
    // Faltou fica fora da média: (7,5 + 5) / 2 = 6,25 -> 6,3.
    expect(saved.average).toMatchObject({ value: 6.3, count: 2, belowPassing: false });

    const sheet = await gradesService.getSheet(a.id);
    expect(sheet.rows.map((r) => [r.studentName, r.status, r.value])).toEqual([
      ["Ana", "graded", 7.5],
      ["Bia", "graded", 5],
      ["Caio", "absent", undefined],
    ]);
    expect(summaries()).toContain("Ana Ribeiro lançou as notas de Prova 1 da turma Inglês Turma A");

    // "Sem nota" apaga a linha; quem fica fora do lote nao muda.
    const after = await gradesService.setGrades(a.id, [{ studentId: caio, status: "none" }]);
    expect(after.gradedCount).toBe(2);
    expect(store.assessments?.[0].grades.find((g) => g.studentId === ana)).toMatchObject({
      value: 7.5,
      updatedBy: "usr-ac-ana",
    });
  });

  it("conceito e apto/não apto", async () => {
    const concept = await setupClass({ enabled: true, scale: "concept", passingGrade: "C" }, "Piano");
    const [x, y] = [await enroll(concept.group.id, "X"), await enroll(concept.group.id, "Y")];
    const a = await gradesService.create({ classGroupId: concept.group.id, name: "Teoria", date: "2026-09-20" });
    await expect(gradesService.setGrades(a.id, [{ studentId: x, status: "graded", value: 9 }])).rejects.toMatchObject({
      fields: [{ message: "Escolha um conceito de A a E." }],
    });
    const saved = await gradesService.setGrades(a.id, [
      { studentId: x, status: "graded", value: "a" as never },
      { studentId: y, status: "graded", value: "C" },
    ]);
    expect(saved.average).toMatchObject({ value: "B", numeric: 8 });

    const pf = await setupClass({ enabled: true, scale: "pass_fail", passingGrade: "pass" }, "Natação");
    const z = await enroll(pf.group.id, "Z");
    const b = await gradesService.create({ classGroupId: pf.group.id, name: "Travessia", date: "2026-09-20" });
    const result = await gradesService.setGrades(b.id, [{ studentId: z, status: "graded", value: "fail" }]);
    expect(result.average).toMatchObject({ value: "fail", numeric: 0, belowPassing: true });
  });

  it("aluno que saiu da turma sai da conta, mas a nota fica guardada", async () => {
    const { group } = await setupClass();
    const ana = await enroll(group.id, "Ana");
    const bia = await enroll(group.id, "Bia");
    const a = await gradesService.create({ classGroupId: group.id, name: "Prova", date: "2026-09-20" });
    await gradesService.setGrades(a.id, [
      { studentId: ana, status: "graded", value: 10 },
      { studentId: bia, status: "graded", value: 4 },
    ]);
    const enrollment = store.enrollments.find((e) => e.studentId === bia)!;
    await turmasService.cancelEnrollment(enrollment.id);
    const view = await gradesService.listClassAssessments(group.id);
    expect(view.assessments[0]).toMatchObject({ gradedCount: 1, enrolledCount: 1 });
    expect(view.assessments[0].average?.value).toBe(10);
    // Boletim de quem saiu ainda mostra a nota.
    const card = await gradesService.getReportCard(bia);
    expect(card.modalities[0].entries[0]).toMatchObject({ value: 4, belowPassing: true });
  });
});

describe("notas: permissões", () => {
  beforeEach(() => resetAcademy());

  it("professor lança só nas turmas dele; atendente não lança", async () => {
    const own = await setupClass(TEN, "Inglês");
    const other = await setupClass(TEN, "Espanhol");
    const s = await enroll(own.group.id, "Ana");

    loginAs("professional", own.instructorId);
    const a = await gradesService.create({ classGroupId: own.group.id, name: "Prova", date: "2026-09-20" });
    await gradesService.setGrades(a.id, [{ studentId: s, status: "graded", value: 9 }]);
    await expect(
      gradesService.create({ classGroupId: other.group.id, name: "Prova", date: "2026-09-20" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "Você só lança notas nas suas turmas." });

    loginAs("professional");
    await expect(gradesService.setGrades(a.id, [])).rejects.toMatchObject({ code: "FORBIDDEN" });

    loginAs("attendant");
    await expect(gradesService.remove(a.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Você não tem permissão para lançar notas.",
    });
    // Leitura segue liberada (a tela guarda com classes:view).
    expect((await gradesService.listClassAssessments(own.group.id)).assessments).toHaveLength(1);

    loginAs("manager");
    await gradesService.create({ classGroupId: other.group.id, name: "Prova", date: "2026-09-20" });
  });
});

describe("notas: boletim e média da turma", () => {
  beforeEach(() => resetAcademy());

  it("média ponderada por etapa e geral, destaque abaixo da mínima e média da turma", async () => {
    const { group } = await setupClass();
    const ana = await enroll(group.id, "Ana");
    const bia = await enroll(group.id, "Bia");
    const p1 = await gradesService.create({ classGroupId: group.id, name: "Prova 1", date: "2026-09-10", levelId: "lvl-mod-basic" });
    const p2 = await gradesService.create({ classGroupId: group.id, name: "Prova 2", date: "2026-09-15", levelId: "lvl-mod-basic", weight: 2 });
    const p3 = await gradesService.create({ classGroupId: group.id, name: "Trabalho", date: "2026-09-20" });
    await gradesService.setGrades(p1.id, [
      { studentId: ana, status: "graded", value: 5 },
      { studentId: bia, status: "graded", value: 9 },
    ]);
    await gradesService.setGrades(p2.id, [
      { studentId: ana, status: "graded", value: 8 },
      { studentId: bia, status: "absent" },
    ]);
    await gradesService.setGrades(p3.id, [{ studentId: ana, status: "graded", value: 4 }]);

    const card = await gradesService.getReportCard(ana);
    expect(card.modalities).toHaveLength(1);
    const m = card.modalities[0];
    expect(m.entries.map((e) => [e.name, e.value, e.belowPassing])).toEqual([
      ["Trabalho", 4, true],
      ["Prova 2", 8, false],
      ["Prova 1", 5, true],
    ]);
    // Etapa 1: (5 + 8*2) / 3 = 7; sem etapa: 4.
    expect(m.levels.map((l) => [l.levelId, l.average?.value])).toEqual([
      ["lvl-mod-basic", 7],
      [undefined, 4],
    ]);
    expect(m.levels[0].levelName).toBeTruthy();
    // Geral: (5 + 16 + 4) / 4 = 6,25 -> 6,3.
    expect(m.overall).toMatchObject({ value: 6.3, belowPassing: false });

    // Turma: media das medias (Ana 6,3; Bia 9) = 7,65 -> 7,7.
    const view = await gradesService.listClassAssessments(group.id);
    expect(view.classAverage?.value).toBe(7.7);
    expect(view.assessments.map((a) => a.name)).toEqual(["Trabalho", "Prova 2", "Prova 1"]);
  });

  it("só modalidades com avaliações ligadas entram no boletim", async () => {
    const withGrades = await setupClass(TEN, "Inglês");
    const without = await setupClass(null, "Jiu-Jitsu");
    const s = await createStudent("Ana");
    await turmasService.enroll({ classGroupId: withGrades.group.id, studentId: s.id });
    await turmasService.enroll({ classGroupId: without.group.id, studentId: s.id });
    const card = await gradesService.getReportCard(s.id);
    expect(card.modalities.map((m) => m.modalityName)).toEqual(["Inglês"]);
    expect(card.modalities[0]).toMatchObject({ entries: [], overall: null });
  });
});

describe("data da avaliação (ALU-28)", () => {
  beforeEach(() => resetAcademy());

  it("recusa data futura e não lança para quem entrou depois da prova", async () => {
    const { group } = await setupClass();
    await expect(
      gradesService.create({ classGroupId: group.id, name: "Prova", date: "2026-09-30" }),
    ).rejects.toMatchObject({ fields: [{ field: "date", message: "A avaliação não pode ter data futura." }] });

    const ana = await enroll(group.id, "Ana");
    const a = await gradesService.create({ classGroupId: group.id, name: "Prova", date: "2026-09-20" });
    const late = await createStudent("Lia");
    await turmasService.enroll({ classGroupId: group.id, studentId: late.id }); // hoje, 22/09
    const sheet = await gradesService.getSheet(a.id);
    expect(sheet.rows.map((r) => r.studentId)).toEqual([ana]);
    await expect(
      gradesService.setGrades(a.id, [{ studentId: late.id, status: "graded", value: 8 }]),
    ).rejects.toMatchObject({ fields: [{ message: "Lia entrou na turma depois da avaliação." }] });
  });
});
