import type { Charge, EventView } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { eventsService } from "@/services/events";
import { createInstructor, createStudent, resetAcademy } from "@/test/academy";

/**
 * Eventos e seminarios (doc product/29, fase 1): cadastro com dias soltos,
 * inscricao com parcelas e lote, lista de espera quando lota, cancelamento
 * com a regra do curso, chamada por dia e escopo do professor. Hoje nos
 * testes: 22/09/2026.
 */

const plain = (text: string) => text.replace(/ /g, " ");
const lastAudit = () => plain(store.auditLog.at(-1)?.summary ?? "");
const chargesOf = (studentId: string): Charge[] =>
  store.charges.filter((c) => c.kind === "event" && c.studentId === studentId).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
const brief = (c: Charge) => `${c.dueDate} ${c.amountCents} ${c.status}`;

const DAYS = [
  { date: "2026-10-10", start: "09:00", end: "12:00" },
  { date: "2026-10-10", start: "14:00", end: "17:00" },
  { date: "2026-10-11", start: "09:00", end: "12:00" },
];

async function seminar(overrides: Partial<Parameters<typeof eventsService.create>[0]> = {}): Promise<EventView> {
  return eventsService.create({
    name: "Seminário do Sensei",
    guestInstructorName: "Sensei Kenji",
    guestInstructorOrigin: "Curitiba",
    billingMode: "fixed",
    priceCents: 30000,
    maxInstallments: 3,
    earlyBirdPriceCents: 25000,
    earlyBirdUntil: "2026-09-30",
    capacity: 2,
    sessions: DAYS,
    ...overrides,
  });
}

beforeEach(() => resetAcademy());

