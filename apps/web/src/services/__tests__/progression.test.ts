import type { Client, StudentModalityProgression } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { ORG_ID } from "@/config/tenant";
import { resolveModalityTrack } from "@/lib/progression-tracks";
import { setCurrentActor } from "@/mocks/currentActor";
import { setActiveOrganization, store } from "@/mocks/store";
import { categoriesService } from "@/services/categoriesService";
import { clientsService } from "@/services/clientsService";
import { ACADEMY_ORG, createStudent, resetAcademy } from "@/test/academy";

const summaries = () => store.auditLog.map((e) => e.summary);

function progressionOf(client: Client, modalityId: string): StudentModalityProgression {
  const p = client.progressions?.[modalityId];
  if (!p) throw new Error(`sem progresso na modalidade ${modalityId}`);
  return p;
}

async function stored(studentId: string, modalityId: string): Promise<StudentModalityProgression> {
  return progressionOf(await clientsService.getById(studentId), modalityId);
}

async function createModality(name: string): Promise<string> {
  return (await categoriesService.create({ name })).id;
}

async function addGoal(studentId: string, modalityId: string, title: string, target?: number): Promise<string> {
  const client = await clientsService.addGoal(studentId, modalityId, { title, target });
  const goal = progressionOf(client, modalityId).goals.find((g) => g.title === title.trim());
  if (!goal) throw new Error(`meta ${title} nao criada`);
  return goal.id;
}

// --- Registro de aula individual ---------------------------------------------

