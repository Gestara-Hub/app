import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { applyWhatsAppOptOut } from "../whatsappOptOut";

/**
 * "SAIR" pelo WhatsApp (12/11/2026, doc product/27 M2): o aluno (ou o
 * responsavel) que responde fica com "pediu para parar" so no espaco que fala
 * com ele, e a Auditoria registra com o autor "Sistema".
 */

const admin = adminClient();
let tenant: TestTenant;
let other: TestTenant;

async function student(t: TestTenant, name: string, fields: Record<string, unknown>) {
  const id = randomUUID();
  await admin
    .from("clients")
    .insert({ id, organization_id: t.organizationId, name, status: "active", whatsapp_consent_status: "granted", ...fields })
    .throwOnError();
  return id;
}

async function consentOf(id: string) {
  const { data } = await admin.from("clients").select("whatsapp_consent_status, whatsapp_consent_by").eq("id", id).single();
  return data;
}

beforeEach(async () => {
  tenant = await createTestTenant();
  other = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
  await other.remove();
});

describe("applyWhatsAppOptOut", () => {
  it("revoga o aluno e o filho do responsável no espaço que mandou a mensagem, com registro na Auditoria", async () => {
    // O espaco mandou mensagem a esse numero (numero da plataforma, sem conexao por espaco).
    await admin
      .from("message_logs")
      .insert({
        id: randomUUID(),
        organization_id: tenant.organizationId,
        recipient_name: "Ana",
        recipient_phone: "5511977770000",
        trigger: "manual_broadcast",
        category: "administrative",
        content: "Oi",
        status: "delivered",
        sent_at: new Date().toISOString(),
      })
      .throwOnError();
    const ana = await student(tenant, "Ana", { phone: "+5511977770000" });
    const filho = await student(tenant, "Filho da Ana", { guardians: [{ name: "Ana", phone: "11977770000" }] });
    const outro = await student(tenant, "Outro", { phone: "+5511966660000" });
    // Mesmo numero em outro espaco que nunca falou com ele: nao muda.
    const deOutroEspaco = await student(other, "Ana em outro espaço", { phone: "+5511977770000" });

    // A Meta as vezes manda o numero sem o 9.
    const changed = await applyWhatsAppOptOut(admin, { from: "551177770000" });

    expect(changed).toBe(2);
    expect(await consentOf(ana)).toMatchObject({ whatsapp_consent_status: "revoked", whatsapp_consent_by: 'Pedido pelo WhatsApp ("SAIR")' });
    expect((await consentOf(filho))?.whatsapp_consent_status).toBe("revoked");
    expect((await consentOf(outro))?.whatsapp_consent_status).toBe("granted");
    expect((await consentOf(deOutroEspaco))?.whatsapp_consent_status).toBe("granted");

    const { data: audit } = await admin
      .from("audit_logs")
      .select("target, summary, actor, source")
      .eq("organization_id", tenant.organizationId)
      .eq("source", "system");
    const rows = (audit ?? []) as { target: { id?: string }; summary: string; actor: { kind?: string } }[];
    expect(rows.map((r) => r.target.id).sort()).toEqual([ana, filho].sort());
    expect(rows[0].summary).toContain('respondeu "SAIR"');
    expect(rows[0].actor.kind).toBe("system");

    // Repetir o SAIR nao muda nada nem registra de novo.
    expect(await applyWhatsAppOptOut(admin, { from: "5511977770000" })).toBe(0);
  });

  it("com o número do espaço conectado, só esse espaço", async () => {
    await admin
      .from("whatsapp_connections")
      .upsert({ organization_id: other.organizationId, official_status: "connected", phone_number: "5511955550000" })
      .throwOnError();
    const aqui = await student(tenant, "Bia", { phone: "+5511944440000" });
    const la = await student(other, "Bia", { phone: "+5511944440000" });

    expect(await applyWhatsAppOptOut(admin, { from: "5511944440000", businessNumber: "+55 11 95555-0000" })).toBe(1);
    expect((await consentOf(la))?.whatsapp_consent_status).toBe("revoked");
    expect((await consentOf(aqui))?.whatsapp_consent_status).toBe("granted");
  });
});
