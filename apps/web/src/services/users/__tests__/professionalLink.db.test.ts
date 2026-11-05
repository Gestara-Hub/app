import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { createUserAndInviteAction } from "../inviteActions";
import { updateUserInDb } from "../userRecordsActions";

/**
 * Vinculo usuario x profissional no banco (migracao 89, professionalLink.ts):
 * no maximo um usuario ativo por profissional, inclusive ao reativar; depois do
 * aceite o vinculo nao muda.
 */

let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

async function professional(name: string): Promise<{ id: string }> {
  const { data } = await adminClient()
    .from("professionals")
    .insert({ organization_id: tenant.organizationId, unit_id: tenant.unitId, name })
    .select("id")
    .single()
    .throwOnError();
  return { id: String(data!.id) };
}

async function newUser(name: string, professionalId: string) {
  const res = await createUserAndInviteAction(
    tenant.organizationId,
    { name, email: `${name.toLowerCase()}-${Date.now()}@gestarahub.test`, profile: "professional", professionalId, status: "active" },
    false,
  );
  if (!res.success || !res.user) throw new Error(res.error);
  return res.user;
}

describe("um usuário ativo por profissional", () => {
  it("recusa o segundo usuário ativo; inativo libera; reativar o antigo é recusado", async () => {
    const carlos = await professional("Carlos");
    const first = await newUser("Carlos", carlos.id);

    const second = await createUserAndInviteAction(
      tenant.organizationId,
      { name: "Outro", email: `outro-${Date.now()}@gestarahub.test`, profile: "professional", professionalId: carlos.id, status: "active" },
      false,
    );
    expect(second).toMatchObject({ success: false, field: "professionalId" });

    expect(await updateUserInDb(tenant.organizationId, first.id, { status: "inactive" })).toMatchObject({ success: true });
    const replacement = await newUser("Substituto", carlos.id);
    expect(replacement.professionalId).toBe(carlos.id);

    expect(await updateUserInDb(tenant.organizationId, first.id, { status: "active" })).toEqual({
      success: false,
      error: "Não dá para reativar: este profissional já está ligado ao usuário Substituto.",
      field: "professionalId",
    });
  });

  it("o índice segura mesmo quem grava direto no banco", async () => {
    const carlos = await professional("Carlos");
    await newUser("Carlos", carlos.id);
    const { error } = await adminClient().from("users").insert({
      organization_id: tenant.organizationId,
      name: "Direto",
      email: `direto-${Date.now()}@gestarahub.test`,
      profile: "professional",
      professional_id: carlos.id,
      status: "active",
    });
    expect(error?.code).toBe("23505");
  });
});

describe("vínculo travado depois do aceite", () => {
  it("conta ativada não troca de profissional; convite pendente troca", async () => {
    const carlos = await professional("Carlos");
    const bruno = await professional("Bruno");
    const user = await newUser("Carlos", carlos.id);

    // Convite pendente (sem auth_user_id): pode corrigir o vinculo.
    expect(await updateUserInDb(tenant.organizationId, user.id, { professionalId: bruno.id })).toMatchObject({ success: true });

    // Aceito: liga a conta e o vinculo trava.
    const { data: login } = await adminClient().auth.admin.createUser({ email: `aceito-${Date.now()}@gestarahub.test`, email_confirm: true });
    await adminClient().from("users").update({ auth_user_id: login.user!.id }).eq("id", user.id);
    try {
      expect(await updateUserInDb(tenant.organizationId, user.id, { professionalId: carlos.id })).toMatchObject({
        success: false,
        field: "professionalId",
      });
      expect(await updateUserInDb(tenant.organizationId, user.id, { professionalId: "" })).toMatchObject({ success: false });
      // O mesmo vinculo e o perfil mudando passam.
      expect(
        await updateUserInDb(tenant.organizationId, user.id, { professionalId: bruno.id, profile: "manager" }),
      ).toMatchObject({ success: true });
    } finally {
      await adminClient().auth.admin.deleteUser(login.user!.id);
    }
  });
});
