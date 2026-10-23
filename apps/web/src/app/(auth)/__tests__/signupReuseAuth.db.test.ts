import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it, vi } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";

/**
 * Concluir o cadastro com o e-mail de um login que ja existe no Auth: so
 * reaproveita o login quando ele ainda nao tem usuario no app (cadastro
 * interrompido). Com usuario, nunca troca a senha nem o espaco dele, e o
 * link e o pedido de link novo dizem que a conta existe (sem ciclo).
 */

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "localhost:3000" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => undefined }),
}));
vi.mock("@/lib/security/rate-limit", () => ({
  getClientIp: async () => "127.0.0.1",
  checkRateLimit: async () => true,
  resetRateLimit: async () => undefined,
}));

const { completeSignupWithPassword, requestSignupLink, validateSignupToken } = await import("../signup-actions");

const cleanups: (() => Promise<void>)[] = [];

afterAll(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
});

/** Link de cadastro pendente para o e-mail; devolve o token cru. */
async function pendingSignupToken(email: string): Promise<string> {
  const raw = randomUUID();
  const { error } = await adminClient()
    .from("signup_tokens")
    .insert({
      email,
      name: "Teste Cadastro",
      token_hash: createHash("sha256").update(raw).digest("hex"),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  if (error) throw new Error(`Link de teste: ${error.message}`);
  cleanups.push(async () => {
    await adminClient().from("signup_tokens").delete().ilike("email", email);
  });
  return raw;
}

async function canSignIn(email: string, password: string): Promise<boolean> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}

describe("concluir cadastro com login já existente no Auth", () => {
  it("login com usuário no app: recusa e não mexe na senha nem no espaço", async () => {
    const tenant: TestTenant = await createTestTenant();
    cleanups.push(() => tenant.remove());
    const admin = adminClient();

    // Como a edicao manual: o e-mail do app ficou diferente do login.
    await admin.from("users").update({ email: `editado-${randomUUID()}@gestarahub.test` }).eq("id", tenant.owner.id);
    const { data: before } = await admin.from("users").select("*").eq("id", tenant.owner.id).single();

    const token = await pendingSignupToken(tenant.owner.email);
    const result = await completeSignupWithPassword({ token, password: "nova-senha-123" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("já tem conta");

    const { data: after } = await admin.from("users").select("*").eq("id", tenant.owner.id).single();
    expect(after?.organization_id).toBe(tenant.organizationId);
    expect(after?.email).toBe(before?.email);
    const { data: extra } = await admin.from("users").select("id").eq("id", before?.auth_user_id as string);
    expect(extra ?? []).toHaveLength(0);

    expect(await canSignIn(tenant.owner.email, tenant.owner.password)).toBe(true);
    expect(await canSignIn(tenant.owner.email, "nova-senha-123")).toBe(false);

    // Sem ciclo: o link abre como conta existente (nao "expirado") e pedir
    // outro link responde que a conta existe.
    expect((await validateSignupToken(token)).status).toBe("consumed");
    const again = await requestSignupLink({ name: "Teste Cadastro", email: tenant.owner.email });
    expect(again.status).toBe("account_exists");
  });

  it("login sem usuário no app (cadastro interrompido): conclui e cria o espaço", async () => {
    const admin = adminClient();
    const email = `interrompido-${randomUUID()}@gestarahub.test`;
    const { data: auth, error } = await admin.auth.admin.createUser({
      email,
      password: randomUUID(),
      email_confirm: true,
    });
    if (error || !auth.user) throw new Error(`Login de teste: ${error?.message}`);
    const authId = auth.user.id;
    cleanups.push(async () => {
      const { data: row } = await admin.from("users").select("organization_id").eq("id", authId).maybeSingle();
      if (row?.organization_id) await admin.from("organizations").delete().eq("id", row.organization_id);
      await admin.auth.admin.deleteUser(authId);
    });

    const token = await pendingSignupToken(email);
    const result = await completeSignupWithPassword({ token, password: "senha-nova-123" });

    expect(result.ok).toBe(true);
    const { data: row } = await admin.from("users").select("profile, email").eq("id", authId).single();
    expect(row?.profile).toBe("owner");
    expect(row?.email).toBe(email);
    expect(await canSignIn(email, "senha-nova-123")).toBe(true);
  });
});
