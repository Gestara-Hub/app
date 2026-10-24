import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { finishSignIn } from "../sign-in-session";

/**
 * Final do login com senha: o convidado tem id proprio no app, ligado a conta
 * de login pelo `auth_user_id` (teste geral 23/10, achado 13).
 */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

let tenant: TestTenant;
const admin = adminClient();

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

async function authIdOf(email: string): Promise<string> {
  const { data } = await admin.from("users").select("id, auth_user_id").eq("email", email).single();
  return String(data!.auth_user_id);
}

describe("finishSignIn", () => {
  it("convidado com id próprio no app entra de novo com a senha", async () => {
    const manager = await tenant.addUser("manager");
    const authUserId = await authIdOf(manager.email);
    expect(authUserId).not.toBe(manager.id);

    const result = await finishSignIn(admin, authUserId);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.id).toBe(manager.id);
  });

  it("convidado inativo recebe o aviso de conta inativa", async () => {
    const manager = await tenant.addUser("manager");
    await admin.from("users").update({ status: "inactive" }).eq("id", manager.id);

    const result = await finishSignIn(admin, await authIdOf(manager.email));

    expect(result).toEqual({ ok: false, message: "Sua conta está inativa. Procure o responsável pelo espaço." });
  });
});
