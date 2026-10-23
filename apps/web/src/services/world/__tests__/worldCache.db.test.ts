import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import type { TenantContext } from "@/services/server/tenant";
import { randomUUID } from "node:crypto";
import { forgetCachedWorld, runInWorld, worldCacheStats } from "../runWorld";
import { store } from "../store";

/**
 * Cache do espaco por versao (doc 19, migracao 40): a versao avanca em toda
 * gravacao nas tabelas do espaco, entao uma gravacao fora do motor (webhook,
 * mensalidades, configuracoes) aparece na proxima leitura, nunca o dado guardado.
 */

let tenant: TestTenant;
let ctx: TenantContext;

beforeEach(async () => {
  tenant = await createTestTenant();
  ctx = {
    client: adminClient(),
    organizationId: tenant.organizationId,
    userId: tenant.owner.id,
    profile: "owner",
    require: () => undefined,
  } as unknown as TenantContext;
});

afterEach(async () => {
  forgetCachedWorld(tenant.organizationId);
  await tenant.remove();
});

const names = () => runInWorld(ctx, async () => store.clients.map((c) => c.name).sort());

describe("cache do espaço por versão", () => {
  it("gravação direta no banco aparece na leitura seguinte", async () => {
    expect(await names()).toEqual([]);
    await adminClient()
      .from("clients")
      .insert({ organization_id: tenant.organizationId, name: "Direto no banco", phone: "11977770000" })
      .throwOnError();
    expect(await names()).toEqual(["Direto no banco"]);
  });

  it("gravação pelo motor aparece na leitura seguinte e a cópia de trabalho não vaza para o cache", async () => {
    await adminClient()
      .from("clients")
      .insert({ organization_id: tenant.organizationId, name: "Ana", phone: "11977770000" })
      .throwOnError();
    expect(await names()).toEqual(["Ana"]);
    // Muda e desiste (erro): o cache continua com o que esta no banco.
    await expect(
      runInWorld(ctx, async () => {
        store.clients[0].name = "Alterado sem gravar";
        throw new Error("desistiu");
      }),
    ).rejects.toThrow("desistiu");
    expect(await names()).toEqual(["Ana"]);
    await runInWorld(ctx, async () => {
      store.clients[0].name = "Ana Souza";
    });
    expect(await names()).toEqual(["Ana Souza"]);
  });

  it("atualização e exclusão diretas também invalidam", async () => {
    const { data } = await adminClient()
      .from("clients")
      .insert({ organization_id: tenant.organizationId, name: "Bia", phone: "11977770000" })
      .select("id")
      .single()
      .throwOnError();
    expect(await names()).toEqual(["Bia"]);
    await adminClient().from("clients").update({ name: "Bia Lima" }).eq("id", data!.id).throwOnError();
    expect(await names()).toEqual(["Bia Lima"]);
    await adminClient().from("clients").delete().eq("id", data!.id).throwOnError();
    expect(await names()).toEqual([]);
  });

  it("depois de cada gravação, o espaço em cache é igual a uma leitura nova do banco", async () => {
    const snapshot = () =>
      runInWorld(ctx, async () => JSON.stringify({ clients: store.clients, charges: store.charges, audit: store.auditLog }));
    const fresh = async () => {
      forgetCachedWorld(tenant.organizationId);
      const value = await snapshot();
      return value;
    };
    const clientId = randomUUID();
    const chargeId = randomUUID();
    const steps: (() => void)[] = [
      () => {
        store.clients.push({ id: clientId, organizationId: tenant.organizationId, name: "Carla", phone: "11977770000", status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as never);
      },
      () => {
        store.clients.find((c) => c.id === clientId)!.name = "Carla Dias";
      },
      () => {
        store.charges.push({ id: chargeId, organizationId: tenant.organizationId, studentId: clientId, kind: "extra", description: "Kimono", dueDate: "2026-10-30", amountCents: 25000, status: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as never);
      },
      () => {
        const charge = store.charges.find((c) => c.id === chargeId)!;
        charge.status = "paid";
        charge.paidAt = new Date().toISOString();
        charge.method = "pix";
      },
      () => {
        store.charges = store.charges.filter((c) => c.id !== chargeId);
      },
    ];
    await snapshot(); // espaco em cache
    for (const [index, step] of steps.entries()) {
      const before = worldCacheStats();
      await runInWorld(ctx, async () => step());
      const cached = await snapshot();
      const after = worldCacheStats();
      // A leitura depois da gravacao vem do cache avancado (a exclusao de cobranca,
      // que apaga filhas em cascata, descarta e le do banco).
      const isCascadeDelete = index === steps.length - 1;
      expect(after.hits - before.hits).toBe(isCascadeDelete ? 1 : 2);
      expect(after.advances - before.advances).toBe(isCascadeDelete ? 0 : 1);
      expect(cached).toBe(await fresh());
    }
  });
});
