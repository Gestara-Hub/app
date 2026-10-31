import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, sessionClient, signInAs, signOut, type TestTenant } from "@/test/db";

/**
 * Auditoria de seguranca de 30/10/2026 (migracao 69): quem tem a sessao do
 * Supabase (o token fica no cookie do navegador) ou a chave publica chama o
 * PostgREST direto, sem passar pelo app. Estes testes fazem isso e conferem
 * que o banco recusa.
 */

const admin = adminClient();
let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
  await admin
    .from("organizations")
    .update({ gateway_api_key: "chave_secreta_de_teste" })
    .eq("id", tenant.organizationId)
    .throwOnError();
});

afterEach(async () => {
  await tenant.remove();
});

const denied = (error: { message?: string; code?: string } | null) =>
  Boolean(error && (/permission denied/i.test(error.message ?? "") || error.code === "42501"));

describe("chave do Asaas e dados do espaço", () => {
  it("nenhum perfil lê a chave; o resto do espaço segue legível", async () => {
    for (const profile of ["owner", "professional"] as const) {
      const user = profile === "owner" ? tenant.owner : await tenant.addUser(profile);
      const client = await signInAs(user);
      const { error } = await client.from("organizations").select("gateway_api_key").eq("id", tenant.organizationId);
      expect(denied(error)).toBe(true);
      const { data } = await client.from("organizations").select("id, name, settings, subscription").eq("id", tenant.organizationId).single();
      expect(data?.id).toBe(tenant.organizationId);
    }
  });

  it("nem o dono grava o espaço direto (plano pago, situação, carteira do repasse)", async () => {
    const { error } = await sessionClient()
      .from("organizations")
      .update({ subscription: { tier: "scale" }, gateway_wallet_id: "carteira_de_outro" })
      .eq("id", tenant.organizationId);
    expect(denied(error)).toBe(true);
    const { data } = await admin.from("organizations").select("subscription, gateway_wallet_id").eq("id", tenant.organizationId).single();
    expect((data?.subscription as { tier?: string } | null)?.tier).not.toBe("scale");
    expect(data?.gateway_wallet_id).not.toBe("carteira_de_outro");
  });
});

describe("gravação direta fechada", () => {
  it("membro não insere pagamento online (Pix próprio na página oficial) nem consentimento", async () => {
    const client = sessionClient();
    const payment = await client.from("online_payments").insert({
      organization_id: tenant.organizationId,
      charge_id: randomUUID(),
      method: "pix",
      amount_cents: 100,
      status: "awaiting",
      pix_copy_paste: "000201pix-de-outro",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(denied(payment.error)).toBe(true);
    const consent = await client.from("legal_consents").insert({ organization_id: tenant.organizationId, consent_type: "platform_terms" });
    expect(denied(consent.error)).toBe(true);
  });

  it("professor não apaga matrícula direto", async () => {
    const teacher = await tenant.addUser("professional");
    const client = await signInAs(teacher);
    const { error } = await client.from("enrollments").delete().eq("organization_id", tenant.organizationId);
    expect(denied(error)).toBe(true);
  });
});

describe("sem login", () => {
  it("não zera nem consome o limite de tentativas", async () => {
    signOut();
    const anon = sessionClient();
    const reset = await anon.rpc("reset_rate_limit", { p_key: "login:1.2.3.4:alguem@exemplo.com" });
    expect(denied(reset.error)).toBe(true);
    const check = await anon.rpc("check_rate_limit", { p_key: "two_factor:alguem", p_max_points: 6, p_window_seconds: 300 });
    expect(denied(check.error)).toBe(true);
  });

  it("não lê nem grava preferências de ninguém", async () => {
    signOut();
    const anon = sessionClient();
    const read = await anon.from("user_preferences").select("user_id");
    expect(denied(read.error)).toBe(true);
    const write = await anon.from("user_preferences").upsert({ user_id: tenant.owner.id, preferences: {} });
    expect(denied(write.error)).toBe(true);
  });

  it("não chama as funções que gravam cobrança ou lançamento", async () => {
    signOut();
    const anon = sessionClient();
    const charges = await anon.rpc("insert_membership_charges", { p_organization_id: tenant.organizationId, p_rows: [] });
    expect(denied(charges.error)).toBe(true);
  });
});
