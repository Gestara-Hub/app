import type { ClassGroupView } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { turmasService } from "@/services/classes";
import { createClass, createInstructor, createStudent, resetAcademy, sessionIdOf } from "@/test/academy";

// "Todos vieram" numa gravacao so (doc 19, fase 1). Hoje (22/09/2026) e terca.
const MON = { weekday: 1 as const, start: "19:00", end: "20:00" };

let g: ClassGroupView;

describe("markManyAttendance", () => {
  beforeEach(async () => {
    resetAcademy();
    g = await createClass({ name: "Jiu-Jitsu Noite", instructorId: (await createInstructor("Carlos")).id, slots: [MON] });
  });

  it("marca todos de uma vez e mantém quem já estava marcado", async () => {
    const ana = await createStudent("Ana");
    const bia = await createStudent("Bia");
    const caio = await createStudent("Caio");
    for (const s of [ana, bia, caio]) await turmasService.enroll({ classGroupId: g.id, studentId: s.id });
    const sessionId = sessionIdOf(g.id, "2026-09-21", "19:00");
    await turmasService.markAttendance({ sessionId, studentId: ana.id, status: "absent" });

    await turmasService.markManyAttendance({ sessionId, studentIds: [bia.id, caio.id], status: "present" });

    const marks = Object.fromEntries(
      store.attendances.filter((a) => a.sessionId === sessionId).map((a) => [a.studentId, a.status]),
    );
    expect(marks).toEqual({ [ana.id]: "absent", [bia.id]: "present", [caio.id]: "present" });
  });

  it("aula futura: recusa sem marcar ninguém", async () => {
    const ana = await createStudent("Ana");
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    const future = sessionIdOf(g.id, "2026-09-28", "19:00");
    await expect(turmasService.markManyAttendance({ sessionId: future, studentIds: [ana.id], status: "present" })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(store.attendances.filter((a) => a.sessionId === future)).toHaveLength(0);
  });
});

// Botao "Salvar" da chamada (12/11/2026): toques com status diferentes numa gravacao so.
describe("saveAttendance", () => {
  beforeEach(async () => {
    resetAcademy();
    g = await createClass({ name: "Jiu-Jitsu Noite", instructorId: (await createInstructor("Carlos")).id, slots: [MON] });
  });

  it("grava presença, falta e justificada juntas e desmarca quem veio com null", async () => {
    const ana = await createStudent("Ana");
    const bia = await createStudent("Bia");
    const caio = await createStudent("Caio");
    const duda = await createStudent("Duda");
    for (const s of [ana, bia, caio, duda]) await turmasService.enroll({ classGroupId: g.id, studentId: s.id });
    const sessionId = sessionIdOf(g.id, "2026-09-21", "19:00");
    await turmasService.markAttendance({ sessionId, studentId: duda.id, status: "present" });

    await turmasService.saveAttendance({
      sessionId,
      changes: [
        { studentId: ana.id, status: "present" },
        { studentId: bia.id, status: "absent" },
        { studentId: caio.id, status: "justified" },
        { studentId: duda.id, status: null },
      ],
    });

    const marks = Object.fromEntries(
      store.attendances.filter((a) => a.sessionId === sessionId).map((a) => [a.studentId, a.status]),
    );
    expect(marks).toEqual({ [ana.id]: "present", [bia.id]: "absent", [caio.id]: "justified" });
  });

  it("aula futura: recusa sem gravar nada", async () => {
    const ana = await createStudent("Ana");
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    const future = sessionIdOf(g.id, "2026-09-28", "19:00");
    await expect(
      turmasService.saveAttendance({ sessionId: future, changes: [{ studentId: ana.id, status: "present" }] }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(store.attendances.filter((a) => a.sessionId === future)).toHaveLength(0);
  });
});
