import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import type { TenantContext } from "@/services/server/tenant";
import { forgetCachedWorld, runInWorld } from "../runWorld";
import { store } from "../store";

/**
 * Gravacao em lote (doc 19, secao 11; migracao 45): milhares de linhas numa
 * gravacao so cabem no limite de 8 s por chamada (antes, 1,5 a 3 ms por linha
 * estouravam), com as mesmas regras de antes.
 */

let tenant: TestTenant;
let ctx: TenantContext;
const ROWS = 6000;

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

const count = async (table: string) =>
  (await adminClient().from(table).select("*", { count: "exact", head: true }).eq("organization_id", tenant.organizationId)).count;

describe("gravação em lote", () => {
  it(`${ROWS} mensagens numa gravação: inserir, alterar e apagar`, async () => {
    const org = tenant.organizationId;
    const t0 = performance.now();
    await runInWorld(ctx, async () => {
      for (let i = 0; i < ROWS; i++) {
        store.messageLogs.push({ id: randomUUID(), organizationId: org, recipientName: `Aluno ${i}`, recipientPhone: "5511977770000", trigger: "billing_after_due", category: "billing", content: "Oi!", status: "opened", sentAt: "2026-10-01T12:00:00.000Z" } as never);
      }
    });
    const inserted = performance.now() - t0;
    expect(await count("message_logs")).toBe(ROWS);

    const t1 = performance.now();
    await runInWorld(ctx, async () => {
      for (const log of store.messageLogs) log.status = "delivered";
    });
    const updated = performance.now() - t1;
    const { data: statuses } = await adminClient().from("message_logs").select("status, content").eq("organization_id", org).limit(5);
    // So o status mudou; as outras colunas ficaram.
    expect(statuses).toEqual(Array(5).fill({ status: "delivered", content: "Oi!" }));

    const t2 = performance.now();
    await runInWorld(ctx, async () => {
      store.messageLogs.splice(0);
    });
    const removed = performance.now() - t2;
    expect(await count("message_logs")).toBe(0);
    // Bem abaixo do limite de 8 s por chamada.
    expect(Math.max(inserted, updated, removed)).toBeLessThan(6000);
  }, 120_000);

  it("linha de outro espaço no meio do lote: nada é gravado", async () => {
    const other = await createTestTenant();
    try {
      const foreignId = randomUUID();
      await adminClient().from("message_logs").insert({ id: foreignId, organization_id: other.organizationId, recipient_name: "X", recipient_phone: "1", trigger: "billing_after_due", category: "billing", content: "x", status: "opened", sent_at: "2026-10-01T12:00:00.000Z" });
      const org = tenant.organizationId;
      await expect(
        runInWorld(ctx, async () => {
          for (const id of [randomUUID(), foreignId, randomUUID()]) {
            store.messageLogs.push({ id, organizationId: org, recipientName: "Y", recipientPhone: "1", trigger: "billing_after_due", category: "billing", content: "y", status: "opened", sentAt: "2026-10-01T12:00:00.000Z" } as never);
          }
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await count("message_logs")).toBe(0);
    } finally {
      await other.remove();
    }
  });
});
