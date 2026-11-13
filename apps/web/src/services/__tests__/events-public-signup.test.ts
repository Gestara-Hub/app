import type { EventView } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billing";
import { eventsService } from "@/services/events";
import { registerInWorld, releaseExpiredReservations } from "@/services/events/eventRegistrationsService";
import { subscriptionService } from "@/services/subscription/subscriptionService";
import { createStudent, resetAcademy } from "@/test/academy";

/**
 * Inscricao pelo link, vaga garantida e ingresso (doc product/29, aprovada em
 * 12/11/2026): regras do servico. Hoje nos testes: 22/09/2026.
 */

const DAYS = [{ date: "2026-10-10", start: "09:00", end: "12:00" }];

async function paidEvent(overrides: Partial<Parameters<typeof eventsService.create>[0]> = {}): Promise<EventView> {
  return eventsService.create({
    name: "Seminário aberto",
    instructors: [{ id: "i-kenji", guestName: "Sensei Kenji" }],
    billingMode: "fixed",
    priceCents: 15000,
    maxInstallments: 1,
    capacity: 2,
    sessions: DAYS,
    ...overrides,
  });
}

function withOnlinePayments() {
  store.organization.settings = { ...store.organization.settings, onlinePayments: { enabled: true } } as never;
}

beforeEach(() => resetAcademy());

describe("link e vaga garantida no cadastro do evento", () => {
  it("ligar o link pede o Profissional; o código nasce no servidor e fica ao desligar e religar", async () => {
    await expect(paidEvent({ publicSignup: { enabled: true, code: "inventado" } })).rejects.toMatchObject({ code: "FEATURE_NOT_IN_PLAN" });

    await subscriptionService.setTier("pro");
    const event = await paidEvent({ publicSignup: { enabled: true, code: "inventado", until: "2026-10-05" } });
    const code = event.publicSignup?.code;
    expect(code).toMatch(/^[a-f0-9]{12}$/);
    expect(code).not.toBe("inventado");
    expect(event.publicSignup?.until).toBe("2026-10-05");

    const off = await eventsService.update(event.id, { publicSignup: { enabled: false, code: "" } });
    expect(off.publicSignup).toMatchObject({ enabled: false, code });
    const on = await eventsService.update(event.id, { publicSignup: { enabled: true, code: "" } });
    expect(on.publicSignup).toMatchObject({ enabled: true, code });
  });

  it("'só com o pagamento' pede recebimentos online e não vale em evento sem cobrança", async () => {
    await expect(paidEvent({ seatGuarantee: "on_payment" })).rejects.toMatchObject({
      fields: [expect.objectContaining({ field: "seatGuarantee" })],
    });
    withOnlinePayments();
    const event = await paidEvent({ seatGuarantee: "on_payment", holdMinutes: 15 });
    expect(event).toMatchObject({ seatGuarantee: "on_payment", holdMinutes: 15 });

    const free = await eventsService.create({
      name: "Aulão grátis",
      instructors: [{ id: "i-1", guestName: "Kenji" }],
      billingMode: "free",
      seatGuarantee: "on_payment",
      sessions: DAYS,
    });
    expect(free.seatGuarantee).toBe("on_signup");
  });
});