describe("evento: cadastro", () => {
  it("cria com dias soltos, convidado pelo nome, situacao, horas e preco sugerido do lote", async () => {
    const event = await seminar();
    expect(event.isGuestInstructor).toBe(true);
    expect(event.instructorName).toBe("Sensei Kenji");
    expect(event.sessions).toHaveLength(3);
    expect(event.firstDate).toBe("2026-10-10");
    expect(event.lastDate).toBe("2026-10-11");
    expect(event.stage).toBe("upcoming");
    expect(event.totalHours).toBe(9);
    expect(event.earlyBirdActive).toBe(true);
    expect(event.suggestedPriceCents).toBe(25000);
    expect(event.availableSpots).toBe(2);
    expect(lastAudit()).toContain("criou o evento Seminário do Sensei (3 dias)");
  });

  it("exige quem conduz, ao menos um dia e o valor da forma escolhida", async () => {
    await expect(seminar({ guestInstructorName: undefined })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(seminar({ sessions: [] })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(seminar({ priceCents: undefined })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(seminar({ earlyBirdPriceCents: 40000 })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      seminar({ sessions: [{ date: "2026-10-10", start: "09:00", end: "12:00" }, { date: "2026-10-10", start: "11:00", end: "13:00" }] }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("instrutor da equipe limpa o convidado; evento por dia e sem cobranca tiram o que nao vale", async () => {
    const instructor = await createInstructor("Prof Ana");
    const event = await seminar({ instructorId: instructor.id });
    expect(event.isGuestInstructor).toBe(false);
    expect(event.instructorName).toBe("Prof Ana");
    expect(event.guestInstructorName).toBeUndefined();
    const free = await seminar({ billingMode: "free" });
    expect(free.priceCents).toBeUndefined();
    expect(free.suggestedPriceCents).toBe(0);
  });

  it("editar: dia futuro muda ou sai, dia ja feito nao sai", async () => {
    const event = await seminar({ sessions: [{ date: "2026-09-20", start: "09:00", end: "12:00" }, ...DAYS] });
    expect(event.stage).toBe("ongoing");
    const [done, ...future] = event.sessions;
    const updated = await eventsService.update(event.id, {
      name: "Seminário de Outubro",
      sessions: [{ id: done.id, date: done.date, start: done.start, end: done.end }, { id: future[0].id, date: "2026-10-12", start: "10:00", end: "12:00" }],
    });
    expect(updated.name).toBe("Seminário de Outubro");
    expect(updated.sessions.map((s) => `${s.date} ${s.start}`)).toEqual(["2026-09-20 09:00", "2026-10-12 10:00"]);
    await expect(eventsService.update(event.id, { sessions: [{ date: "2026-10-20", start: "09:00", end: "12:00" }] })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });
});

describe("evento: inscricao e cobranca", () => {
  it("inscricao sugere o lote, parcela como o curso e lotado vai para a espera", async () => {
    const event = await seminar();
    const ana = await createStudent("Ana");
    const bia = await createStudent("Bia");
    const caio = await createStudent("Caio");

    const first = await eventsService.register({ eventId: event.id, studentId: ana.id });
    expect(first.status).toBe("confirmed");
    expect(first.amountCents).toBe(25000);
    expect(chargesOf(ana.id).map(brief)).toEqual(["2026-09-22 25000 pending"]);
    expect(plain(lastAudit())).toContain("inscreveu Ana no evento Seminário do Sensei (R$ 250,00)");

    const second = await eventsService.register({
      eventId: event.id,
      studentId: bia.id,
      payment: { amountCents: 30000, installments: 3, firstDueDate: "2026-10-05" },
    });
    expect(second.installments).toBe(3);
    expect(chargesOf(bia.id).map(brief)).toEqual(["2026-10-05 10000 pending", "2026-11-05 10000 pending", "2026-12-05 10000 pending"]);
    expect(chargesOf(bia.id).every((c) => c.eventId === event.id && c.eventRegistrationId === second.id && c.description === event.name)).toBe(true);

    const third = await eventsService.register({ eventId: event.id, studentId: caio.id });
    expect(third.status).toBe("waitlist");
    expect(chargesOf(caio.id)).toEqual([]);
    const view = await eventsService.getById(event.id);
    expect([view.confirmedCount, view.waitlistCount, view.isFull]).toEqual([2, 1, true]);

    await expect(eventsService.register({ eventId: event.id, studentId: ana.id })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      eventsService.register({ eventId: event.id, studentId: ana.id, payment: { amountCents: 30000, installments: 6, firstDueDate: "2026-10-05" } }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("cancelar inscricao: paga fica, futuras saem, vencida continua; espera promove quando abre vaga", async () => {
    const event = await seminar();
    const ana = await createStudent("Ana");
    const bia = await createStudent("Bia");
    const caio = await createStudent("Caio");
    const anaReg = await eventsService.register({
      eventId: event.id,
      studentId: ana.id,
      payment: { amountCents: 30000, installments: 3, firstDueDate: "2026-09-10" },
    });
    await eventsService.register({ eventId: event.id, studentId: bia.id });
    const caioReg = await eventsService.register({ eventId: event.id, studentId: caio.id });
    expect(caioReg.status).toBe("waitlist");

    const [first, second] = chargesOf(ana.id);
    first.status = "paid";
    second.status = "overdue";
    second.dueDate = "2026-09-20";
    await expect(eventsService.promoteFromWaitlist(caioReg.id)).rejects.toMatchObject({ code: "VALIDATION" });

    await eventsService.cancelRegistration(anaReg.id, "Desistiu");
    expect(chargesOf(ana.id).map(brief)).toEqual(["2026-09-10 10000 paid", "2026-09-20 10000 overdue", "2026-11-10 10000 canceled"]);
    expect(chargesOf(ana.id)[2].canceledBy).toBe("system");
    expect(lastAudit()).toContain("cancelou a inscrição de Ana no evento Seminário do Sensei e 1 parcela futura");

    const promoted = await eventsService.promoteFromWaitlist(caioReg.id, { amountCents: 20000, installments: 2, firstDueDate: "2026-10-01" });
    expect(promoted.status).toBe("confirmed");
    expect(chargesOf(caio.id).map(brief)).toEqual(["2026-10-01 10000 pending", "2026-11-01 10000 pending"]);
    const list = await eventsService.listRegistrations(event.id);
    expect(list.map((r) => `${r.studentName} ${r.status}`)).toEqual(["Bia confirmed", "Caio confirmed", "Ana canceled"]);
  });

  it("por dia: inscricao nos dias escolhidos gera uma cobranca por dia", async () => {
    const event = await seminar({ billingMode: "per_day", dayPriceCents: 8000, capacity: undefined });
    const ana = await createStudent("Ana");
    const [day1, day2] = event.sessions;
    const reg = await eventsService.register({ eventId: event.id, studentId: ana.id, scope: "days", sessionIds: [day1.id, day2.id] });
    expect(reg.scope).toBe("days");
    expect(reg.amountCents).toBe(16000);
    const charges = chargesOf(ana.id);
    expect(charges.map((c) => `${c.sessionId === day1.id || c.sessionId === day2.id} ${c.amountCents} ${c.description}`)).toEqual([
      "true 8000 Seminário do Sensei · 10/10",
      "true 8000 Seminário do Sensei · 10/10",
    ]);
    const full = await eventsService.register({ eventId: event.id, studentId: (await createStudent("Bia")).id });
    expect(full.amountCents).toBe(24000);
    const fixed = await seminar();
    await expect(eventsService.register({ eventId: fixed.id, studentId: ana.id, scope: "days", sessionIds: [fixed.sessions[0].id] })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("sem cobranca nao gera parcela; evento cancelado cancela inscricoes e parcelas futuras", async () => {
    const event = await seminar({ billingMode: "free", capacity: undefined });
    const ana = await createStudent("Ana");
    const bia = await createStudent("Bia");
    await eventsService.register({ eventId: event.id, studentId: ana.id });
    expect(chargesOf(ana.id)).toEqual([]);
    const paid = await seminar({ capacity: undefined });
    await eventsService.register({ eventId: paid.id, studentId: bia.id, payment: { amountCents: 30000, installments: 2, firstDueDate: "2026-10-05" } });
    const canceled = await eventsService.cancelEvent(paid.id, "Convidado não pôde vir");
    expect(canceled.status).toBe("canceled");
    expect(canceled.sessions.every((s) => s.status === "canceled")).toBe(true);
    expect(chargesOf(bia.id).map((c) => c.status)).toEqual(["canceled", "canceled"]);
    expect((await eventsService.listRegistrations(paid.id))[0].status).toBe("canceled");
    expect(lastAudit()).toContain("cancelou o evento Seminário do Sensei e 1 inscrição (2 parcelas futuras canceladas): Convidado não pôde vir");
    await expect(eventsService.register({ eventId: paid.id, studentId: ana.id })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("evento: chamada e calendario", () => {
  it("marca presenca so no dia ou depois, so de quem esta inscrito no dia", async () => {
    const event = await seminar({
      billingMode: "per_day",
      dayPriceCents: 5000,
      capacity: undefined,
      sessions: [{ date: "2026-09-21", start: "09:00", end: "12:00" }, { date: "2026-09-28", start: "09:00", end: "12:00" }],
    });
    const [past, future] = event.sessions;
    const ana = await createStudent("Ana");
    const bia = await createStudent("Bia");
    const anaReg = await eventsService.register({ eventId: event.id, studentId: ana.id });
    const biaReg = await eventsService.register({ eventId: event.id, studentId: bia.id, scope: "days", sessionIds: [future.id] });

    const detail = await eventsService.markEventAttendance({ sessionId: past.id, registrationId: anaReg.id, status: "present" });
    expect(detail.roster.map((r) => `${r.studentName} ${r.attendance ?? "-"}`)).toEqual(["Ana present"]);
    expect(detail.presentCount).toBe(1);
    await expect(eventsService.markEventAttendance({ sessionId: past.id, registrationId: biaReg.id, status: "present" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(eventsService.markEventAttendance({ sessionId: future.id, registrationId: anaReg.id, status: "present" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    const cleared = await eventsService.clearEventAttendance({ sessionId: past.id, registrationId: anaReg.id });
    expect(cleared.presentCount).toBe(0);
    const regs = await eventsService.listRegistrations(event.id);
    expect(regs.find((r) => r.studentName === "Ana")?.presentCount).toBe(0);
  });

  it("dias no periodo do calendario; dia cancelado some; lista poe encerrados no fim", async () => {
    const soon = await seminar({ capacity: undefined });
    const gone = await seminar({ name: "Workshop passado", sessions: [{ date: "2026-09-01", start: "09:00", end: "12:00" }] });
    const sessions = await eventsService.listSessions({ dateFrom: "2026-10-05", dateTo: "2026-10-11" });
    expect(sessions.map((s) => `${s.date} ${s.start} ${s.eventName}`)).toEqual([
      "2026-10-10 09:00 Seminário do Sensei",
      "2026-10-10 14:00 Seminário do Sensei",
      "2026-10-11 09:00 Seminário do Sensei",
    ]);
    await eventsService.cancelSession(soon.sessions[1].id, "Almoço longo");
    expect((await eventsService.listSessions({ dateFrom: "2026-10-05", dateTo: "2026-10-11" })).length).toBe(2);
    const list = await eventsService.list();
    expect(list.map((e) => `${e.name} ${e.stage}`)).toEqual(["Seminário do Sensei upcoming", "Workshop passado finished"]);
    expect((await eventsService.list({ stage: "finished" })).map((e) => e.id)).toEqual([gone.id]);
    expect((await eventsService.list({ search: "kenji" })).length).toBe(2);
  });

  it("professor ve e faz chamada so nos eventos que conduz", async () => {
    const mine = await createInstructor("Prof Ana");
    const other = await createInstructor("Prof Bia");
    const myEvent = await seminar({ name: "Aulão da Ana", instructorId: mine.id, capacity: undefined, sessions: [{ date: "2026-09-22", start: "09:00", end: "12:00" }] });
    const otherEvent = await seminar({ name: "Aulão da Bia", instructorId: other.id, capacity: undefined, sessions: [{ date: "2026-09-22", start: "14:00", end: "17:00" }] });
    const guestEvent = await seminar({ capacity: undefined });
    const ana = await createStudent("Aluna");
    const myReg = await eventsService.register({ eventId: myEvent.id, studentId: ana.id, payment: { amountCents: 0, installments: 1, firstDueDate: "2026-09-22" } });
    const otherReg = await eventsService.register({ eventId: otherEvent.id, studentId: ana.id, payment: { amountCents: 0, installments: 1, firstDueDate: "2026-09-22" } });
    store.users.push({
      id: "usr-prof-ana",
      organizationId: store.organization.id,
      name: "Prof Ana",
      email: "ana@teste.local",
      profile: "professional",
      professionalId: mine.id,
      status: "active",
      createdAt: "2026-09-01T12:00:00.000Z",
      updatedAt: "2026-09-01T12:00:00.000Z",
    });
    setCurrentActor({ userId: "usr-prof-ana", name: "Prof Ana", profile: "professional" });

    expect((await eventsService.list()).map((e) => e.id)).toEqual([myEvent.id]);
    expect((await eventsService.listSessions({ dateFrom: "2026-09-01", dateTo: "2026-09-30" })).map((s) => s.eventName)).toEqual(["Aulão da Ana"]);
    await expect(eventsService.getById(otherEvent.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(eventsService.getById(guestEvent.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await eventsService.markEventAttendance({ sessionId: myEvent.sessions[0].id, registrationId: myReg.id, status: "present" });
    await expect(
      eventsService.markEventAttendance({ sessionId: otherEvent.sessions[0].id, registrationId: otherReg.id, status: "present" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
