import type { AttendanceStatus, ClassGroupView, Client } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { clientsService } from "@/services/clientsService";
import { turmasService } from "@/services/turmasService";
import { createClass, createInstructor, createStudent, resetAcademy, sessionIdOf } from "@/test/academy";

// Hoje (22/09/2026) e terca. Turmas ativas desde 14/09.
// Jiu-Jitsu: seg e qua 19h (14, 16, 21/09). Muay Thai: ter e qui 19h (15, 17, 22/09).
// Manha: seg 07h (14, 21/09).
const MON = { weekday: 1 as const, start: "19:00", end: "20:00" };
const WED = { weekday: 3 as const, start: "19:00", end: "20:00" };
const TUE = { weekday: 2 as const, start: "19:00", end: "20:00" };
const THU = { weekday: 4 as const, start: "19:00", end: "20:00" };
const MON_MORNING = { weekday: 1 as const, start: "07:00", end: "08:00" };

let jiu: ClassGroupView;
let muay: ClassGroupView;
let morning: ClassGroupView;

async function mark(g: ClassGroupView, date: string, student: Client, status: AttendanceStatus): Promise<void> {
  const start = g.meetingSlots[0].start;
  await turmasService.markAttendance({ sessionId: sessionIdOf(g.id, date, start), studentId: student.id, status });
}

async function enrolledStudent(name: string, groups: ClassGroupView[]): Promise<Client> {
  const s = await createStudent(name);
  for (const g of groups) await turmasService.enroll({ classGroupId: g.id, studentId: s.id });
  return s;
}

const streakOf = async (studentId: string, minStreak?: number) =>
  (await turmasService.listAbsenceStreaks(minStreak)).find((r) => r.studentId === studentId);

