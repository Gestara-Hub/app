import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { checkEmailChangeToken, confirmEmailChange, createEmailChangeToken } from "../emailChange";

/** Troca do e-mail de acesso pela propria pessoa (migracao 87): link de 1 hora, uma vez so. */

let tenant: TestTenant;
let authUserId: string;

beforeEach(async () => {
  tenant = await createTestTenant();
  const { data } = await adminClient().from("users").select("auth_user_id").eq("id", tenant.owner.id).single();
  authUserId = String(data!.auth_user_id);
});

afterEach(async () => {
  await tenant.remove();
});

const freshEmail = () => `novo-${randomUUID()}@gestarahub.test`;

async function canSignIn(email: string, password: string): Promise<boolean> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}

describe("troca do e-mail de acesso", () => {
  it("confirma pelo link: entra com o e-mail novo, a linha do espaço muda e o link não vale de novo", async () => {
    const admin = adminClient();
    const newEmail = freshEmail();
    const created = await createEmailChangeToken(admin, {
      authUserId,
      currentEmail: tenant.owner.email,
      newEmail: `  ${newEmail.toUpperCase()} `,
    });
    expect(created).toMatchObject({ ok: true, newEmail });
    if (!created.ok) return;

    // Antes de confirmar nada muda.
    expect(await canSignIn(tenant.owner.email, tenant.owner.password)).toBe(true);

    const result = await confirmEmailChange(admin, created.token);
    expect(result).toMatchObject({ ok: true, oldEmail: tenant.owner.email, newEmail });
    expect(await canSignIn(newEmail, tenant.owner.password)).toBe(true);
    expect(await canSignIn(tenant.owner.email, tenant.owner.password)).toBe(false);
    const { data: row } = await admin.from("users").select("email").eq("id", tenant.owner.id).single();
    expect(row?.email).toBe(newEmail);

    expect(await confirmEmailChange(admin, created.token)).toEqual({ ok: false, code: "expired" });
  });

  it("mesmo e-mail, e-mail inválido ou já usado por outra conta: não cria o link", async () => {
    const admin = adminClient();
    const other = await tenant.addUser("manager");
    const base = { authUserId, currentEmail: tenant.owner.email };
    expect(await createEmailChangeToken(admin, { ...base, newEmail: tenant.owner.email })).toEqual({
      ok: false,
      code: "same",
    });
    expect(await createEmailChangeToken(admin, { ...base, newEmail: "sem-arroba" })).toEqual({
      ok: false,
      code: "invalid",
    });
    expect(await createEmailChangeToken(admin, { ...base, newEmail: other.email.toUpperCase() })).toEqual({
      ok: false,
      code: "in_use",
    });
    // "_" nao e curinga: um e-mail parecido com o de outra conta esta livre.
    const lookAlike = `_${other.email.slice(1)}`;
    expect(await createEmailChangeToken(admin, { ...base, newEmail: lookAlike })).toMatchObject({ ok: true });
  });

  it("e-mail ocupado enquanto o link estava em aberto: não troca", async () => {
    const admin = adminClient();
    const newEmail = freshEmail();
    const created = await createEmailChangeToken(admin, { authUserId, currentEmail: tenant.owner.email, newEmail });
    if (!created.ok) throw new Error("link");
    await admin.from("users").update({ email: newEmail }).eq("id", (await tenant.addUser("manager")).id);
    expect(await confirmEmailChange(admin, created.token)).toEqual({ ok: false, code: "in_use" });
    expect(await canSignIn(tenant.owner.email, tenant.owner.password)).toBe(true);
  });

  it("pedir de novo invalida o anterior; depois de 1 hora o link vence", async () => {
    const admin = adminClient();
    const base = { authUserId, currentEmail: tenant.owner.email };
    const first = await createEmailChangeToken(admin, { ...base, newEmail: freshEmail() });
    const second = await createEmailChangeToken(admin, { ...base, newEmail: freshEmail() });
    if (!first.ok || !second.ok) throw new Error("link");
    expect((await checkEmailChangeToken(admin, first.token)).status).toBe("expired");
    expect((await checkEmailChangeToken(admin, second.token)).status).toBe("valid");
    const later = new Date(Date.now() + 61 * 60 * 1000);
    expect((await checkEmailChangeToken(admin, second.token, later)).status).toBe("expired");
    expect((await checkEmailChangeToken(admin, "nao-existe")).status).toBe("invalid");
  });
});