describe("addClassRecord (registro individual)", () => {
  let bjj: string;
  beforeEach(async () => {
    resetAcademy();
    bjj = await createModality("Jiu-Jitsu");
  });

  it("recusa registro sem anotacao, lembrete nem avanco de meta", async () => {
    const s = await createStudent("Bruno");
    await expect(
      clientsService.addClassRecord({ studentId: s.id, modalityId: bjj, date: "2026-09-22", tone: "positive", note: "   " }),
    ).rejects.toMatchObject({ code: "VALIDATION", fields: [{ field: "note" }] });

    const goalId = await addGoal(s.id, bjj, "Raspagem", 30);
    await expect(
      clientsService.addClassRecord({
        studentId: s.id,
        modalityId: bjj,
        date: "2026-09-22",
        tone: "positive",
        goalProgress: [{ goalId, amount: 0 }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION", fields: [{ field: "note" }] });
    expect((await stored(s.id, bjj)).evaluations).toHaveLength(0);
  });

  it("aluno inexistente responde NOT_FOUND", async () => {
    await expect(
      clientsService.addClassRecord({ studentId: "nao-existe", modalityId: bjj, date: "2026-09-22", tone: "general", note: "Oi" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("persiste o registro com turma, aula, autor logado e auditoria", async () => {
    const s = await createStudent("Bruno");
    setCurrentActor({ userId: "usr-prof", name: "Prof. Carlos", profile: "manager" });
    const updated = await clientsService.addClassRecord({
      studentId: s.id,
      modalityId: bjj,
      classGroupId: "grp-1",
      classGroupName: "Adulto Noite",
      sessionId: "grp-1~2026-09-22~19:00",
      date: "2026-09-22",
      tone: "positive",
      note: "  Boa passagem de guarda  ",
      nextClassNote: "  Revisar armlock  ",
    });

    const [record] = progressionOf(updated, bjj).evaluations;
    expect(record).toMatchObject({
      date: "2026-09-22",
      classGroupId: "grp-1",
      classGroupName: "Adulto Noite",
      sessionId: "grp-1~2026-09-22~19:00",
      tone: "positive",
      note: "Boa passagem de guarda",
      nextClassNote: "Revisar armlock",
      authorName: "Prof. Carlos",
    });
    expect(record.goalProgress).toBeUndefined();
    expect((await stored(s.id, bjj)).evaluations.map((e) => e.id)).toEqual([record.id]);
    expect(summaries()).toContain("Prof. Carlos registrou a aula de Bruno (Adulto Noite)");
  });

  it("so o lembrete para a proxima aula ja basta", async () => {
    const s = await createStudent("Bruno");
    const updated = await clientsService.addClassRecord({
      studentId: s.id,
      modalityId: bjj,
      date: "2026-09-22",
      tone: "general",
      nextClassNote: "Trazer faixa nova",
    });
    expect(progressionOf(updated, bjj).evaluations[0]).toMatchObject({ note: "", nextClassNote: "Trazer faixa nova" });
  });

  it("aluno sem progresso comeca no 1o nivel permitido para a idade", async () => {
    const modality = await categoriesService.create({
      name: "Lutinha",
      progressionTrack: {
        enabled: true,
        criteriaType: "attendance",
        style: "levels",
        levels: [
          { id: "kids", name: "Kids", maxSubLevels: 0, maxAge: 12 },
          { id: "adult", name: "Adulto", maxSubLevels: 0, minAge: 13 },
        ],
      },
    });
    const adult = await clientsService.create({ name: "Carla", phone: "11977770000", status: "active", birthDate: "1990-05-10" });
    const kid = await clientsService.create({ name: "Davi", phone: "11977770001", status: "active", birthDate: "2018-05-10" });
    const noBirth = await createStudent("Edu");
    const record = (studentId: string) =>
      clientsService.addClassRecord({ studentId, modalityId: modality.id, date: "2026-09-20", tone: "general", note: "Primeira aula" });

    expect(progressionOf(await record(adult.id), modality.id).levelName).toBe("Adulto");
    expect(progressionOf(await record(kid.id), modality.id).levelName).toBe("Kids");
    expect(progressionOf(await record(noBirth.id), modality.id).levelName).toBe("Kids");
  });

  it("aluno sem progresso comeca no 1o nivel da trilha, grau 0", async () => {
    const s = await createStudent("Bruno");
    expect(s.progressions?.[bjj]).toBeUndefined();
    const updated = await clientsService.addClassRecord({
      studentId: s.id,
      modalityId: bjj,
      date: "2026-09-20",
      tone: "general",
      note: "Primeira aula",
    });
    const first = resolveModalityTrack(store.categories.find((c) => c.id === bjj)).levels[0];
    expect(progressionOf(updated, bjj)).toMatchObject({
      modalityId: bjj,
      modalityName: "Jiu-Jitsu",
      levelName: first.name,
      subLevel: 0,
      promotedAt: "2026-09-20",
      promotionHistory: [],
    });
  });

  it("linha do tempo fica do mais novo ao mais antigo", async () => {
    const s = await createStudent("Bruno");
    for (const note of ["primeiro", "segundo", "terceiro"]) {
      await clientsService.addClassRecord({ studentId: s.id, modalityId: bjj, date: "2026-09-22", tone: "general", note });
    }
    expect((await stored(s.id, bjj)).evaluations.map((e) => e.note)).toEqual(["terceiro", "segundo", "primeiro"]);
  });

  it("meta com alvo soma o avanco, limita no alvo e marca feita na data do registro", async () => {
    const s = await createStudent("Bruno");
    const goalId = await addGoal(s.id, bjj, "Raspagem", 30);

    let updated = await clientsService.addClassRecord({
      studentId: s.id,
      modalityId: bjj,
      date: "2026-09-20",
      tone: "positive",
      goalProgress: [{ goalId, amount: 5 }],
    });
    expect(progressionOf(updated, bjj).goals[0]).toMatchObject({ progress: 5 });
    expect(progressionOf(updated, bjj).goals[0].completedAt).toBeUndefined();
    expect(progressionOf(updated, bjj).evaluations[0].goalProgress).toEqual([{ goalId, title: "Raspagem", amount: 5 }]);

    updated = await clientsService.addClassRecord({
      studentId: s.id,
      modalityId: bjj,
      date: "2026-09-21",
      tone: "positive",
      goalProgress: [{ goalId, amount: 40 }],
    });
    expect(progressionOf(updated, bjj).goals[0]).toMatchObject({ progress: 30, completedAt: "2026-09-21" });
    expect(progressionOf(updated, bjj).evaluations[0].goalProgress).toEqual([
      { goalId, title: "Raspagem", amount: 40, completed: true },
    ]);

    // Meta ja feita nao avanca mais; o registro sai sem goalProgress.
    updated = await clientsService.addClassRecord({
      studentId: s.id,
      modalityId: bjj,
      date: "2026-09-22",
      tone: "general",
      note: "Treino leve",
      goalProgress: [{ goalId, amount: 1 }],
    });
    expect(progressionOf(updated, bjj).goals[0]).toMatchObject({ progress: 30, completedAt: "2026-09-21" });
    expect(progressionOf(updated, bjj).evaluations[0].goalProgress).toBeUndefined();
  });

  it("meta sem alvo so fecha com completed (amount e ignorado)", async () => {
    const s = await createStudent("Bruno");
    const goalId = await addGoal(s.id, bjj, "Postura na guarda");

    let updated = await clientsService.addClassRecord({
      studentId: s.id,
      modalityId: bjj,
      date: "2026-09-21",
      tone: "general",
      note: "Ainda nao",
      goalProgress: [{ goalId, amount: 3 }],
    });
    expect(progressionOf(updated, bjj).goals[0]).toMatchObject({ progress: 0 });
    expect(progressionOf(updated, bjj).goals[0].completedAt).toBeUndefined();

    updated = await clientsService.addClassRecord({
      studentId: s.id,
      modalityId: bjj,
      date: "2026-09-22",
      tone: "positive",
      goalProgress: [{ goalId, completed: true }],
    });
    expect(progressionOf(updated, bjj).goals[0].completedAt).toBe("2026-09-22");
    expect(progressionOf(updated, bjj).evaluations[0].goalProgress).toEqual([
      { goalId, title: "Postura na guarda", completed: true },
    ]);
  });
});

// --- Registro da turma inteira (chamada) --------------------------------------

describe("addClassRecords (registro em lote pela chamada)", () => {
  let bjj: string;
  const base = {
    sessionId: "grp-1~2026-09-22~19:00",
    classGroupId: "grp-1",
    classGroupName: "Adulto Noite",
    date: "2026-09-22",
  };
  beforeEach(async () => {
    resetAcademy();
    bjj = await createModality("Jiu-Jitsu");
  });

  it("cria um registro so para quem tem tom ou anotacao e devolve a contagem", async () => {
    const [a, b, c] = await Promise.all(["Ana", "Beto", "Caio"].map(createStudent));
    const created = await clientsService.addClassRecords({
      ...base,
      modalityId: bjj,
      entries: [
        { studentId: a.id, tone: "positive" },
        { studentId: b.id, note: "  Joelho dolorido  " },
        { studentId: c.id },
      ],
    });
    expect(created).toBe(2);

    const recA = (await stored(a.id, bjj)).evaluations;
    expect(recA).toHaveLength(1);
    expect(recA[0]).toMatchObject({ ...base, tone: "positive", note: "", authorName: "Ana Ribeiro" });
    expect(recA[0].classNote).toBeUndefined();

    const recB = (await stored(b.id, bjj)).evaluations;
    expect(recB[0]).toMatchObject({ tone: "general", note: "Joelho dolorido" });

    expect((await clientsService.getById(c.id)).progressions?.[bjj]).toBeUndefined();
    expect(summaries()).toContain("Ana Ribeiro registrou a aula de Adulto Noite (2 alunos)");
  });

  it("com anotacao da turma, todos os listados ganham o registro", async () => {
    const [a, b] = await Promise.all(["Ana", "Beto"].map(createStudent));
    const created = await clientsService.addClassRecords({
      ...base,
      modalityId: bjj,
      classNote: "  Aula de passagem de guarda  ",
      entries: [{ studentId: a.id, tone: "attention" }, { studentId: b.id }],
    });
    expect(created).toBe(2);
    expect((await stored(a.id, bjj)).evaluations[0]).toMatchObject({
      tone: "attention",
      classNote: "Aula de passagem de guarda",
    });
    expect((await stored(b.id, bjj)).evaluations[0]).toMatchObject({
      tone: "general",
      note: "",
      classNote: "Aula de passagem de guarda",
    });
  });

  it("registrar a mesma aula de novo troca o registro, sem duplicar", async () => {
    const a = await createStudent("Ana");
    await clientsService.addClassRecords({ ...base, modalityId: bjj, entries: [{ studentId: a.id, tone: "positive" }] });
    await clientsService.addClassRecords({
      ...base,
      modalityId: bjj,
      entries: [{ studentId: a.id, tone: "attention", note: "Cansado" }],
    });
    const records = (await stored(a.id, bjj)).evaluations.filter((e) => e.sessionId === base.sessionId);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ tone: "attention", note: "Cansado" });
  });

  it("aula futura nao tem registro", async () => {
    const a = await createStudent("Ana");
    await expect(
      clientsService.addClassRecords({
        ...base,
        sessionId: "grp-1~2026-09-29~19:00",
        date: "2026-09-29",
        modalityId: bjj,
        entries: [{ studentId: a.id, tone: "positive" }],
      }),
    ).rejects.toMatchObject({ fields: [{ field: "date", message: "Registre a aula no dia dela ou depois." }] });
  });

  it("nenhum registro criado vira erro de validacao em entries, sem auditoria", async () => {
    const a = await createStudent("Ana");
    const auditBefore = store.auditLog.length;
    await expect(
      clientsService.addClassRecords({ ...base, modalityId: bjj, classNote: "   ", entries: [{ studentId: a.id }] }),
    ).rejects.toMatchObject({ code: "VALIDATION", fields: [{ field: "entries" }] });
    await expect(
      clientsService.addClassRecords({ ...base, modalityId: bjj, entries: [{ studentId: "nao-existe", tone: "positive" }] }),
    ).rejects.toMatchObject({ code: "VALIDATION", fields: [{ field: "entries" }] });
    expect(store.auditLog.length).toBe(auditBefore);
  });

  it("aluno inexistente e pulado sem derrubar o lote", async () => {
    const a = await createStudent("Ana");
    const created = await clientsService.addClassRecords({
      ...base,
      modalityId: bjj,
      entries: [{ studentId: "nao-existe", tone: "positive" }, { studentId: a.id, tone: "positive" }],
    });
    expect(created).toBe(1);
    expect(summaries()).toContain("Ana Ribeiro registrou a aula de Adulto Noite (1 aluno)");
  });

  it("grava na modalidade da aula, sem tocar as outras do aluno", async () => {
    const muay = await createModality("Muay Thai");
    const a = await createStudent("Ana");
    await clientsService.addClassRecord({ studentId: a.id, modalityId: muay, date: "2026-09-21", tone: "general", note: "Chute" });
    await clientsService.addClassRecords({ ...base, modalityId: bjj, entries: [{ studentId: a.id, tone: "positive" }] });
    const client = await clientsService.getById(a.id);
    expect(progressionOf(client, bjj).evaluations).toHaveLength(1);
    expect(progressionOf(client, muay).evaluations.map((e) => e.note)).toEqual(["Chute"]);
  });
});

// --- Metas e pontos fortes ----------------------------------------------------

describe("metas e pontos fortes por aluno e modalidade", () => {
  let bjj: string;
  let muay: string;
  beforeEach(async () => {
    resetAcademy();
    bjj = await createModality("Jiu-Jitsu");
    muay = await createModality("Muay Thai");
  });

  it("pontos fortes sem espacos nem repetidos, separados por modalidade e por aluno", async () => {
    const [a, b] = await Promise.all(["Ana", "Beto"].map(createStudent));
    await clientsService.updateStrengths(a.id, bjj, ["  Guarda ", "Guarda", "", "Raspagem"]);
    await clientsService.updateStrengths(a.id, muay, ["Chute"]);
    await clientsService.updateStrengths(b.id, bjj, ["Queda"]);

    const ana = await clientsService.getById(a.id);
    expect(progressionOf(ana, bjj).strengths).toEqual(["Guarda", "Raspagem"]);
    expect(progressionOf(ana, muay).strengths).toEqual(["Chute"]);
    expect(progressionOf(await clientsService.getById(b.id), bjj).strengths).toEqual(["Queda"]);
  });

  it("addGoal valida titulo (1..80) e alvo inteiro maior que zero", async () => {
    const a = await createStudent("Ana");
    const fieldsOf = async (input: { title: string; target?: number }) => {
      try {
        await clientsService.addGoal(a.id, bjj, input);
        return [];
      } catch (err) {
        return ((err as { fields?: { field: string }[] }).fields ?? []).map((f) => f.field);
      }
    };
    expect(await fieldsOf({ title: "   " })).toEqual(["title"]);
    expect(await fieldsOf({ title: "x".repeat(81) })).toEqual(["title"]);
    expect(await fieldsOf({ title: "Raspagem", target: 0 })).toEqual(["target"]);
    expect(await fieldsOf({ title: "Raspagem", target: 1.5 })).toEqual(["target"]);
    expect(await fieldsOf({ title: "x".repeat(80), target: 1 })).toEqual([]);
    expect((await clientsService.getById(a.id)).progressions?.[bjj]?.goals).toHaveLength(1);
  });

  it("metas ficam na modalidade e no aluno certos", async () => {
    const [a, b] = await Promise.all(["Ana", "Beto"].map(createStudent));
    await addGoal(a.id, bjj, "  Raspagem  ", 30);
    await addGoal(a.id, muay, "Chute alto");
    const ana = await clientsService.getById(a.id);
    expect(progressionOf(ana, bjj).goals).toEqual([
      expect.objectContaining({ title: "Raspagem", target: 30, progress: 0 }),
    ]);
    expect(progressionOf(ana, muay).goals).toEqual([expect.objectContaining({ title: "Chute alto", progress: 0 })]);
    expect(progressionOf(ana, muay).goals[0].target).toBeUndefined();
    expect((await clientsService.getById(b.id)).progressions).toBeUndefined();
  });

  it("marcar feita completa o alvo; reabrir volta para alvo - 1", async () => {
    const a = await createStudent("Ana");
    const goalId = await addGoal(a.id, bjj, "Raspagem", 30);
    let goal = progressionOf(await clientsService.setGoalCompleted(a.id, bjj, goalId, true), bjj).goals[0];
    expect(goal).toMatchObject({ progress: 30, completedAt: "2026-09-22" });

    goal = progressionOf(await clientsService.setGoalCompleted(a.id, bjj, goalId, false), bjj).goals[0];
    expect(goal.progress).toBe(29);
    expect(goal.completedAt).toBeUndefined();
  });

  it("remover meta tira so ela; meta inexistente responde NOT_FOUND", async () => {
    const a = await createStudent("Ana");
    const g1 = await addGoal(a.id, bjj, "Raspagem", 30);
    await addGoal(a.id, bjj, "Armlock");
    const updated = await clientsService.removeGoal(a.id, bjj, g1);
    expect(progressionOf(updated, bjj).goals.map((g) => g.title)).toEqual(["Armlock"]);
    await expect(clientsService.removeGoal(a.id, bjj, g1)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(clientsService.setGoalCompleted(a.id, bjj, "nada", true)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// --- Sugestoes aprendidas -----------------------------------------------------

describe("sugestoes aprendidas de pontos fortes e metas", () => {
  let bjj: string;
  let muay: string;
  beforeEach(async () => {
    resetAcademy();
    bjj = await createModality("Jiu-Jitsu");
    muay = await createModality("Muay Thai");
  });

  it("so sugere termos da propria modalidade, sem complemento de outras", async () => {
    const [a, b] = await Promise.all(["Ana", "Beto"].map(createStudent));
    await clientsService.updateStrengths(a.id, bjj, ["Guarda"]);
    await addGoal(a.id, bjj, "Raspagem", 10);
    await clientsService.updateStrengths(b.id, muay, ["Chute"]);
    await addGoal(b.id, muay, "Clinch");

    expect(await clientsService.getProgressionTermSuggestions(bjj)).toEqual({ strengths: ["Guarda"], goals: ["Raspagem"] });
    expect(await clientsService.getProgressionTermSuggestions(muay)).toEqual({ strengths: ["Chute"], goals: ["Clinch"] });

    const pilates = await createModality("Pilates");
    expect(await clientsService.getProgressionTermSuggestions(pilates)).toEqual({ strengths: [], goals: [] });
  });

  it("ordena por alunos distintos e usa a grafia mais usada (caixa e acento nao diferenciam)", async () => {
    const [a, b, c, d] = await Promise.all(["Ana", "Beto", "Caio", "Davi"].map(createStudent));
    // "Finalização": 3 alunos, grafia mais usada com acento. "Guarda": 2 alunos (Ana
    // conta uma vez mesmo com duas grafias), empata com "Base" e vai pela ordem alfabetica.
    await clientsService.updateStrengths(a.id, bjj, ["Finalização", "Guarda", "guarda"]);
    await clientsService.updateStrengths(b.id, bjj, ["finalizacao", "Guarda", "Base"]);
    await clientsService.updateStrengths(c.id, bjj, ["Finalização"]);
    await clientsService.updateStrengths(d.id, bjj, ["Base"]);

    const { strengths } = await clientsService.getProgressionTermSuggestions(bjj);
    expect(strengths).toEqual(["Finalização", "Base", "Guarda"]);
  });

  it("devolve no maximo 40 termos", async () => {
    const a = await createStudent("Ana");
    await clientsService.updateStrengths(
      a.id,
      bjj,
      Array.from({ length: 45 }, (_, i) => `Termo ${String(i).padStart(2, "0")}`),
    );
    const { strengths } = await clientsService.getProgressionTermSuggestions(bjj);
    expect(strengths).toHaveLength(40);
    expect(strengths[0]).toBe("Termo 00");
  });

  it("e do espaco inteiro: outro usuario do mesmo tenant ve o que foi digitado", async () => {
    const a = await createStudent("Ana");
    setCurrentActor({ userId: "usr-prof-1", name: "Prof. Carlos", profile: "manager" });
    await clientsService.updateStrengths(a.id, bjj, ["Guarda"]);
    setCurrentActor({ userId: "usr-prof-2", name: "Prof. Dani", profile: "professional" });
    expect((await clientsService.getProgressionTermSuggestions(bjj)).strengths).toEqual(["Guarda"]);
  });

  it("nao vaza entre tenants, mesmo com o mesmo id de modalidade", async () => {
    const a = await createStudent("Ana");
    await clientsService.updateStrengths(a.id, bjj, ["Guarda"]);

    setActiveOrganization(ORG_ID);
    try {
      expect(await clientsService.getProgressionTermSuggestions(bjj)).toEqual({ strengths: [], goals: [] });
      const other = await clientsService.create({ name: "Cliente outro", phone: "11977770000", status: "active" });
      await clientsService.updateStrengths(other.id, bjj, ["Barba"]);
      expect((await clientsService.getProgressionTermSuggestions(bjj)).strengths).toEqual(["Barba"]);
    } finally {
      setActiveOrganization(ACADEMY_ORG);
    }
    expect((await clientsService.getProgressionTermSuggestions(bjj)).strengths).toEqual(["Guarda"]);
  });
});

// --- Graduacao e ponto de partida ---------------------------------------------

describe("promoteStudent e ponto de partida", () => {
  let bjj: string;
  beforeEach(async () => {
    resetAcademy();
    bjj = await createModality("Jiu-Jitsu");
  });

  async function startingPoint(
    studentId: string,
    extra: Partial<StudentModalityProgression>,
  ): Promise<StudentModalityProgression> {
    const updated = await clientsService.saveModalityProgression(studentId, {
      modalityId: bjj,
      modalityName: "Jiu-Jitsu",
      levelId: "white",
      levelName: "Branca",
      levelColor: "white",
      subLevel: 0,
      maxSubLevels: 4,
      promotedAt: "2026-09-01",
      initialAttendanceOffset: 0,
      strengths: [],
      goals: [],
      evaluations: [],
      promotionHistory: [],
      ...extra,
    });
    return progressionOf(updated, bjj);
  }

  it("ponto de partida 'comecou aqui' grava origem, 1o nivel, grau 0 e sem aulas anteriores", async () => {
    const a = await createStudent("Ana");
    const p = await startingPoint(a.id, { origin: "started_here" });
    expect(p).toMatchObject({ origin: "started_here", levelName: "Branca", subLevel: 0, initialAttendanceOffset: 0 });
    expect(summaries()).toContain("Ana Ribeiro atualizou o progresso de Ana (Branca)");
  });

  it("registra historico com examinador e o nivel de origem, mais novo primeiro", async () => {
    const a = await createStudent("Ana");
    await startingPoint(a.id, { origin: "started_here" });

    await clientsService.promoteStudent({
      studentId: a.id,
      modalityId: bjj,
      toLevelName: "Branca",
      toLevelColor: "white",
      toSubLevel: 1,
      date: "2026-09-10",
      examiner: "  Mestre Rui  ",
      notes: "  ",
    });
    const updated = await clientsService.promoteStudent({
      studentId: a.id,
      modalityId: bjj,
      toLevelId: "blue",
      toLevelName: "Azul",
      toLevelColor: "blue",
      toSubLevel: 0,
      date: "2026-09-22",
      isExam: true,
      examiner: "   ",
    });

    const p = progressionOf(updated, bjj);
    expect(p).toMatchObject({ levelId: "blue", levelName: "Azul", subLevel: 0, promotedAt: "2026-09-22" });
    expect(p.promotionHistory).toHaveLength(2);
    expect(p.promotionHistory[0]).toMatchObject({
      date: "2026-09-22",
      fromLevelName: "Branca",
      fromSubLevel: 1,
      toLevelName: "Azul",
      toSubLevel: 0,
      isExam: true,
    });
    expect(p.promotionHistory[0].examiner).toBeUndefined();
    expect(p.promotionHistory[1]).toMatchObject({
      date: "2026-09-10",
      fromLevelName: "Branca",
      fromSubLevel: 0,
      toSubLevel: 1,
      examiner: "Mestre Rui",
    });
    expect(p.promotionHistory[1].notes).toBeUndefined();
    expect(summaries()).toEqual(
      expect.arrayContaining(["Ana Ribeiro graduou Ana para Branca (1º grau)", "Ana Ribeiro graduou Ana para Azul"]),
    );
  });

  it("mantem origem (transferencia), metas, pontos fortes e registros ao graduar", async () => {
    const a = await createStudent("Ana");
    await startingPoint(a.id, {
      origin: "transfer",
      originAcademy: "Academia Alfa",
      originTeacher: "Prof. Lima",
      initialAttendanceOffset: 12,
    });
    await clientsService.updateStrengths(a.id, bjj, ["Guarda"]);
    await addGoal(a.id, bjj, "Raspagem", 30);
    await clientsService.addClassRecord({ studentId: a.id, modalityId: bjj, date: "2026-09-15", tone: "general", note: "Boa aula" });

    const updated = await clientsService.promoteStudent({
      studentId: a.id,
      modalityId: bjj,
      toLevelName: "Branca",
      toSubLevel: 1,
      date: "2026-09-22",
      examiner: "Mestre Rui",
    });
    const p = progressionOf(updated, bjj);
    expect(p).toMatchObject({
      origin: "transfer",
      originAcademy: "Academia Alfa",
      originTeacher: "Prof. Lima",
      strengths: ["Guarda"],
      initialAttendanceOffset: 0,
      maxSubLevels: 4,
      modalityName: "Jiu-Jitsu",
    });
    expect(p.goals.map((g) => g.title)).toEqual(["Raspagem"]);
    expect(p.evaluations.map((e) => e.note)).toEqual(["Boa aula"]);
    expect(p.promotionHistory[0]).toMatchObject({ examiner: "Mestre Rui", fromSubLevel: 0, toSubLevel: 1 });
  });

  it("graduar aluno sem progresso cria o historico sem nivel de origem", async () => {
    const a = await createStudent("Ana");
    const updated = await clientsService.promoteStudent({
      studentId: a.id,
      modalityId: bjj,
      modalityName: "Jiu-Jitsu",
      toLevelName: "Branca",
      toSubLevel: 0,
      date: "2026-09-22",
    });
    const p = progressionOf(updated, bjj);
    expect(p.origin).toBeUndefined();
    expect(p.promotionHistory).toHaveLength(1);
    expect(p.promotionHistory[0].fromLevelName).toBeUndefined();
    await expect(
      clientsService.promoteStudent({ studentId: "nao-existe", modalityId: bjj, toLevelName: "Azul", toSubLevel: 0, date: "2026-09-22" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