describe("listAbsenceStreaks (faltas seguidas)", () => {
  beforeEach(async () => {
    resetAcademy();
    jiu = await createClass({ name: "Jiu-Jitsu Noite", instructorId: (await createInstructor("Carlos")).id, slots: [MON, WED] });
    muay = await createClass({ name: "Muay Thai Noite", instructorId: (await createInstructor("Dani")).id, slots: [TUE, THU] });
    morning = await createClass({ name: "Jiu-Jitsu Manhã", instructorId: (await createInstructor("Edu")).id, slots: [MON_MORNING] });
  });

  it("3 faltas seguidas numa turma entram com contagem, inicio, turma e telefone", async () => {
    const s = await enrolledStudent("Bruno", [jiu]);
    await mark(jiu, "2026-09-14", s, "absent");
    await mark(jiu, "2026-09-16", s, "absent");
    await mark(jiu, "2026-09-21", s, "absent");

    expect(await turmasService.listAbsenceStreaks()).toEqual([
      {
        studentId: s.id,
        studentName: "Bruno",
        phone: "11977770000",
        streak: 3,
        since: "2026-09-14",
        classGroupNames: ["Jiu-Jitsu Noite"],
      },
    ]);
  });

  it("o minimo padrao e 3; o parametro muda o corte", async () => {
    const s = await enrolledStudent("Bruno", [jiu]);
    await mark(jiu, "2026-09-16", s, "absent");
    await mark(jiu, "2026-09-21", s, "absent");
    expect(await streakOf(s.id)).toBeUndefined();
    expect(await streakOf(s.id, 2)).toMatchObject({ streak: 2, since: "2026-09-16" });

    await mark(jiu, "2026-09-14", s, "absent");
    expect(await streakOf(s.id)).toMatchObject({ streak: 3 });
    expect(await streakOf(s.id, 4)).toBeUndefined();
  });

  it("soma as faltas de todas as turmas do aluno, em ordem de data", async () => {
    const s = await enrolledStudent("Bruno", [jiu, muay]);
    await mark(jiu, "2026-09-14", s, "absent");
    await mark(muay, "2026-09-15", s, "absent");
    await mark(jiu, "2026-09-16", s, "absent");

    const row = await streakOf(s.id);
    expect(row).toMatchObject({ streak: 3, since: "2026-09-14" });
    expect([...(row?.classGroupNames ?? [])].sort()).toEqual(["Jiu-Jitsu Noite", "Muay Thai Noite"]);
  });

  it("presente em outra turma depois das faltas: nao sumiu, sem sequencia", async () => {
    const s = await enrolledStudent("Bruno", [jiu, muay]);
    await mark(jiu, "2026-09-14", s, "absent");
    await mark(jiu, "2026-09-16", s, "absent");
    await mark(jiu, "2026-09-21", s, "absent");
    await mark(muay, "2026-09-22", s, "present");
    expect(await streakOf(s.id, 1)).toBeUndefined();
  });

  it("presenca no meio corta a sequencia; so contam as faltas depois dela", async () => {
    const s = await enrolledStudent("Bruno", [jiu, muay]);
    await mark(jiu, "2026-09-14", s, "absent");
    await mark(muay, "2026-09-15", s, "present");
    await mark(jiu, "2026-09-16", s, "absent");
    await mark(jiu, "2026-09-21", s, "absent");
    expect(await streakOf(s.id)).toBeUndefined();
    expect(await streakOf(s.id, 2)).toMatchObject({ streak: 2, since: "2026-09-16", classGroupNames: ["Jiu-Jitsu Noite"] });
  });

  it("falta justificada tambem encerra a sequencia", async () => {
    const s = await enrolledStudent("Bruno", [jiu, muay]);
    await mark(jiu, "2026-09-14", s, "absent");
    await mark(muay, "2026-09-15", s, "absent");
    await mark(jiu, "2026-09-16", s, "absent");
    await mark(muay, "2026-09-17", s, "justified");
    expect(await streakOf(s.id, 1)).toBeUndefined();
  });

  it("cada aula conta no maximo uma falta (remarcar a chamada nao soma)", async () => {
    const s = await enrolledStudent("Bruno", [jiu]);
    await mark(jiu, "2026-09-16", s, "absent");
    await mark(jiu, "2026-09-21", s, "absent");
    await mark(jiu, "2026-09-21", s, "absent");
    await mark(jiu, "2026-09-21", s, "absent");
    expect(store.attendances.filter((a) => a.studentId === s.id)).toHaveLength(2);
    expect(await streakOf(s.id)).toBeUndefined();
    expect(await streakOf(s.id, 2)).toMatchObject({ streak: 2 });

    // Corrigir a chamada para presente encerra a sequencia.
    await mark(jiu, "2026-09-21", s, "present");
    expect(await streakOf(s.id, 1)).toBeUndefined();
  });

  it("duas aulas no mesmo dia sao duas faltas, na ordem do horario", async () => {
    const s = await enrolledStudent("Bruno", [jiu, muay, morning]);
    await mark(morning, "2026-09-21", s, "absent");
    await mark(jiu, "2026-09-21", s, "absent");
    await mark(muay, "2026-09-22", s, "absent");
    expect(await streakOf(s.id)).toMatchObject({ streak: 3, since: "2026-09-21" });

    // Presente as 07h e falta as 19h do mesmo dia: a falta da noite vem depois.
    const t = await enrolledStudent("Tiago", [jiu, muay, morning]);
    await mark(morning, "2026-09-21", t, "present");
    await mark(jiu, "2026-09-21", t, "absent");
    await mark(muay, "2026-09-22", t, "absent");
    expect(await streakOf(t.id, 2)).toMatchObject({ streak: 2, since: "2026-09-21" });

    // Falta as 07h e presente as 19h: sem sequencia.
    const u = await enrolledStudent("Ugo", [jiu, morning]);
    await mark(jiu, "2026-09-14", u, "absent");
    await mark(jiu, "2026-09-16", u, "absent");
    await mark(morning, "2026-09-21", u, "absent");
    await mark(jiu, "2026-09-21", u, "present");
    expect(await streakOf(u.id, 1)).toBeUndefined();
  });

  it("aula sem chamada feita nao conta nem quebra a sequencia", async () => {
    const s = await enrolledStudent("Bruno", [jiu, muay]);
    await mark(jiu, "2026-09-14", s, "absent");
    // 15/09 (Muay) e 16/09 (Jiu) sem chamada.
    await mark(muay, "2026-09-17", s, "absent");
    await mark(jiu, "2026-09-21", s, "absent");
    expect(await streakOf(s.id)).toMatchObject({ streak: 3, since: "2026-09-14" });
  });

  it("so considera matriculas ativas: turma cancelada nao soma nem quebra", async () => {
    const s = await enrolledStudent("Bruno", [jiu, muay]);
    await mark(muay, "2026-09-15", s, "absent");
    await mark(muay, "2026-09-17", s, "absent");
    await mark(jiu, "2026-09-21", s, "absent");
    await mark(muay, "2026-09-22", s, "present");
    const enrollment = store.enrollments.find((e) => e.studentId === s.id && e.classGroupId === muay.id);
    await turmasService.cancelEnrollment(enrollment!.id);

    // Sem o Muay Thai: so a falta do Jiu-Jitsu conta e a presenca do Muay nao quebra.
    expect(await streakOf(s.id, 1)).toMatchObject({ streak: 1, since: "2026-09-21", classGroupNames: ["Jiu-Jitsu Noite"] });
    expect(await streakOf(s.id)).toBeUndefined();
  });

  it("sem matricula ativa ou aluno inativo fica de fora", async () => {
    const s = await enrolledStudent("Bruno", [jiu]);
    await mark(jiu, "2026-09-14", s, "absent");
    await mark(jiu, "2026-09-16", s, "absent");
    await mark(jiu, "2026-09-21", s, "absent");
    expect(await streakOf(s.id)).toBeDefined();

    await clientsService.update(s.id, { status: "inactive" });
    expect(await streakOf(s.id)).toBeUndefined();

    const dropin = await createStudent("Visitante");
    await mark(jiu, "2026-09-14", dropin, "absent");
    await mark(jiu, "2026-09-16", dropin, "absent");
    await mark(jiu, "2026-09-21", dropin, "absent");
    expect(await streakOf(dropin.id)).toBeUndefined();
  });

  it("ordena por mais faltas e depois por nome", async () => {
    const zeca = await enrolledStudent("Zeca", [jiu, muay]);
    const ana = await enrolledStudent("Ana", [jiu]);
    const beto = await enrolledStudent("Beto", [jiu]);
    for (const s of [ana, beto, zeca]) {
      await mark(jiu, "2026-09-14", s, "absent");
      await mark(jiu, "2026-09-16", s, "absent");
      await mark(jiu, "2026-09-21", s, "absent");
    }
    await mark(muay, "2026-09-22", zeca, "absent");

    const rows = await turmasService.listAbsenceStreaks();
    expect(rows.map((r) => `${r.studentName} ${r.streak}`)).toEqual(["Zeca 4", "Ana 3", "Beto 3"]);
  });
});

describe("listEnrolledModalities", () => {
  beforeEach(() => resetAcademy());

  it("um par por aluno e modalidade, so de matricula ativa", async () => {
    const carlos = (await createInstructor("Carlos")).id;
    const a = await createClass({ name: "Jiu A", instructorId: carlos, slots: [MON] });
    const b = await createClass({ name: "Jiu B", instructorId: carlos, slots: [WED] });
    const c = await createClass({ name: "Muay", instructorId: carlos, slots: [TUE] });
    for (const [g, modalityId] of [[a, "mod-jiu"], [b, "mod-jiu"], [c, "mod-muay"]] as const) {
      store.classGroups.find((x) => x.id === g.id)!.modalityId = modalityId;
    }
    const s = await enrolledStudent("Bruno", [a, b, c]);
    store.enrollments.find((e) => e.studentId === s.id && e.classGroupId === c.id)!.status = "canceled";

    expect(await turmasService.listEnrolledModalities()).toEqual([{ studentId: s.id, modalityId: "mod-jiu" }]);
  });
});