describe("reserva até pagar e ingresso", () => {
  it("inscrição confirmada ganha ingresso; a da espera não", async () => {
    const event = await paidEvent({ capacity: 1 });
    const ana = await createStudent("Ana");
    const bia = await createStudent("Bia");
    await eventsService.register({ eventId: event.id, studentId: ana.id });
    await eventsService.register({ eventId: event.id, studentId: bia.id });
    const [first, second] = ["Ana", "Bia"].map((name) =>
      store.eventRegistrations!.find((r) => r.studentId === (name === "Ana" ? ana.id : bia.id)),
    );
    expect(first).toMatchObject({ status: "confirmed", source: "staff" });
    expect(first?.ticketCode).toMatch(/^[A-F0-9]{12}$/);
    expect(second).toMatchObject({ status: "waitlist" });
    expect(second?.ticketCode).toBeUndefined();
  });

  it("reserva ocupa a vaga até vencer; pagou, confirma com ingresso; vencida, cai com a cobrança", async () => {
    withOnlinePayments();
    const event = await paidEvent({ capacity: 1, seatGuarantee: "on_payment" });
    const ana = await createStudent("Ana");
    const bia = await createStudent("Bia");

    const reserved = registerInWorld({ eventId: event.id, studentId: ana.id }, { source: "public_link", hold: { minutes: 30 } });
    expect(reserved).toMatchObject({ status: "reserved", source: "public_link" });
    // O codigo nasce com a reserva (pagina da inscricao) e e o mesmo depois de pagar.
    const code = reserved.ticketCode;
    expect(code).toMatch(/^[A-F0-9]{12}$/);
    // A reserva valendo ocupa a vaga: a proxima vai para a espera.
    expect(registerInWorld({ eventId: event.id, studentId: bia.id }).status).toBe("waitlist");
    expect((await eventsService.getById(event.id)).availableSpots).toBe(0);

    // Pagou (baixa manual): confirma e ganha o ingresso.
    const charge = store.charges.find((c) => c.eventRegistrationId === reserved.id)!;
    await billingService.markPaid(charge.id, "pix");
    expect(reserved.status).toBe("confirmed");
    expect(reserved.ticketCode).toBe(code);
    expect(reserved.holdUntil).toBeUndefined();
  });

  it("reserva vencida não segura vaga e a rotina cancela a inscrição e a cobrança", async () => {
    withOnlinePayments();
    const event = await paidEvent({ capacity: 1, seatGuarantee: "on_payment" });
    const ana = await createStudent("Ana");
    const reserved = registerInWorld({ eventId: event.id, studentId: ana.id }, { source: "public_link", hold: { minutes: 30 } });
    reserved.holdUntil = new Date(Date.now() - 60_000).toISOString();

    expect((await eventsService.getById(event.id)).availableSpots).toBe(1);
    expect(releaseExpiredReservations()).toBe(1);
    expect(reserved).toMatchObject({ status: "canceled", cancellationReason: "Reserva vencida sem pagamento" });
    expect(store.charges.filter((c) => c.eventRegistrationId === reserved.id).map((c) => c.status)).toEqual(["canceled"]);
    // A vaga voltou: outra pessoa entra.
    const bia = await createStudent("Bia");
    expect(registerInWorld({ eventId: event.id, studentId: bia.id }).status).toBe("confirmed");
  });

  it("evento grátis pelo link confirma direto, mesmo com reserva pedida", async () => {
    const event = await eventsService.create({
      name: "Aulão grátis",
      instructors: [{ id: "i-1", guestName: "Kenji" }],
      billingMode: "free",
      sessions: DAYS,
    });
    const ana = await createStudent("Ana");
    const registration = registerInWorld({ eventId: event.id, studentId: ana.id }, { source: "public_link", hold: { minutes: 30 } });
    expect(registration.status).toBe("confirmed");
    expect(registration.ticketCode).toBeDefined();
  });

  it("cancelar uma reserva tira também a cobrança de hoje", async () => {
    withOnlinePayments();
    const event = await paidEvent({ seatGuarantee: "on_payment" });
    const ana = await createStudent("Ana");
    const reserved = registerInWorld({ eventId: event.id, studentId: ana.id }, { source: "public_link", hold: { minutes: 30 } });
    await eventsService.cancelRegistration(reserved.id);
    expect(store.charges.filter((c) => c.eventRegistrationId === reserved.id).map((c) => c.status)).toEqual(["canceled"]);
  });
});

describe("entrada pelo ingresso", () => {
  const TODAY = [{ date: "2026-09-22", start: "19:00", end: "21:00" }];

  async function todayEvent(overrides: Partial<Parameters<typeof eventsService.create>[0]> = {}) {
    return eventsService.create({
      name: "Aulão de hoje",
      instructors: [{ id: "i-1", guestName: "Kenji" }],
      billingMode: "free",
      sessions: TODAY,
      ...overrides,
    });
  }

  it("lê, deixa entrar e marca presente; a segunda leitura responde 'já entrou'", async () => {
    const event = await todayEvent();
    const ana = await createStudent("Ana");
    const registration = registerInWorld({ eventId: event.id, studentId: ana.id });
    const sessionId = event.sessions[0].id;

    const preview = await eventsService.checkInTicket({ sessionId, code: `https://x/p/i/${registration.ticketCode}`, preview: true });
    expect(preview).toMatchObject({ outcome: "ok", entered: false, studentName: "Ana" });

    const first = await eventsService.checkInTicket({ sessionId, code: registration.ticketCode!.toLowerCase() });
    expect(first).toMatchObject({ outcome: "ok", entered: true });
    expect(store.eventAttendances?.find((a) => a.registrationId === registration.id)).toMatchObject({ status: "present" });

    const second = await eventsService.checkInTicket({ sessionId, code: registration.ticketCode! });
    expect(second).toMatchObject({ outcome: "already", entered: false });
    expect(second.checkedInAt).toBe(first.checkedInAt);

    await eventsService.undoCheckIn({ sessionId, registrationId: registration.id });
    expect(store.eventAttendances?.some((a) => a.registrationId === registration.id)).toBe(false);
  });

  it("pagamento pendente para e espera; confirmando, entra com o aviso", async () => {
    const event = await todayEvent({ billingMode: "fixed", priceCents: 5000, maxInstallments: 1 });
    const ana = await createStudent("Ana");
    const registration = registerInWorld({ eventId: event.id, studentId: ana.id });
    const sessionId = event.sessions[0].id;

    const paused = await eventsService.checkInTicket({ sessionId, code: registration.ticketCode! });
    expect(paused).toMatchObject({ outcome: "payment_pending", entered: false, pendingCents: 5000 });
    expect(paused.pendingChargeId).toBeDefined();

    const entered = await eventsService.checkInTicket({ sessionId, code: registration.ticketCode!, confirm: true });
    expect(entered).toMatchObject({ outcome: "payment_pending", entered: true });
  });

  it("recusa ingresso cancelado, de outro evento, de outro dia, fora de hoje e inexistente", async () => {
    const event = await todayEvent();
    const other = await todayEvent({ name: "Outro evento" });
    const future = await todayEvent({ name: "Semana que vem", sessions: [{ date: "2026-09-29", start: "19:00", end: "21:00" }] });
    const ana = await createStudent("Ana");
    const bia = await createStudent("Bia");
    const caio = await createStudent("Caio");
    const mine = registerInWorld({ eventId: event.id, studentId: ana.id });
    const elsewhere = registerInWorld({ eventId: other.id, studentId: bia.id });
    const later = registerInWorld({ eventId: future.id, studentId: caio.id });
    const sessionId = event.sessions[0].id;

    expect((await eventsService.checkInTicket({ sessionId, code: elsewhere.ticketCode! })).outcome).toBe("other_event");
    expect((await eventsService.checkInTicket({ sessionId, code: "NAOEXISTE000" })).outcome).toBe("not_found");
    expect((await eventsService.checkInTicket({ sessionId: future.sessions[0].id, code: later.ticketCode! })).outcome).toBe("not_today");
    await eventsService.cancelRegistration(mine.id);
    expect((await eventsService.checkInTicket({ sessionId, code: mine.ticketCode! })).outcome).toBe("canceled");
  });
});

