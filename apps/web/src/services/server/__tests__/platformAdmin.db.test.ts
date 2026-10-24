import { afterAll, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, signInAs } from "@/test/db";
import { requireTenant } from "../tenant";
import { getClientForTenant } from "@/lib/supabase/tenant-client";

/**
 * Administrador da plataforma (painel `apps/admin`) nunca opera um espaco: mesmo
 * que algum dia tenha uma linha em `users`, o marcador `app_metadata.platform`
 * barra `requireTenant` e `getClientForTenant` (doc technical/26, secao 3).
 */
const tenant = await createTestTenant({ name: "Espaço do marcador" });
const admin = adminClient();

afterAll(async () => {
  await tenant.remove();
});

describe("marcador de administrador da plataforma", () => {
  it("o usuário do espaço entra normalmente", async () => {
    await signInAs(tenant.owner);
    await expect(requireTenant()).resolves.toMatchObject({ organizationId: tenant.organizationId });
    await expect(getClientForTenant()).resolves.toBeTruthy();
  });

  it("com o marcador, mesmo tendo linha em users, é recusado", async () => {
    const email = `marcado-${crypto.randomUUID().slice(0, 8)}@gestarahub.test`;
    const password = crypto.randomUUID();
    const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { platform: true } });
    try {
      await admin.from("users").insert({ auth_user_id: data.user!.id, organization_id: tenant.organizationId, name: "Marcado", email, profile: "owner" });
      await signInAs({ id: data.user!.id, profile: "owner", email, password });
      await expect(requireTenant()).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 401 });
      await expect(getClientForTenant()).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 401 });
    } finally {
      await admin.from("users").delete().eq("auth_user_id", data.user!.id);
      await admin.auth.admin.deleteUser(data.user!.id);
    }
  });

  it("espaço inativado pelo painel: ninguém opera até reativar", async () => {
    await signInAs(tenant.owner);
    await admin.from("organizations").update({ status: "inactive" }).eq("id", tenant.organizationId);
    try {
      await expect(requireTenant()).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 401 });
    } finally {
      await admin.from("organizations").update({ status: "active" }).eq("id", tenant.organizationId);
    }
    await expect(requireTenant()).resolves.toMatchObject({ organizationId: tenant.organizationId });
  });
});
