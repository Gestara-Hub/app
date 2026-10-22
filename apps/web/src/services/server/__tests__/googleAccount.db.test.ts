import { createHash, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { resolveGoogleAccount } from "../accountSetup";

/**
 * "Continuar com Google" (doc 16): qual conta a pessoa usa ao voltar do Google.
 * A identidade do Google e simulada com um usuario do Auth criado aqui.
 */

let tenant: TestTenant;
const authIds: string[] = [];
const orgIds: string[] = [];

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  const admin = adminClient();
  for (const id of orgIds.splice(0)) await admin.from("organizations").delete().eq("id", id);
  for (const id of authIds.splice(0)) await admin.auth.admin.deleteUser(id);
  await tenant.remove();
});

/** Pessoa que "voltou do Google": usuario do Auth com e-mail confirmado. */
async function googlePerson(email = `google-${randomUUID()}@gestarahub.test`) {
  const { data, error } = await adminClient().auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message);
  authIds.push(data.user.id);
  return { authUserId: data.user.id, email, name: "Pessoa Google" };
}

/** Usuario convidado (sem acesso ainda) com o convite pendente; devolve o token. */
async function invite(email: string): Promise<{ userId: string; token: string }> {
  const admin = adminClient();
  const userId = `usr-${randomUUID()}`;
  await admin
    .from("users")
    .insert({ id: userId, organization_id: tenant.organizationId, name: "Convidada", email, profile: "attendant", status: "active" })
    .throwOnError();
  const token = randomUUID();
  await admin
    .from("organization_invitations")
    .insert({
      organization_id: tenant.organizationId,
      user_id: userId,
      email,
      name: "Convidada",
      profile: "attendant",
      token_hash: createHash("sha256").update(token).digest("hex"),
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .throwOnError();
  return { userId, token };
}

describe("entrar com Google", () => {
  it("ninguém com o e-mail: espaço novo com o dono; na volta seguinte, a mesma conta", async () => {
    const admin = adminClient();
    const person = await googlePerson();
    const first = await resolveGoogleAccount(admin, person);
    expect(first).toMatchObject({ ok: true, created: true });
    if (!first.ok) return;
    orgIds.push(first.dbUser.organization_id as string);
    expect(first.dbUser).toMatchObject({ id: person.authUserId, auth_user_id: person.authUserId, profile: "owner", name: "Pessoa Google" });
    const { data: org } = await admin.from("organizations").select("settings").eq("id", first.dbUser.organization_id as string).single();
    expect(org?.settings).toMatchObject({ onboardingCompleted: false });

    const again = await resolveGoogleAccount(admin, person);
    expect(again).toMatchObject({ ok: true, created: false });
    if (again.ok) expect(again.dbUser.id).toBe(person.authUserId);
  });

  it("convite pelo botão do convite: liga o convidado e aceita o convite", async () => {
    const admin = adminClient();
    const person = await googlePerson();
    const { userId, token } = await invite(person.email);
    const result = await resolveGoogleAccount(admin, person, token);
    expect(result).toMatchObject({ ok: true, created: false });
    if (result.ok) expect(result.dbUser).toMatchObject({ id: userId, auth_user_id: person.authUserId });
    const { data: inv } = await admin.from("organization_invitations").select("status").eq("user_id", userId).single();
    expect(inv?.status).toBe("accepted");
  });

  it("convite com outra conta Google: recusa, sem ligar nada", async () => {
    const admin = adminClient();
    const { userId, token } = await invite(`convidada-${randomUUID()}@gestarahub.test`);
    const other = await googlePerson();
    expect(await resolveGoogleAccount(admin, other, token)).toEqual({ ok: false, code: "invite_email_mismatch" });
    const { data: user } = await admin.from("users").select("auth_user_id").eq("id", userId).single();
    expect(user?.auth_user_id).toBeNull();
  });

  it("convidado pelo e-mail que entra pelo login com Google: aceita o convite pendente", async () => {
    const admin = adminClient();
    const person = await googlePerson();
    const { userId } = await invite(person.email);
    const result = await resolveGoogleAccount(admin, person);
    expect(result).toMatchObject({ ok: true, created: false });
    if (result.ok) expect(result.dbUser.id).toBe(userId);
  });

  it("e-mail já ligado a outra conta: recusa (nunca liga por e-mail)", async () => {
    const admin = adminClient();
    const owner = tenant.owner;
    const impostor = await googlePerson(`imp-${randomUUID()}@gestarahub.test`);
    const result = await resolveGoogleAccount(admin, { ...impostor, email: owner.email });
    expect(result).toEqual({ ok: false, code: "email_in_use" });
  });

  it("usuário inativo não entra", async () => {
    const admin = adminClient();
    const person = await googlePerson();
    const created = await resolveGoogleAccount(admin, person);
    if (!created.ok) throw new Error("conta não criada");
    orgIds.push(created.dbUser.organization_id as string);
    await admin.from("users").update({ status: "inactive" }).eq("id", person.authUserId).throwOnError();
    expect(await resolveGoogleAccount(admin, person)).toEqual({ ok: false, code: "inactive" });
  });
});
