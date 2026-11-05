import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { checkPasswordResetToken, createPasswordResetToken, resetPasswordWithToken } from "../passwordReset";

/** "Esqueci minha senha" (migracao 36): link de 1 hora, uma vez so. */

let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

async function canSignIn(email: string, password: string): Promise<boolean> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}

describe("nova senha pelo link do e-mail", () => {
  it("cria o link, troca a senha e o link não vale de novo", async () => {
    const admin = adminClient();
    const created = await createPasswordResetToken(admin, tenant.owner.email.toUpperCase());
    expect(created?.email).toBe(tenant.owner.email.toLowerCase());
    expect(await checkPasswordResetToken(admin, created!.token)).toMatchObject({ status: "valid" });

    expect(await resetPasswordWithToken(admin, created!.token, "curta")).toEqual({ ok: false, code: "weak" });
    expect(await resetPasswordWithToken(admin, created!.token, "SenhaNova123")).toMatchObject({ ok: true });
    expect(await canSignIn(tenant.owner.email, "SenhaNova123")).toBe(true);
    expect(await canSignIn(tenant.owner.email, tenant.owner.password)).toBe(false);

    // Uma vez so.
    expect(await resetPasswordWithToken(admin, created!.token, "OutraSenha123")).toEqual({ ok: false, code: "expired" });
  });

  it("pedir outro link invalida o anterior; depois de 1 hora o link vence", async () => {
    const admin = adminClient();
    const first = await createPasswordResetToken(admin, tenant.owner.email);
    const second = await createPasswordResetToken(admin, tenant.owner.email);
    expect((await checkPasswordResetToken(admin, first!.token)).status).toBe("expired");
    expect((await checkPasswordResetToken(admin, second!.token)).status).toBe("valid");
    const later = new Date(Date.now() + 61 * 60 * 1000);
    expect((await checkPasswordResetToken(admin, second!.token, later)).status).toBe("expired");
  });

  it("e-mail sem conta ou link desconhecido: nada", async () => {
    const admin = adminClient();
    expect(await createPasswordResetToken(admin, "ninguem@gestarahub.test")).toBeNull();
    // "_" e "%" nao sao curinga: um e-mail parecido nao recebe o link de outra conta.
    const [local, domain] = tenant.owner.email.split("@");
    expect(await createPasswordResetToken(admin, `_${local.slice(1)}@${domain}`)).toBeNull();
    expect(await createPasswordResetToken(admin, `%@${domain}`)).toBeNull();
    expect((await checkPasswordResetToken(admin, "nao-existe")).status).toBe("invalid");
    expect((await checkPasswordResetToken(admin, undefined)).status).toBe("invalid");
  });
});
