import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, ownerSql, type TestTenant } from "@/test/db";
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

/** Deixa a conta como se tivesse entrado so pelo Google (sem senha). */
async function makeGoogleOnly(email: string): Promise<void> {
  const sql = await ownerSql();
  try {
    await sql`delete from auth.identities where user_id = ${authUserId}`;
    await sql`insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
              values (${"google-" + authUserId}, ${authUserId},
                      ${sql.json({ sub: "google-" + authUserId, email, email_verified: true })}, 'google', now(), now())`;
    await sql`update auth.users set encrypted_password = null,
              raw_app_meta_data = raw_app_meta_data || '{"provider":"google","providers":["google"]}'::jsonb
              where id = ${authUserId}`;
  } finally {
    await sql.end();
  }
}

async function providersOf(id: string): Promise<string[]> {
  const { data } = await adminClient().auth.admin.getUserById(id);
  return (data?.user?.identities ?? []).map((identity) => identity.provider).sort();
}

describe("troca para quem entra pelo Google", () => {
  it("confirma criando a senha: sai o Google antigo, entra com o e-mail novo e a senha", async () => {
    const admin = adminClient();
    await makeGoogleOnly(tenant.owner.email);
    const newEmail = freshEmail();
    const created = await createEmailChangeToken(admin, { authUserId, currentEmail: tenant.owner.email, newEmail });
    if (!created.ok) throw new Error("link");

    expect(await confirmEmailChange(admin, created.token)).toEqual({ ok: false, code: "needs_password" });
    expect(await confirmEmailChange(admin, created.token, new Date(), { password: "curta" })).toEqual({
      ok: false,
      code: "needs_password",
    });
    expect(await confirmEmailChange(admin, created.token, new Date(), { password: "SenhaNova123" })).toMatchObject({
      ok: true,
      newEmail,
    });
    expect(await providersOf(authUserId)).toEqual(["email"]);
    expect(await canSignIn(newEmail, "SenhaNova123")).toBe(true);
  });

  it("quem já tem senha continua com ela (a senha mandada é ignorada) e sai das sessões abertas", async () => {
    const admin = adminClient();
    const newEmail = freshEmail();
    const created = await createEmailChangeToken(admin, { authUserId, currentEmail: tenant.owner.email, newEmail });
    if (!created.ok) throw new Error("link");
    expect(await confirmEmailChange(admin, created.token, new Date(), { password: "OutraSenha999" })).toMatchObject({
      ok: true,
    });
    expect(await canSignIn(newEmail, tenant.owner.password)).toBe(true);
    expect(await canSignIn(newEmail, "OutraSenha999")).toBe(false);
    const sql = await ownerSql();
    try {
      // So a sessao do canSignIn acima (as anteriores sairam na troca).
      const [{ count }] = await sql`select count(*)::int as count from auth.sessions where user_id = ${authUserId}`;
      expect(count).toBe(1);
    } finally {
      await sql.end();
    }
  });
});

describe("troca pelo painel (quem perdeu o acesso)", () => {
  it("troca o e-mail, tira o Google, deixa o link de criar senha e registra nas duas auditorias", async () => {
    await makeGoogleOnly(tenant.owner.email);
    const newEmail = freshEmail();
    const sql = await ownerSql();
    try {
      const call = (email: string, reason = "Perdeu o Gmail, confirmado por telefone") =>
        sql`select * from platform.change_user_access_email(${tenant.organizationId}, ${tenant.owner.id}, ${email},
              ${reason}, ${"hash-" + randomUUID()}, ${randomUUID()}, ${"Admin"}, ${"127.0.0.1"}, ${"teste"})`;

      await expect(call(newEmail, "x")).rejects.toMatchObject({ code: "22023" });
      const other = await tenant.addUser("manager");
      await expect(call(other.email.toUpperCase())).rejects.toMatchObject({ code: "23505" });

      const [row] = await call(`  ${newEmail.toUpperCase()} `);
      expect(row).toMatchObject({ old_email: tenant.owner.email, new_email: newEmail });
      expect(await providersOf(authUserId)).toEqual(["email"]);
      const [user] = await sql`select email from public.users where id = ${tenant.owner.id}`;
      expect(user.email).toBe(newEmail);
      const [link] = await sql`select count(*)::int as count from public.password_reset_tokens
                               where auth_user_id = ${authUserId} and status = 'pending' and email = ${newEmail}`;
      expect(link.count).toBe(1);
      const [space] = await sql`select count(*)::int as count from public.audit_logs
                                where organization_id = ${tenant.organizationId} and summary like '%trocou o e-mail de acesso%'`;
      expect(space.count).toBe(1);
      const [panel] = await sql`select count(*)::int as count from platform.audit_logs
                                where organization_id = ${tenant.organizationId} and action = 'space.user_access_email'`;
      expect(panel.count).toBe(1);
    } finally {
      await sql.end();
    }
  });
});
