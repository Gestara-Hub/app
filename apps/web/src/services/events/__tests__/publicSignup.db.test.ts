import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { runInWorld } from "@/services/world/runWorld";
import { systemTenantContext } from "@/services/server/systemContext";
import { loadPublicEvent, submitPublicEventSignup } from "@/services/server/eventPublicSignup";
import { loadTicketPage } from "@/services/server/eventTickets";
import { eventsServiceImpl } from "../index";

/**
 * Inscricao pelo link no banco (doc product/29, aprovada em 12/11/2026): o
 * codigo leva ao evento, a pagina nao recebe dado de aluno, a pessoa nova vira
 * visitante, o aluno que ja existe e ligado sem mudar o cadastro, o menor vem
 * com o aceite do responsavel e o link fechado recusa.
 */

const admin = adminClient();
let tenant: TestTenant;
let code: string;
let eventId: string;
const meta = () => ({ ip: `10.0.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` });

async function createEvent(over: Record<string, unknown> = {}) {
  const ctx = await systemTenantContext(tenant.organizationId, "Teste");
  const event = await runInWorld(ctx, () =>
    eventsServiceImpl.create({
      name: "Seminário aberto",
      instructors: [{ id: "i-kenji", guestName: "Sensei Kenji", guestOrigin: "Curitiba" }],
      billingMode: "free",
      capacity: 3,
      sessions: [{ date: "2099-10-10", start: "09:00", end: "12:00" }],
      publicSignup: { enabled: true, code: "" },
      ...over,
    }),
  );
  return event;
}

beforeEach(async () => {
  tenant = await createTestTenant({ subscription: { tier: "pro" } });
  const event = await createEvent();
  code = event.publicSignup!.code;
  eventId = event.id;
});

afterEach(async () => {
  await tenant.remove();
});