describe("leitura sem internet", () => {
  const TODAY = [{ date: "2026-09-22", start: "19:00", end: "21:00" }];

  it("a lista do dia traz o código embaralhado; a conferência no aparelho dá o mesmo resultado", async () => {
    const { checkOffline, hashTicketCode } = await import("@/features/events/offline-check-in");
    const event = await eventsService.create({
      name: "Aulão",
      instructors: [{ id: "i-1", guestName: "Kenji" }],
      billingMode: "fixed",
      priceCents: 5000,
      maxInstallments: 1,
      sessions: TODAY,
    });
    const ana = await createStudent("Ana");
    const registration = registerInWorld({ eventId: event.id, studentId: ana.id });
    const sessionId = event.sessions[0].id;

    const list = await eventsService.getCheckInList(sessionId);
    expect(list.entries).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain(registration.ticketCode!);
    const hash = await hashTicketCode(`https://app/p/i/${registration.ticketCode!.toLowerCase()}`);
    expect(list.entries[0]).toMatchObject({ codeHash: hash, studentName: "Ana", pendingCents: 5000 });

    expect(checkOffline(list, hash).result).toMatchObject({ outcome: "payment_pending", entered: false });
    expect(checkOffline(list, hash, { confirm: true }).result).toMatchObject({ entered: true });
    expect(checkOffline(list, "outro").result.outcome).toBe("not_found");
  });

  it("a fila enviada marca a entrada; a repetida volta como repetida e o código inválido é recusado", async () => {
    const event = await eventsService.create({
      name: "Aulão",
      instructors: [{ id: "i-1", guestName: "Kenji" }],
      billingMode: "free",
      sessions: TODAY,
    });
    const ana = await createStudent("Ana");
    const bia = await createStudent("Bia");
    const regAna = registerInWorld({ eventId: event.id, studentId: ana.id });
    const regBia = registerInWorld({ eventId: event.id, studentId: bia.id });
    const sessionId = event.sessions[0].id;

    const res = await eventsService.syncOfflineCheckIns({
      sessionId,
      entries: [
        { registrationId: regAna.id, at: "2026-09-22T22:05:00.000Z" },
        // Outra porta, sem internet, leu o mesmo ingresso depois.
        { registrationId: regAna.id, at: "2026-09-22T22:07:00.000Z" },
        // Ingresso fora da lista: conferido aqui.
        { code: regBia.ticketCode!, at: "2026-09-22T22:06:00.000Z" },
        { code: "NAOEXISTE000", at: "2026-09-22T22:08:00.000Z" },
      ],
    });
    expect(res.applied).toBe(2);
    expect(res.duplicates).toEqual([expect.objectContaining({ studentName: "Ana", firstAt: "2026-09-22T22:05:00.000Z" })]);
    expect(res.rejected).toEqual([{ code: "NAOEXISTE000", reason: "Ingresso não encontrado" }]);
    expect(store.eventAttendances?.find((a) => a.registrationId === regAna.id)?.checkedInBy).toContain("(sem internet)");
  });
});
