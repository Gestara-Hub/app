import type { AttendanceStatus, ClassGroupView, Client } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billing";
import { clientsService } from "@/services/clients";
import { communicationService } from "@/services/communication";
import { turmasService } from "@/services/classes";
import { buildReminders } from "@/features/communication/reminders";
import { createClass, createInstructor, createPlan, enrollStudent, resetAcademy, sessionIdOf } from "@/test/academy";

/**
 * Dados dos lembretes no servidor (doc product/25): o que o painel recebe,
 * pelo perfil. Com WORLD_SLICE_CHECK=1 a leitura tambem e conferida contra o
 * espaco inteiro (recorte).
 */

// Hoje (22/09/2026, terca). Turma seg e qua 19h desde 14/09: 14, 16 e 21/09 ja passaram.
const MON = { weekday: 1 as const, start: "19:00", end: "20:00" };
const WED = { weekday: 3 as const, start: "19:00", end: "20:00" };

let group: ClassGroupView;
let other: ClassGroupView;
let ana: Client;
let bia: Client;

async function mark(g: ClassGroupView, date: string, student: Client, status: AttendanceStatus) {
  await turmasService.markAttendance({ sessionId: sessionIdOf(g.id, date, g.meetingSlots[0].start), studentId: student.id, status });
}

function loginAsTeacher(professionalId: string) {
  const id = `usr-prof-${professionalId}`;
  store.users.push({
    id, organizationId: store.organization.id, name: "Prof", email: `${id}@teste.local`, profile: "professional",
    professionalId, status: "active", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
  });
  setCurrentActor({ userId: id, name: "Prof", profile: "professional" });
}

beforeEach(async () => {
  resetAcademy();
  const carlos = await createInstructor("Carlos");
  group = await createClass({ name: "Adulto", instructorId: carlos.id, slots: [MON, WED] });
  other = await createClass({ name: "Kids", instructorId: (await createInstructor("Dani")).id, slots: [MON, WED] });
  const plan = await createPlan("monthly", 15000);
  ana = await enrollStudent({ name: "Ana", plan, startDate: "2026-08-01" });
  bia = await clientsService.create({ name: "Bia", phone: "11988880000", birthDate: "2001-09-22", status: "active" });
  await turmasService.enroll({ classGroupId: group.id, studentId: ana.id });
  await turmasService.enroll({ classGroupId: other.id, studentId: bia.id });
  for (const date of ["2026-09-14", "2026-09-16", "2026-09-21"]) await mark(group, date, ana, "absent");
});

describe("dados dos lembretes", () => {
  it("dono: cobranças em aberto, faltas seguidas e aniversário viram lembretes", async () => {
    const src = await communicationService.getReminderSources();
    expect(src.canBilling).toBe(true);
    expect(src.charges.some((c) => c.studentId === ana.id && (c.status === "overdue" || c.status === "pending"))).toBe(true);
    expect(src.absenceStreaks.map((s) => s.studentName)).toEqual(["Ana"]);
    const keys = buildReminders(src, { today: "2026-09-22" }).map((g) => g.key);
    expect(keys).toContain("absence");
    expect(keys).toContain("birthday");
  });

  it("assinatura pausada: a cobrança em aberto não vira lembrete", async () => {
    await clientsService.update(ana.id, { membershipStatus: "paused" });
    const src = await communicationService.getReminderSources();
    expect(src.charges.filter((c) => c.studentId === ana.id && (c.status === "pending" || c.status === "overdue"))).toEqual([]);
    const groups = buildReminders(src, { today: "2026-09-22" });
    expect(groups.filter((g) => g.category === "billing").flatMap((g) => g.items).filter((i) => i.studentId === ana.id)).toEqual([]);
  });

  it("aluno menor: a cobrança vai para o telefone do responsável, falando do aluno", async () => {
    await clientsService.update(ana.id, {
      birthDate: "2015-03-10",
      guardians: [{ name: "Mãe da Ana", phone: "11955556666", financial: true }],
    });
    const src = await communicationService.getReminderSources();
    const groups = buildReminders(src, { today: "2026-09-22" });
    const items = groups.filter((g) => g.category === "billing").flatMap((g) => g.items).filter((i) => i.studentId === ana.id);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item).toMatchObject({ phone: "11955556666", recipientName: "Mãe da Ana", aboutStudent: "Ana" });
    }
    // Falta seguida e aniversario seguem pelo aluno (nao entram nessa regra).
    const absence = groups.find((g) => g.key === "absence")?.items.find((i) => i.studentId === ana.id);
    expect(absence?.recipientName).toBeUndefined();
  });

  it("mensagem aberta no WhatsApp tira o lembrete", async () => {
    await communicationService.registerAssistedMessage({ recipientName: "Bia", recipientPhone: "11988880000", trigger: "birthday_greeting", clientId: bia.id, content: "Parabéns!" });
    const groups = buildReminders(await communicationService.getReminderSources(), { today: "2026-09-22" });
    // Fica na tela no dia (confirmacao), sem contar como pendencia.
    const birthday = groups.find((g) => g.key === "birthday");
    expect(birthday?.pending).toBe(0);
    expect(birthday?.items[0].done).toBe("Parabéns enviado hoje");
    // No dia seguinte, some.
    expect(buildReminders(await communicationService.getReminderSources(), { today: "2026-09-23" }).find((g) => g.key === "birthday")?.pending ?? 0).toBe(0);
  });

  it("professor: só os alunos das turmas dele e nenhuma cobrança", async () => {
    loginAsTeacher(group.instructorId);
    const src = await communicationService.getReminderSources();
    expect(src.canBilling).toBe(false);
    expect(src.charges).toEqual([]);
    expect(src.packages).toEqual([]);
    expect(src.students.map((s) => s.name)).toEqual(["Ana"]);
    // So o que o professor percebe primeiro: faltas seguidas dos alunos dele; nada de cobranca.
    const groups = buildReminders(src, { today: "2026-09-22" });
    expect(groups.map((g) => g.key)).toContain("absence");
    expect(groups.some((g) => g.category === "billing")).toBe(false);
    expect(groups.flatMap((g) => g.items).map((i) => i.studentName)).not.toContain("Bia");
  });

  it("pagou: a cobrança sai dos lembretes de cobrança", async () => {
    const open = (await communicationService.getReminderSources()).charges.filter((c) => c.studentId === ana.id && c.status !== "paid");
    for (const c of open) await billingService.markPaid(c.id, "pix");
    const groups = buildReminders(await communicationService.getReminderSources(), { today: "2026-09-22" });
    expect(groups.filter((g) => g.category === "billing").flatMap((g) => g.items).filter((i) => i.studentId === ana.id)).toEqual([]);
  });
});
