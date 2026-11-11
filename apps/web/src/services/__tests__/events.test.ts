import type { Charge, EventView } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { eventsService } from "@/services/events";
import { financeService } from "@/services/finance";
import { reportsService } from "@/services/reports";
import { subscriptionService } from "@/services/subscription/subscriptionService";
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
    instructors: [{ id: "i-kenji", guestName: "Sensei Kenji", guestOrigin: "Curitiba" }],
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
    expect(event.instructors.map((i) => [i.name, i.isGuest, i.guestOrigin])).toEqual([["Sensei Kenji", true, "Curitiba"]]);
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
    await expect(seminar({ instructors: [] })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(seminar({ instructors: [{ id: "i-x", guestName: "  " }] })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(seminar({ sessions: [] })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(seminar({ priceCents: undefined })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(seminar({ earlyBirdPriceCents: 40000 })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      seminar({ sessions: [{ date: "2026-10-10", start: "09:00", end: "12:00" }, { date: "2026-10-10", start: "11:00", end: "13:00" }] }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("instrutor da equipe limpa o convidado; evento por dia e sem cobranca tiram o que nao vale", async () => {
    const instructor = await createInstructor("Prof Ana");
    const event = await seminar({ instructors: [{ id: "i-ana", professionalId: instructor.id, guestName: "Sobra" }] });
    expect(event.instructors.map((i) => [i.name, i.isGuest, i.guestName])).toEqual([["Prof Ana", false, undefined]]);
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

describe("evento: financeiro", () => {
  it("soma parcelas pagas, em aberto e vencidas e os lancamentos ligados ao evento", async () => {
    const event = await seminar({ capacity: undefined });
    const ana = await createStudent("Ana");
    const bia = await createStudent("Bia");
    await eventsService.register({ eventId: event.id, studentId: ana.id, payment: { amountCents: 30000, installments: 3, firstDueDate: "2026-09-10" } });
    await eventsService.register({ eventId: event.id, studentId: bia.id });
    const [first, second] = chargesOf(ana.id);
    first.status = "paid";
    first.paidAt = "2026-09-10T12:00:00.000Z";
    second.status = "overdue";
    second.dueDate = "2026-09-20";
    const expenses = (await financeService.listCategories({ type: "expense", includeSystem: false }))[0];
    await financeService.createEntry({
      type: "expense",
      categoryId: expenses.id,
      description: "Passagem do sensei",
      amountCents: 80000,
      dueDate: "2026-10-01",
      paidNow: { method: "pix" },
      eventId: event.id,
    });
    await financeService.createEntry({ type: "expense", categoryId: expenses.id, description: "Fora do evento", amountCents: 5000, dueDate: "2026-10-01" });

    const finance = await eventsService.getEventFinance(event.id);
    expect(finance.receivedCents).toBe(10000);
    expect(finance.openCents).toBe(10000 + 10000 + 25000);
    expect(finance.overdueCents).toBe(10000);
    expect(finance.expensesCents).toBe(80000);
    expect(finance.resultCents).toBe(10000 - 80000);
    expect(finance.charges.map((c) => `${c.studentName} ${c.amountCents} ${c.status}`)).toEqual([
      "Ana 10000 paid",
      "Ana 10000 overdue",
      "Bia 25000 pending",
      "Ana 10000 pending",
    ]);
    expect(finance.entries.map((e) => e.description)).toEqual(["Passagem do sensei"]);
    await expect(
      financeService.createEntry({ type: "expense", categoryId: expenses.id, description: "Sem evento", amountCents: 100, dueDate: "2026-10-01", eventId: "nope" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("evento: certificado de participacao e relatorio (Pro)", () => {
  /** O relogio anda: inscreve antes do evento, faz a chamada nos dias e volta a hoje (22/09) com ele terminado. */
  async function finishedEventWithPresence() {
    await subscriptionService.setTier("pro");
    vi.setSystemTime(new Date("2026-09-18T12:00:00"));
    const event = await seminar({
      capacity: undefined,
      sessions: [{ date: "2026-09-19", start: "09:00", end: "12:00" }, { date: "2026-09-20", start: "09:00", end: "12:30" }],
    });
    const ana = await createStudent("Ana");
    const bia = await createStudent("Bia");
    const anaReg = await eventsService.register({ eventId: event.id, studentId: ana.id, payment: { amountCents: 25000, installments: 1, firstDueDate: "2026-09-10" } });
    const biaReg = await eventsService.register({ eventId: event.id, studentId: bia.id, payment: { amountCents: 0, installments: 1, firstDueDate: "2026-09-10" } });
    vi.setSystemTime(new Date("2026-09-20T12:00:00"));
    await eventsService.markEventAttendance({ sessionId: event.sessions[0].id, registrationId: anaReg.id, status: "present" });
    await eventsService.markEventAttendance({ sessionId: event.sessions[1].id, registrationId: anaReg.id, status: "present" });
    await eventsService.markEventAttendance({ sessionId: event.sessions[0].id, registrationId: biaReg.id, status: "absent" });
    chargesOf(ana.id)[0].status = "paid";
    vi.setSystemTime(new Date("2026-09-22T12:00:00"));
    return { event, ana, bia, anaReg, biaReg };
  }

  it("emite para quem esteve presente, com codigo, horas e texto de participacao", async () => {
    const { event, anaReg, biaReg } = await finishedEventWithPresence();
    const candidates = await eventsService.listEventCertificateCandidates(event.id);
    expect(candidates.map((c) => c.studentName)).toEqual(["Ana"]);

    const sheet = await eventsService.getEventCertificate(anaReg.id);
    expect(sheet.certificate.courseName).toBe("Seminário do Sensei");
    expect(sheet.certificate.instructorName).toBe("Sensei Kenji");
    expect(sheet.certificate.lessonsCount).toBe(2);
    expect(sheet.certificate.workloadMinutes).toBe(390);
    expect(sheet.certificate.attendancePercent).toBe(100);
    expect(sheet.certificate.startDate).toBe("2026-09-19");
    expect(sheet.certificate.endDate).toBe("2026-09-20");
    expect(sheet.issued.code).toMatch(/^GH-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(sheet.template.title).toBe("Certificado de participação");
    expect(sheet.template.body).toContain("participou de {curso}");
    // Abrir de novo devolve o mesmo codigo; o lote traz so quem teve presenca.
    expect((await eventsService.getEventCertificate(anaReg.id)).issued.code).toBe(sheet.issued.code);
    const batch = await eventsService.issueEventCertificates(event.id);
    expect(batch.items.map((i) => `${i.certificate.studentName} ${i.issued.code === sheet.issued.code}`)).toEqual(["Ana true"]);
    expect(lastAudit()).toContain("emitiu o certificado de participação de Ana em Seminário do Sensei");

    await expect(eventsService.getEventCertificate(biaReg.id)).rejects.toMatchObject({ code: "VALIDATION" });
    const canceled = await eventsService.cancelEventCertificate(anaReg.id, "Nome errado");
    expect(canceled.status).toBe("canceled");
    expect((await eventsService.listEventCertificateCandidates(event.id))[0].issuedCode).toBe(sheet.issued.code);
  });

  it("sem o plano, FEATURE_NOT_IN_PLAN; evento em andamento ainda nao emite", async () => {
    const { event, anaReg } = await finishedEventWithPresence();
    await subscriptionService.setTier("free");
    await expect(eventsService.getEventCertificate(anaReg.id)).rejects.toMatchObject({ code: "FEATURE_NOT_IN_PLAN" });
    await subscriptionService.setTier("pro");
    const ongoing = await seminar({ capacity: undefined, sessions: [{ date: "2026-09-22", start: "09:00", end: "12:00" }, { date: "2026-09-29", start: "09:00", end: "12:00" }] });
    const caio = await createStudent("Caio");
    const reg = await eventsService.register({ eventId: ongoing.id, studentId: caio.id, payment: { amountCents: 0, installments: 1, firstDueDate: "2026-09-22" } });
    await eventsService.markEventAttendance({ sessionId: ongoing.sessions[0].id, registrationId: reg.id, status: "present" });
    await expect(eventsService.getEventCertificate(reg.id)).rejects.toMatchObject({ code: "VALIDATION" });
    void event;
  });

  it("relatorio do mes: inscritos, presenca e dinheiro por evento", async () => {
    const { event } = await finishedEventWithPresence();
    await seminar({ name: "Workshop de novembro", capacity: undefined, sessions: [{ date: "2026-11-07", start: "09:00", end: "12:00" }] });
    const result = await reportsService.generateReport("events_summary", { competence: "2026-09" });
    if (result.type !== "events_summary") throw new Error("relatorio errado");
    expect(result.data.eventsCount).toBe(1);
    expect(result.data.confirmedTotal).toBe(2);
    expect(result.data.receivedCents).toBe(25000);
    expect(result.data.openCents).toBe(0);
    const row = result.data.events[0];
    expect(row.eventId).toBe(event.id);
    expect([row.stage, row.daysCount, row.confirmedCount, row.attendancePercent, row.resultCents]).toEqual(["finished", 2, 2, 50, 25000]);
    expect(row.instructorName).toBe("Sensei Kenji (convidado)");
    const catalog = await reportsService.getCatalog();
    expect(catalog.some((r) => r.type === "events_summary" && r.tierRequired === "pro")).toBe(true);
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
    const myEvent = await seminar({ name: "Aulão da Ana", instructors: [{ id: "i-ana", professionalId: mine.id }], capacity: undefined, sessions: [{ date: "2026-09-22", start: "09:00", end: "12:00" }] });
    const otherEvent = await seminar({ name: "Aulão da Bia", instructors: [{ id: "i-bia", professionalId: other.id }], capacity: undefined, sessions: [{ date: "2026-09-22", start: "14:00", end: "17:00" }] });
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

describe("evento: mais de uma pessoa conduzindo (10/11/2026)", () => {
  const profUser = (id: string, professionalId: string, name: string) =>
    store.users.push({
      id,
      organizationId: store.organization.id,
      name,
      email: `${id}@teste.local`,
      profile: "professional",
      professionalId,
      status: "active",
      createdAt: "2026-09-01T12:00:00.000Z",
      updatedAt: "2026-09-01T12:00:00.000Z",
    });

  it("cada dia com quem conduz; sem escolha, todos; certificado e busca com todos", async () => {
    const ana = await createInstructor("Prof Ana");
    const event = await seminar({
      capacity: undefined,
      instructors: [
        { id: "i-ana", professionalId: ana.id },
        { id: "i-kenji", guestName: "Sensei Kenji", guestOrigin: "Curitiba" },
        { id: "i-yuki", guestName: "Sensei Yuki" },
      ],
      sessions: [
        { date: "2026-10-10", start: "09:00", end: "12:00", instructorIds: ["i-kenji"] },
        { date: "2026-10-10", start: "14:00", end: "17:00", instructorIds: ["i-kenji", "i-yuki"] },
        { date: "2026-10-11", start: "09:00", end: "12:00" },
      ],
    });
    expect(event.instructors.map((i) => i.name)).toEqual(["Prof Ana", "Sensei Kenji", "Sensei Yuki"]);
    const days = await eventsService.listSessions({ dateFrom: "2026-10-10", dateTo: "2026-10-11" });
    expect(days.map((d) => d.instructors.map((i) => i.name).join(" + "))).toEqual([
      "Sensei Kenji",
      "Sensei Kenji + Sensei Yuki",
      "Prof Ana + Sensei Kenji + Sensei Yuki",
    ]);
    expect((await eventsService.list({ search: "yuki" })).map((e) => e.id)).toEqual([event.id]);
    expect((await eventsService.list({ search: "prof ana" })).map((e) => e.id)).toEqual([event.id]);
    expect((await eventsService.list({ instructorId: ana.id })).map((e) => e.id)).toEqual([event.id]);
  });

  it("dia so pode apontar para quem esta no evento; a mesma pessoa da equipe nao entra duas vezes", async () => {
    const ana = await createInstructor("Prof Ana");
    await expect(
      seminar({ sessions: [{ date: "2026-10-10", start: "09:00", end: "12:00", instructorIds: ["i-ninguem"] }] }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      seminar({ instructors: [{ id: "a1", professionalId: ana.id }, { id: "a2", professionalId: ana.id }] }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("professor ve o evento e faz chamada so nos dias que conduz", async () => {
    const ana = await createInstructor("Prof Ana");
    const bia = await createInstructor("Prof Bia");
    const event = await seminar({
      capacity: undefined,
      instructors: [
        { id: "i-ana", professionalId: ana.id },
        { id: "i-bia", professionalId: bia.id },
      ],
      sessions: [
        { date: "2026-09-22", start: "09:00", end: "12:00", instructorIds: ["i-ana"] },
        { date: "2026-09-22", start: "14:00", end: "17:00", instructorIds: ["i-bia"] },
      ],
    });
    const student = await createStudent("Aluna");
    const reg = await eventsService.register({ eventId: event.id, studentId: student.id, payment: { amountCents: 0, installments: 1, firstDueDate: "2026-09-22" } });
    profUser("usr-bia", bia.id, "Prof Bia");
    setCurrentActor({ userId: "usr-bia", name: "Prof Bia", profile: "professional" });

    expect((await eventsService.list()).map((e) => e.id)).toEqual([event.id]);
    expect((await eventsService.listSessions({ dateFrom: "2026-09-22", dateTo: "2026-09-22" })).map((s) => s.start)).toEqual(["14:00"]);
    await eventsService.markEventAttendance({ sessionId: event.sessions[1].id, registrationId: reg.id, status: "present" });
    await expect(
      eventsService.markEventAttendance({ sessionId: event.sessions[0].id, registrationId: reg.id, status: "present" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(eventsService.getSessionDetail(event.sessions[0].id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("editar: quem conduziu dia ja feito nao sai; quem sai deixa a escolha dos dias futuros", async () => {
    const event = await seminar({
      capacity: undefined,
      instructors: [
        { id: "i-kenji", guestName: "Sensei Kenji" },
        { id: "i-yuki", guestName: "Sensei Yuki" },
      ],
      sessions: [
        { date: "2026-09-20", start: "09:00", end: "12:00", instructorIds: ["i-kenji"] },
        { date: "2026-10-10", start: "09:00", end: "12:00", instructorIds: ["i-yuki"] },
      ],
    });
    await expect(eventsService.update(event.id, { instructors: [{ id: "i-yuki", guestName: "Sensei Yuki" }] })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    const updated = await eventsService.update(event.id, {
      instructors: [
        { id: "i-kenji", guestName: "Sensei Kenji" },
        { id: "i-taro", guestName: "Sensei Taro" },
      ],
    });
    expect(updated.instructors.map((i) => i.name)).toEqual(["Sensei Kenji", "Sensei Taro"]);
    const [done, future] = updated.sessions;
    expect(done.instructorIds).toEqual(["i-kenji"]);
    expect(future.instructorIds).toBeUndefined();
    const rechosen = await eventsService.update(event.id, {
      sessions: [
        { id: done.id, date: done.date, start: done.start, end: done.end, instructorIds: ["i-taro"] },
        { id: future.id, date: future.date, start: future.start, end: future.end, instructorIds: ["i-taro"] },
      ],
    });
    expect(rechosen.sessions.map((s) => s.instructorIds)).toEqual([["i-kenji"], ["i-taro"]]);
  });
});