describe("página e inscrição pelo link", () => {
  it("a página traz o evento e nenhum dado de aluno", async () => {
    await admin
      .from("clients")
      .insert({ id: randomUUID(), organization_id: tenant.organizationId, name: "Ana Souza Lima", phone: "+5511977770000", status: "active" })
      .throwOnError();
    await submitPublicEventSignup({ code, name: "Ana Souza Lima", phone: "11977770000", acceptTerms: true }, meta());

    const view = await loadPublicEvent(code);
    expect(view).toMatchObject({ eventName: "Seminário aberto", open: true, billingMode: "free", spotsLeft: 2 });
    expect(view?.instructors).toEqual([{ name: "Sensei Kenji", origin: "Curitiba", isGuest: true }]);
    const text = JSON.stringify(view);
    expect(text).not.toContain("Ana");
    expect(text).not.toContain("977770000");
    expect(await loadPublicEvent("naoexiste000")).toBeNull();
  });

  it("pessoa nova vira visitante com a inscrição pelo link, o ingresso e a prova do aceite", async () => {
    const result = await submitPublicEventSignup(
      { code, name: "Bruno Lima", phone: "(11) 96666-0000", acceptTerms: true, acceptWhatsapp: true },
      meta(),
    );
    expect(result).toMatchObject({ status: "confirmed", displayName: "Bruno L.", amountCents: 0 });
    expect(result.ticketCode).toMatch(/^[A-F0-9]{12}$/);

    const { data: client } = await admin
      .from("clients")
      .select("id, name, phone, whatsapp_consent_status, whatsapp_consent_by")
      .eq("organization_id", tenant.organizationId)
      .eq("name", "Bruno Lima")
      .single();
    expect(client).toMatchObject({ phone: "+5511966660000", whatsapp_consent_status: "granted", whatsapp_consent_by: "Na inscrição pelo link" });
    const { data: registration } = await admin
      .from("event_registrations")
      .select("status, source, ticket_code, signup_evidence")
      .eq("student_id", client!.id)
      .single();
    expect(registration).toMatchObject({ status: "confirmed", source: "public_link", ticket_code: result.ticketCode });
    expect(registration!.signup_evidence).toMatchObject({ method: "event_signup_link", acceptedBy: "Bruno Lima", whatsapp: true });

    const { data: audit } = await admin.from("audit_logs").select("summary, actor").eq("organization_id", tenant.organizationId);
    expect((audit ?? []).some((a) => String(a.summary).includes("pelo link") && (a.actor as { name?: string }).name === "Inscrição pelo link")).toBe(true);
  });

  it("aluno que já existe é ligado sem mudar o cadastro; a segunda vez responde 'já inscrito'", async () => {
    const id = randomUUID();
    await admin
      .from("clients")
      .insert({ id, organization_id: tenant.organizationId, name: "Carla Dias", phone: "+5511955550000", email: "carla@antes.com", status: "active" })
      .throwOnError();
    const first = await submitPublicEventSignup(
      { code, name: "Outro Nome", phone: "11955550000", email: "novo@depois.com", acceptTerms: true, acceptWhatsapp: true },
      meta(),
    );
    expect(first.status).toBe("confirmed");
    const { data: after } = await admin.from("clients").select("name, email, whatsapp_consent_status").eq("id", id).single();
    expect(after).toEqual({ name: "Carla Dias", email: "carla@antes.com", whatsapp_consent_status: "unknown" });

    const again = await submitPublicEventSignup({ code, name: "Carla", phone: "11955550000", acceptTerms: true }, meta());
    expect(again).toMatchObject({ status: "already" });
    expect(again.ticketCode).toBeUndefined();
  });

  it("menor entra com o responsável e o aceite dele", async () => {
    const result = await submitPublicEventSignup(
      { code, name: "Lia Rocha", phone: "11944440000", isMinor: true, guardianName: "Marta Rocha", guardianPhone: "11933330000", acceptTerms: true },
      meta(),
    );
    expect(result.status).toBe("confirmed");
    const { data: client } = await admin
      .from("clients")
      .select("phone, guardians, minor_consent_status, minor_consent_by")
      .eq("organization_id", tenant.organizationId)
      .eq("name", "Lia Rocha")
      .single();
    expect(client).toMatchObject({ phone: null, minor_consent_status: "confirmed_whatsapp", minor_consent_by: "Marta Rocha" });
    expect(client!.guardians).toEqual([expect.objectContaining({ name: "Marta Rocha", phone: "+5511933330000", financial: true })]);
  });

  it("recusa sem aceite, com campo-armadilha, link desligado ou fora do Profissional", async () => {
    await expect(submitPublicEventSignup({ code, name: "Dani", phone: "11922220000", acceptTerms: false }, meta())).rejects.toMatchObject({
      fields: [expect.objectContaining({ field: "acceptTerms" })],
    });
    await expect(
      submitPublicEventSignup({ code, name: "Robô", phone: "11922220000", acceptTerms: true, website: "http://spam" }, meta()),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    await admin.from("organizations").update({ subscription: { tier: "free" } }).eq("id", tenant.organizationId).throwOnError();
    expect(await loadPublicEvent(code)).toMatchObject({ open: false, closedReason: "plan" });
    await expect(submitPublicEventSignup({ code, name: "Eva", phone: "11911110000", acceptTerms: true }, meta())).rejects.toMatchObject({
      code: "CONFLICT",
    });

    await admin.from("organizations").update({ subscription: { tier: "pro" } }).eq("id", tenant.organizationId).throwOnError();
    const ctx = await systemTenantContext(tenant.organizationId, "Teste");
    await runInWorld(ctx, () => eventsServiceImpl.update(eventId, { publicSignup: { enabled: false, code: "" } }));
    expect(await loadPublicEvent(code)).toMatchObject({ open: false, closedReason: "disabled" });
  });

  it("o ingresso aberto pelo QR mostra o nome mascarado e nenhum telefone", async () => {
    const result = await submitPublicEventSignup(
      { code, name: "Fernanda Alves Costa", phone: "11988887777", acceptTerms: true },
      meta(),
    );
    const page = await loadTicketPage(result.ticketCode!.toLowerCase());
    expect(page?.ticket).toMatchObject({ eventName: "Seminário aberto", holderName: "Fernanda A. C.", state: "confirmed" });
    const text = JSON.stringify(page);
    expect(text).not.toContain("Alves");
    expect(text).not.toContain("88887777");
    expect(await loadTicketPage("NAOEXISTE0000")).toBeNull();
  });
});
