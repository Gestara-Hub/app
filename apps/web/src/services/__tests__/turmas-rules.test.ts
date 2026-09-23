import { beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billingService";
import { clientsService } from "@/services/clientsService";
import { turmasService } from "@/services/turmasService";
import { createClass, createInstructor, createStudent, resetAcademy, sessionIdOf } from "@/test/academy";

// Hoje (22/09/2026) e terca; 28/09 e a proxima segunda.
const TUE = { weekday: 2 as const, start: "17:00", end: "18:00" };
const MON = { weekday: 1 as const, start: "17:00", end: "18:00" };

describe("status da aula de hoje", () => {
  beforeEach(() => resetAcademy());

  it("é agendada antes do fim e concluída depois do horário de fim", async () => {
    const g = await createClass({ instructorId: (await createInstructor("Carlos")).id, slots: [TUE] });
    const sid = sessionIdOf(g.id, "2026-09-22", "17:00");

    vi.setSystemTime(new Date("2026-09-22T16:00:00"));
    expect((await turmasService.getSession(sid)).status).toBe("scheduled");
    vi.setSystemTime(new Date("2026-09-22T17:30:00"));
    expect((await turmasService.getSession(sid)).status).toBe("scheduled");
    vi.setSystemTime(new Date("2026-09-22T18:30:00"));
    expect((await turmasService.getSession(sid)).status).toBe("done");
    const [listed] = await turmasService.listSessions({ classGroupId: g.id, dateFrom: "2026-09-22", dateTo: "2026-09-22" });
    expect(listed.status).toBe("done");
  });
});

describe("matrícula feita à noite", () => {
  beforeEach(() => resetAcademy());

  it("matrícula às 22h (horário local) entra na lista da aula daquele dia", async () => {
    const previousTz = process.env.TZ;
    process.env.TZ = "America/Sao_Paulo"; // 22h local = 01h UTC do dia seguinte
    try {
      const g = await createClass({ instructorId: (await createInstructor("Carlos")).id, slots: [TUE] });
      const s = await createStudent("Noturno");
      vi.setSystemTime(new Date("2026-09-22T22:00:00"));
      const e = await turmasService.enroll({ classGroupId: g.id, studentId: s.id });
      expect(new Date(e.enrolledAt).getUTCDate()).toBe(23);
      const session = await turmasService.getSession(sessionIdOf(g.id, "2026-09-22", "17:00"));
      expect(session.roster.map((r) => r.studentName)).toEqual(["Noturno"]);
    } finally {
      process.env.TZ = previousTz;
    }
  });
});

describe("aula avulsa e experimental", () => {
  beforeEach(() => resetAcademy());

  it("turma sem avulsa recusa avulsa e aceita experimental", async () => {
    const g = await createClass({ instructorId: (await createInstructor("Carlos")).id, slots: [MON], allowDropin: false });
    const s = await createStudent("Visitante");
    const sid = sessionIdOf(g.id, "2026-09-28", "17:00");
    await expect(
      turmasService.reserveSession({ classGroupId: g.id, sessionId: sid, studentId: s.id, kind: "dropin" }),
    ).rejects.toMatchObject({ code: "VALIDATION", message: "Esta turma não aceita aula avulsa." });
    expect(store.charges).toHaveLength(0);

    const trial = await turmasService.reserveSession({ classGroupId: g.id, sessionId: sid, studentId: s.id, kind: "trial" });
    expect(trial).toMatchObject({ kind: "trial", status: "reserved", chargeId: undefined });
    expect(store.charges).toHaveLength(0);
  });

  it("avulsa de R$ 0 não gera cobrança nem chargeId", async () => {
    const g = await createClass({ instructorId: (await createInstructor("Carlos")).id, slots: [MON], sessionPriceCents: 0 });
    const s = await createStudent("Gratis");
    const r = await turmasService.reserveSession({
      classGroupId: g.id,
      sessionId: sessionIdOf(g.id, "2026-09-28", "17:00"),
      studentId: s.id,
      kind: "dropin",
    });
    expect(r.chargeId).toBeUndefined();
    expect(store.reservations.find((x) => x.id === r.id)?.chargeId).toBeUndefined();
    expect(store.charges).toHaveLength(0);
  });

  it("remover o avulso da aula cancela a cobrança como sistema (e ela não reabre)", async () => {
    const g = await createClass({ instructorId: (await createInstructor("Carlos")).id, slots: [MON] });
    const s = await createStudent("Avulso");
    const sid = sessionIdOf(g.id, "2026-09-28", "17:00");
    const r = await turmasService.reserveSession({ classGroupId: g.id, sessionId: sid, studentId: s.id, kind: "dropin" });
    await turmasService.cancelReservation({ sessionId: sid, studentId: s.id });
    expect(store.charges.find((c) => c.id === r.chargeId)).toMatchObject({ status: "canceled", canceledBy: "system" });
    await expect(billingService.reopenCharge(r.chargeId!)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("lista de espera", () => {
  beforeEach(() => resetAcademy());

  const positions = async (classGroupId: string) =>
    (await turmasService.listWaitlist(classGroupId)).map((w) => `${w.position} ${w.studentName}`);

  it("posições nunca se repetem depois de remover e promover (sempre 1..n)", async () => {
    const g = await createClass({ instructorId: (await createInstructor("Carlos")).id, slots: [MON] });
    const entries = [];
    for (const name of ["A", "B", "C", "D"]) {
      entries.push(await turmasService.addToWaitlist({ classGroupId: g.id, studentId: (await createStudent(name)).id }));
    }
    expect(await positions(g.id)).toEqual(["1 A", "2 B", "3 C", "4 D"]);

    await turmasService.removeFromWaitlist(entries[1].id);
    expect(await positions(g.id)).toEqual(["1 A", "2 C", "3 D"]);

    await turmasService.promoteFromWaitlist(entries[0].id);
    expect(await positions(g.id)).toEqual(["1 C", "2 D"]);

    await turmasService.addToWaitlist({ classGroupId: g.id, studentId: (await createStudent("E")).id });
    expect(await positions(g.id)).toEqual(["1 C", "2 D", "3 E"]);
  });

  it("promover duas vezes cria uma única matrícula", async () => {
    const g = await createClass({ instructorId: (await createInstructor("Carlos")).id, slots: [MON] });
    const s = await createStudent("A");
    const w = await turmasService.addToWaitlist({ classGroupId: g.id, studentId: s.id });
    await turmasService.promoteFromWaitlist(w.id);
    await expect(turmasService.promoteFromWaitlist(w.id)).rejects.toMatchObject({
      message: "Este aluno já saiu da lista de espera.",
    });
    expect(store.enrollments.filter((e) => e.studentId === s.id && e.status === "active")).toHaveLength(1);
  });

  it("promover recusa aluno inativo", async () => {
    const g = await createClass({ instructorId: (await createInstructor("Carlos")).id, slots: [MON] });
    const s = await createStudent("Inativo");
    const w = await turmasService.addToWaitlist({ classGroupId: g.id, studentId: s.id });
    await clientsService.remove(s.id);
    await expect(turmasService.promoteFromWaitlist(w.id)).rejects.toMatchObject({
      message: "Inativo está inativo. Reative o aluno antes de matricular.",
    });
    expect(store.enrollments).toHaveLength(0);
  });

  it("promover recusa aluno já matriculado", async () => {
    const g = await createClass({ instructorId: (await createInstructor("Carlos")).id, slots: [MON] });
    const s = await createStudent("Duplo");
    const w = await turmasService.addToWaitlist({ classGroupId: g.id, studentId: s.id });
    await turmasService.enroll({ classGroupId: g.id, studentId: s.id });
    await expect(turmasService.promoteFromWaitlist(w.id)).rejects.toMatchObject({
      message: "Duplo já está matriculado nesta turma.",
    });
    expect(store.enrollments).toHaveLength(1);
  });

  it("promover recusa conflito de horário do aluno", async () => {
    const g = await createClass({ name: "Jiu", instructorId: (await createInstructor("Carlos")).id, slots: [MON] });
    const other = await createClass({ name: "Boxe", instructorId: (await createInstructor("Bruno")).id, slots: [MON] });
    const s = await createStudent("Ocupado");
    await turmasService.enroll({ classGroupId: other.id, studentId: s.id });
    const w = await turmasService.addToWaitlist({ classGroupId: g.id, studentId: s.id });
    await expect(turmasService.promoteFromWaitlist(w.id)).rejects.toMatchObject({ code: "CLASS_SCHEDULE_CONFLICT" });
    expect(store.waitlist.find((x) => x.id === w.id)?.status).toBe("waiting");
  });
});

describe("conflitos do instrutor", () => {
  beforeEach(() => resetAcademy());

  it("reativar turma recusa se o horário do instrutor foi ocupado", async () => {
    const carlos = await createInstructor("Carlos");
    const old = await createClass({ name: "Antiga", instructorId: carlos.id, slots: [MON] });
    await turmasService.deactivate(old.id);
    await createClass({ name: "Nova", instructorId: carlos.id, slots: [MON] });
    await expect(turmasService.reactivate(old.id)).rejects.toMatchObject({ code: "CLASS_SCHEDULE_CONFLICT" });
    expect(store.classGroups.find((g) => g.id === old.id)?.status).toBe("inactive");
  });

  const DATE = "2026-09-28"; // segunda

  it("substituto não pode ter aula própria sobreposta na data", async () => {
    const ana = await createInstructor("Ana");
    const bruno = await createInstructor("Bruno");
    const g = await createClass({ name: "Jiu", instructorId: ana.id, slots: [MON] });
    await createClass({ name: "Boxe", instructorId: bruno.id, slots: [{ weekday: 1, start: "17:30", end: "18:30" }] });
    await expect(
      turmasService.substituteInstructor(sessionIdOf(g.id, DATE, "17:00"), { instructorId: bruno.id }),
    ).rejects.toMatchObject({ code: "CLASS_SCHEDULE_CONFLICT" });
    expect(store.sessionOverrides ?? []).toHaveLength(0);
  });

  it("substituto não pode estar em outra substituição sobreposta no mesmo dia", async () => {
    const ana = await createInstructor("Ana");
    const bruno = await createInstructor("Bruno");
    const caio = await createInstructor("Caio");
    const g = await createClass({ name: "Jiu", instructorId: ana.id, slots: [MON] });
    const k = await createClass({ name: "Muay", instructorId: caio.id, slots: [MON] });
    await turmasService.substituteInstructor(sessionIdOf(k.id, DATE, "17:00"), { instructorId: bruno.id });
    await expect(
      turmasService.substituteInstructor(sessionIdOf(g.id, DATE, "17:00"), { instructorId: bruno.id }),
    ).rejects.toMatchObject({ code: "CLASS_SCHEDULE_CONFLICT" });
    // Em outra data nao ha conflito.
    await turmasService.substituteInstructor(sessionIdOf(g.id, "2026-10-05", "17:00"), { instructorId: bruno.id });
  });

  it("aceita o substituto quando a aula própria dele naquela data está com outro professor", async () => {
    const ana = await createInstructor("Ana");
    const bruno = await createInstructor("Bruno");
    const caio = await createInstructor("Caio");
    const g = await createClass({ name: "Jiu", instructorId: ana.id, slots: [MON] });
    const own = await createClass({ name: "Boxe", instructorId: bruno.id, slots: [MON] });
    await turmasService.substituteInstructor(sessionIdOf(own.id, DATE, "17:00"), { instructorId: caio.id });
    const detail = await turmasService.substituteInstructor(sessionIdOf(g.id, DATE, "17:00"), {
      instructorId: bruno.id,
    });
    expect(detail).toMatchObject({ instructorId: bruno.id, isSubstitute: true });
  });
});

describe("ocupação no calendário", () => {
  beforeEach(() => resetAcademy());

  it("occupiedCount = matrículas ativas + avulsos + experimentais", async () => {
    const g = await createClass({ instructorId: (await createInstructor("Carlos")).id, slots: [MON], capacity: 10 });
    const sid = sessionIdOf(g.id, "2026-09-28", "17:00");
    for (const name of ["M1", "M2"]) {
      await turmasService.enroll({ classGroupId: g.id, studentId: (await createStudent(name)).id });
    }
    const canceled = await turmasService.enroll({ classGroupId: g.id, studentId: (await createStudent("Saiu")).id });
    await turmasService.cancelEnrollment(canceled.id);
    await turmasService.reserveSession({ classGroupId: g.id, sessionId: sid, studentId: (await createStudent("Avulso")).id, kind: "dropin" });
    await turmasService.reserveSession({ classGroupId: g.id, sessionId: sid, studentId: (await createStudent("Exp")).id, kind: "trial" });

    const sessions = await turmasService.listSessions({ classGroupId: g.id, dateFrom: "2026-09-28", dateTo: "2026-09-28" });
    expect(sessions.map((s) => [s.id, s.occupiedCount])).toEqual([[sid, 4]]);
    const detail = await turmasService.getSession(sid);
    expect(detail.roster).toHaveLength(4);
    expect(detail.availableSpots).toBe(6);
  });
});
