import type { ClassGroupView } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { categoriesService } from "@/services/categoriesService";
import { clientsService } from "@/services/clientsService";
import { professionalsService } from "@/services/professionalsService";
import { turmasService } from "@/services/turmasService";
import { ACADEMY_UNIT, resetAcademy } from "@/test/academy";

const sessionId = (g: ClassGroupView, date: string) => `${g.id}~${date}~17:00`;

async function setupClass(capacity = 2): Promise<ClassGroupView> {
  const modality = await categoriesService.create({ name: "Jiu-Jitsu" });
  const instructor = await professionalsService.create({
    name: "Carlos Silva",
    status: "active",
    workingHours: [],
    serviceIds: [],
    modalityIds: [modality.id],
  });
  // Seg e qua às 17h, desde 14/09/2026 (segunda passada: 21/09; hoje: 22/09).
  return turmasService.create({
    name: "Jiu-Jitsu Adulto",
    modalityId: modality.id,
    instructorId: instructor.id,
    capacity,
    allowDropin: true,
    sessionPriceCents: 4000,
    meetingSlots: [
      { weekday: 1, start: "17:00", end: "18:00" },
      { weekday: 3, start: "17:00", end: "18:00" },
    ],
    startDate: "2026-09-14",
    status: "active",
  });
}

const student = (name: string) =>
  clientsService.create({ name, phone: "11977770000", status: "active" });

describe("turmas e matrículas", () => {
  beforeEach(() => resetAcademy());

  it("turma nasce com a organização e a unidade da sessão", async () => {
    const g = await setupClass();
    expect(g).toMatchObject({ organizationId: "org-academia-x", unitId: ACADEMY_UNIT });
  });

  it("lotação é regra flexível: bloqueia sem confirmação e aceita com ela", async () => {
    const g = await setupClass(1);
    const [a, b] = [await student("A"), await student("B")];
    await turmasService.enroll({ classGroupId: g.id, studentId: a.id });
    await expect(turmasService.enroll({ classGroupId: g.id, studentId: b.id })).rejects.toMatchObject({
      code: "CLASS_FULL",
    });
    await turmasService.enroll({ classGroupId: g.id, studentId: b.id }, { allowOverCapacity: true });
    expect((await turmasService.listEnrollments(g.id)).length).toBe(2);
  });

  it("matrícula e cancelamento entram na auditoria", async () => {
    const g = await setupClass();
    const a = await student("Aluno A");
    const e = await turmasService.enroll({ classGroupId: g.id, studentId: a.id });
    await turmasService.cancelEnrollment(e.id);
    const summaries = store.auditLog.map((x) => x.summary);
    expect(summaries).toContain("Ana Ribeiro matriculou Aluno A na turma Jiu-Jitsu Adulto");
    expect(summaries).toContain("Ana Ribeiro cancelou a matrícula de Aluno A na turma Jiu-Jitsu Adulto");
  });
});

describe("aulas e chamada", () => {
  beforeEach(() => resetAcademy());

  it("lista de chamada de aula passada usa as matrículas vigentes naquela data", async () => {
    const g = await setupClass();
    const early = await student("Antigo");
    const today = await student("Novo");
    const e1 = await turmasService.enroll({ classGroupId: g.id, studentId: early.id });
    await turmasService.enroll({ classGroupId: g.id, studentId: today.id });
    // "Antigo" entrou em 01/09 e saiu hoje; "Novo" entrou hoje.
    store.enrollments.find((e) => e.id === e1.id)!.enrolledAt = "2026-09-01T12:00:00.000Z";
    await turmasService.cancelEnrollment(e1.id);

    const past = await turmasService.getSession(sessionId(g, "2026-09-21"));
    const future = await turmasService.getSession(sessionId(g, "2026-09-23"));
    expect(past.roster.map((r) => r.studentName)).toEqual(["Antigo"]);
    expect(future.roster.map((r) => r.studentName)).toEqual(["Novo"]);
  });

  it("presença só pode ser marcada no dia da aula ou depois", async () => {
    const g = await setupClass();
    const a = await student("A");
    await expect(
      turmasService.markAttendance({ sessionId: sessionId(g, "2026-09-23"), studentId: a.id, status: "present" }),
    ).rejects.toMatchObject({ message: "A chamada só pode ser feita no dia da aula ou depois." });
    await turmasService.markAttendance({ sessionId: sessionId(g, "2026-09-21"), studentId: a.id, status: "present" });
    expect(store.attendances).toHaveLength(1);
  });

  it("aula avulsa gera cobrança na unidade da turma e remover da aula a cancela", async () => {
    const g = await setupClass();
    const a = await student("Avulso");
    const sid = sessionId(g, "2026-09-21");
    await turmasService.reserveSession({ classGroupId: g.id, sessionId: sid, studentId: a.id, kind: "dropin" });
    const charge = store.charges.find((c) => c.kind === "dropin")!;
    expect(charge).toMatchObject({ amountCents: 4000, unitId: ACADEMY_UNIT, status: "pending" });
    await turmasService.cancelReservation({ sessionId: sid, studentId: a.id });
    expect(store.charges.find((c) => c.id === charge.id)?.status).toBe("canceled");
  });
});
