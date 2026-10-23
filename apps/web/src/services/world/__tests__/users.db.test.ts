import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUserAndInviteAction, inactivateUserInDb, listUsersFromDb } from "@/services/users/actions";
import { adminClient, createTestTenant, signInAs, signOut, type TestTenant } from "@/test/db";

let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

const newUser = (profile: "owner" | "manager" | "attendant" | "professional") => ({
  name: "Fulano",
  email: `fulano-${Math.random().toString(36).slice(2)}@gestarahub.test`,
  profile,
  status: "active" as const,
});

describe("usuários: só quem administra, no próprio espaço (doc 15, fatia 3)", () => {
  it("dono cria; sem sessão, de outro espaço ou recepção não criam", async () => {
    const ok = await createUserAndInviteAction(tenant.organizationId, newUser("attendant"), false);
    expect(ok.success).toBe(true);

    signOut();
    expect((await createUserAndInviteAction(tenant.organizationId, newUser("owner"), false)).success).toBe(false);

    const other = await createTestTenant();
    try {
      // O dono do outro espaco nao cria usuario neste.
      const denied = await createUserAndInviteAction(tenant.organizationId, newUser("owner"), false);
      expect(denied.success).toBe(false);
    } finally {
      await other.remove();
    }

    await signInAs(await tenant.addUser("attendant"));
    expect((await createUserAndInviteAction(tenant.organizationId, newUser("attendant"), false)).success).toBe(false);
    expect(await listUsersFromDb(tenant.organizationId)).not.toEqual([]);

    const { count } = await adminClient()
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", tenant.organizationId)
      .eq("profile", "owner");
    expect(count).toBe(1);
  });

  it("gerente não cria nem inativa proprietário", async () => {
    await signInAs(await tenant.addUser("manager"));
    expect((await createUserAndInviteAction(tenant.organizationId, newUser("owner"), false)).success).toBe(false);
    expect((await inactivateUserInDb(tenant.organizationId, tenant.owner.id)).success).toBe(false);
    expect((await createUserAndInviteAction(tenant.organizationId, newUser("attendant"), false)).success).toBe(true);
  });
});
