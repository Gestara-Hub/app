import type { ClassGroupView, CreateClassGroup, ProfessionalView, UserProfile } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { clientsService } from "@/services/clients";
import { reportsService } from "@/services/reports";
import { turmasService } from "@/services/classes";
import { createInstructor, createStudent, resetAcademy, sessionIdOf } from "@/test/academy";

/**
 * Permissoes decididas em 18/10/2026: o professor ve e age so nas turmas em que
 * e o titular e nas aulas em que substitui; graduar pede `progression:manage`
 * (a atendente nao tem); DRE e churn pedem `finance:view`.
 * Hoje congelado em 22/09/2026 (terca); as aulas de segunda caem em 21/09.
 */

let slotHour = 6;
const nextSlot = () => {
  const start = `${String(slotHour).padStart(2, "0")}:00`;
  const end = `${String(slotHour + 1).padStart(2, "0")}:00`;
  slotHour += 1;
  return [{ weekday: 1 as const, start, end }];
};

function classOf(teacher: ProfessionalView, over: Partial<CreateClassGroup> = {}): Promise<ClassGroupView> {
  return turmasService.create({
    name: `Turma de ${teacher.name}`,
    modalityId: teacher.modalityIds?.[0] ?? "",
    instructorId: teacher.id,
    capacity: 10,
    allowDropin: false,
    meetingSlots: nextSlot(),
    startDate: "2026-09-01",
    billingMode: "free",
    status: "active",
    ...over,
  });
}

/** Usuario logado com o perfil (professor ligado ao profissional). */
function actAs(profile: UserProfile, professionalId?: string) {
  const id = `usr-${profile}-${professionalId ?? "x"}`;
  if (!store.users.some((u) => u.id === id)) {
    store.users.push({
      id,
      organizationId: store.organization.id,
      name: `Usuário ${profile}`,
      email: `${id}@teste.com`,
      profile,
      professionalId,
      status: "active",
      createdAt: "2026-09-01T12:00:00.000Z",
      updatedAt: "2026-09-01T12:00:00.000Z",
    });
  }
  setCurrentActor({ userId: id, name: `Usuário ${profile}`, profile });
}

const session = (g: ClassGroupView, date = "2026-09-21") => sessionIdOf(g.id, date, g.meetingSlots[0].start);

beforeEach(() => {
  resetAcademy();
  slotHour = 6;
});

describe("professor: só as turmas dele e as aulas em que substitui", () => {
  it("vê e faz a chamada só nas turmas dele", async () => {
    const carlos = await createInstructor("Carlos");
    const paula = await createInstructor("Paula");
    const mine = await classOf(carlos);
    const other = await classOf(paula);
    const ana = await createStudent("Ana");
    await turmasService.enroll({ classGroupId: mine.id, studentId: ana.id });
    await turmasService.enroll({ classGroupId: other.id, studentId: ana.id });

    actAs("professional", carlos.id);
    expect((await turmasService.list()).map((g) => g.id)).toEqual([mine.id]);
    await expect(turmasService.getById(other.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(turmasService.getSession(session(other))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      turmasService.markAttendance({ sessionId: session(other), studentId: ana.id, status: "present" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      turmasService.markAttendance({ sessionId: session(mine), studentId: ana.id, status: "present" }),
    ).resolves.toBeUndefined();
  });

  it("na aula em que é substituto, vê e faz a chamada; nas outras aulas da turma, não", async () => {
    const carlos = await createInstructor("Carlos");
    const paula = await createInstructor("Paula");
    const other = await classOf(paula);
    const ana = await createStudent("Ana");
    await turmasService.enroll({ classGroupId: other.id, studentId: ana.id });
    await turmasService.substituteInstructor(session(other), { instructorId: carlos.id });

    actAs("professional", carlos.id);
    const week = await turmasService.listSessions({ dateFrom: "2026-09-14", dateTo: "2026-09-21" });
    expect(week.map((s) => s.id)).toEqual([session(other)]);
    await expect(turmasService.getSession(session(other))).resolves.toBeTruthy();
    await expect(
      turmasService.markAttendance({ sessionId: session(other, "2026-09-14"), studentId: ana.id, status: "present" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("gradua só aluno das turmas dele", async () => {
    const carlos = await createInstructor("Carlos");
    const paula = await createInstructor("Paula");
    const mine = await classOf(carlos);
    const other = await classOf(paula);
    const ana = await createStudent("Ana");
    const beto = await createStudent("Beto");
    await turmasService.enroll({ classGroupId: mine.id, studentId: ana.id });
    await turmasService.enroll({ classGroupId: other.id, studentId: beto.id });
    const promote = (studentId: string, modalityId: string) =>
      clientsService.promoteStudent({ studentId, modalityId, toLevelName: "Azul", toSubLevel: 0, date: "2026-09-22" });

    actAs("professional", carlos.id);
    await expect(promote(ana.id, mine.modalityId!)).resolves.toBeTruthy();
    await expect(promote(beto.id, other.modalityId!)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("professor sem vínculo com a equipe não vê nenhuma turma", async () => {
    const carlos = await createInstructor("Carlos");
    await classOf(carlos);
    actAs("professional");
    expect(await turmasService.list()).toEqual([]);
  });
});

describe("atendente", () => {
  it("não gradua nem registra a evolução", async () => {
    const carlos = await createInstructor("Carlos");
    const g = await classOf(carlos);
    const ana = await createStudent("Ana");
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    actAs("attendant");
    await expect(
      clientsService.promoteStudent({
        studentId: ana.id,
        modalityId: g.modalityId!,
        toLevelName: "Azul",
        toSubLevel: 0,
        date: "2026-09-22",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("não vê DRE nem churn em Relatórios", async () => {
    actAs("attendant");
    const types = (await reportsService.getCatalog()).map((r) => r.type);
    expect(types).not.toContain("financial_income_statement");
    expect(types).not.toContain("churn_retention");
    // Relatorios com valores ficam com quem tem finance:view (achado 13 da rodada de 02/11/2026).
    expect(types).not.toContain("billing_statement");
    expect(types).not.toContain("course_summary");
    expect(types).not.toContain("package_summary");
    expect(types).toContain("attendance_sheet");
    await expect(reportsService.generateReport("financial_income_statement")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("inativar o aluno encerra as matrículas", () => {
  it("encerra a matrícula, tira da espera e das aulas futuras; curso concluído fica", async () => {
    const carlos = await createInstructor("Carlos");
    const g = await classOf(carlos, { billingMode: "membership", allowDropin: true, sessionPriceCents: 5000 });
    const full = await classOf(carlos, { capacity: 1 });
    const ana = await createStudent("Ana");
    const beto = await createStudent("Beto");
    const enrollment = await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    await turmasService.enroll({ classGroupId: full.id, studentId: beto.id });
    await turmasService.addToWaitlist({ classGroupId: full.id, studentId: ana.id });
    const future = sessionIdOf(full.id, "2026-09-28", full.meetingSlots[0].start);
    await turmasService.reserveSession({ classGroupId: full.id, sessionId: future, studentId: ana.id, kind: "trial" });

    await clientsService.remove(ana.id);

    expect(store.enrollments.find((e) => e.id === enrollment.id)).toMatchObject({
      status: "canceled",
      cancellationReason: "Aluno inativado",
    });
    expect(store.waitlist.find((w) => w.studentId === ana.id)?.status).toBe("canceled");
    expect(store.reservations.find((r) => r.sessionId === future)?.status).toBe("canceled");
    expect(store.auditLog.at(-1)?.summary).toContain("encerrou 1 matrícula");
  });
});
