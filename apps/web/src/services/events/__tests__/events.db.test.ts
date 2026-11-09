import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Client, EventRegistrationView, EventSessionDetail, EventView } from "@gestarahub/contracts";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { serviceAction } from "@/services/world/serviceActions";

/**
 * Eventos no banco (doc product/29, fase 1): o evento, os dias, a inscricao
 * com as parcelas e a chamada gravam nas tabelas novas pelo servidor, com o
 * recorte de cada metodo.
 */

let tenant: TestTenant;
beforeEach(async () => {
  tenant = await createTestTenant();
});
afterEach(async () => {
  await tenant.remove();
});

async function call<T>(method: string, ...args: unknown[]): Promise<T> {
  const result = await serviceAction(method, args);
  if (!result.ok) throw new Error(`${method}: ${JSON.stringify(result.error)}`);
  return result.data as T;
}

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

describe("eventos no banco", () => {
  it("evento com convidado, inscricao parcelada, lista de espera e chamada do dia", async () => {
    const admin = adminClient();
    const event = await call<EventView>("events.create", {
      name: "Seminário do Sensei",
      guestInstructorName: "Sensei Kenji",
      billingMode: "fixed",
      priceCents: 30000,
      maxInstallments: 3,
      capacity: 1,
      sessions: [
        { date: today(), start: "09:00", end: "12:00" },
        { date: "2027-01-10", start: "09:00", end: "12:00" },
      ],
    });
    expect(event.organizationId).toBe(tenant.organizationId);
    expect(event.sessions).toHaveLength(2);
    expect(event.stage).toBe("ongoing");

    const { data: rows } = await admin.from("event_sessions").select("date, start").eq("event_id", event.id).order("date");
    expect(rows?.map((r) => `${r.date} ${r.start}`)).toEqual([`${today()} 09:00`, "2027-01-10 09:00"]);

    const ana = await call<Client>("clients.create", { name: "Ana", phone: "11977771111", status: "active" });
    const bia = await call<Client>("clients.create", { name: "Bia", phone: "11977772222", status: "active" });
    const anaReg = await call<EventRegistrationView>("events.register", {
      eventId: event.id,
      studentId: ana.id,
      payment: { amountCents: 30000, installments: 3, firstDueDate: today() },
    });
    expect(anaReg.status).toBe("confirmed");
    const biaReg = await call<EventRegistrationView>("events.register", { eventId: event.id, studentId: bia.id });
    expect(biaReg.status).toBe("waitlist");

    const { data: charges } = await admin
      .from("charges")
      .select("kind, amount_cents, cycle_index, event_id, event_registration_id, status")
      .eq("student_id", ana.id)
      .order("cycle_index");
    expect(charges).toEqual([
      { kind: "event", amount_cents: 10000, cycle_index: 1, event_id: event.id, event_registration_id: anaReg.id, status: "pending" },
      { kind: "event", amount_cents: 10000, cycle_index: 2, event_id: event.id, event_registration_id: anaReg.id, status: "pending" },
      { kind: "event", amount_cents: 10000, cycle_index: 3, event_id: event.id, event_registration_id: anaReg.id, status: "pending" },
    ]);

    const detail = await call<EventSessionDetail>("events.markEventAttendance", {
      sessionId: event.sessions[0].id,
      registrationId: anaReg.id,
      status: "present",
    });
    expect(detail.roster.map((r) => `${r.studentName} ${r.attendance}`)).toEqual(["Ana present"]);
    const { data: marks } = await admin.from("event_attendances").select("status, student_id").eq("session_id", event.sessions[0].id);
    expect(marks).toEqual([{ status: "present", student_id: ana.id }]);

    await call("events.cancelRegistration", anaReg.id, "Desistiu");
    const { data: after } = await admin.from("charges").select("status").eq("student_id", ana.id).order("cycle_index");
    // A 1a vence hoje (continua como divida); as outras duas, futuras, saem.
    expect(after?.map((c) => c.status)).toEqual(["pending", "canceled", "canceled"]);
    const promoted = await call<EventRegistrationView>("events.promoteFromWaitlist", biaReg.id, {
      amountCents: 0,
      installments: 1,
      firstDueDate: today(),
    });
    expect(promoted.status).toBe("confirmed");
    const list = await call<EventRegistrationView[]>("events.listRegistrations", event.id);
    expect(list.map((r) => `${r.studentName} ${r.status}`)).toEqual(["Bia confirmed", "Ana canceled"]);
    const { data: auditRows } = await admin.from("audit_logs").select("summary").eq("organization_id", tenant.organizationId);
    expect(auditRows?.some((a) => String(a.summary).includes("promoveu Bia da lista de espera"))).toBe(true);
  });
});
