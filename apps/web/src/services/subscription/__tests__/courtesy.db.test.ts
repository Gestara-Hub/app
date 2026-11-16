import { afterAll, describe, expect, it, vi } from "vitest";
import { addDays, format } from "date-fns";
import type { Subscription } from "@gestarahub/contracts";
import { dateInSpace } from "@gestarahub/core/date";
import { adminClient, createTestTenant, ownerSql } from "@/test/db";

/**
 * Cortesia do GestaraHub (concedida pelo painel admin, doc technical/26 fase 3)
 * vista pelo app dos clientes: o plano pago vale sem cobranca, a volta ao Gratis
 * ja vem marcada e a rotina diaria encerra no dia certo; o dono nao desmarca.
 */
vi.mock("@/lib/email/ses", () => ({ sendPlanNoticeEmail: vi.fn(async () => ({ ok: true })) }));
const plan = await import("@/services/server/subscriptionPlan");
const { readOrganizationSubscription } = await import("@/services/server/subscription");
const owner = await ownerSql();
const admin = adminClient();
const tenant = await createTestTenant({ name: "Espaço da cortesia" });
const today = dateInSpace();
const inDays = (n: number) => format(addDays(new Date(`${today}T12:00:00`), n), "yyyy-MM-dd");

afterAll(async () => {
  await owner.begin(async (tx) => {
    await tx.unsafe("alter table platform.audit_logs disable trigger audit_logs_no_update");
    await tx`delete from platform.audit_logs where organization_id = ${tenant.organizationId}`;
    await tx.unsafe("alter table platform.audit_logs enable trigger audit_logs_no_update");
  });
  await tenant.remove();
  await owner.end();
});

const grant = (days: number) =>
  owner<{ ends: string }[]>`select platform.grant_courtesy(${tenant.organizationId}, 'pro', ${days}, 'Piloto com a academia parceira', null, 'Marcello', '127.0.0.1', 'teste')::text as ends`;

describe("cortesia no app dos clientes", () => {
  it("o plano pago vale, com fim e volta ao Grátis marcados, e o histórico explica", async () => {
    const [{ ends }] = await grant(30);
    expect(ends).toBe(inDays(30));
    const subscription = (await readOrganizationSubscription(admin, tenant.organizationId)) as Subscription;
    expect(subscription).toMatchObject({
      tier: "pro",
      status: "active",
      courtesyUntil: inDays(30),
      scheduledChange: { tier: "free", effectiveOn: inDays(31) },
    });
    expect(subscription.asaasSubscriptionId).toBeUndefined();
    const { listSubscriptionEvents } = await import("@/services/server/subscriptionEvents");
    const history = await listSubscriptionEvents(admin, tenant.organizationId);
    expect(history[0]).toMatchObject({ kind: "courtesy_granted", tierAfter: "pro", system: true, actorName: "Suporte do GestaraHub" });
    // O dono tambem ve na Auditoria (so ele: e dinheiro do espaco).
    const { data: audit } = await admin.from("audit_logs").select("summary, security, source").eq("organization_id", tenant.organizationId);
    expect(audit?.[0]).toMatchObject({ security: true, source: "platform" });
    expect(String(audit?.[0].summary)).toContain("Suporte do GestaraHub deu cortesia do Plano Profissional");
  });

  it("o dono não desmarca a volta ao Grátis da cortesia", async () => {
    await expect(plan.cancelScheduledPlanChange(admin, tenant.organizationId, { actor: { userId: "u", name: "Dono", profile: "owner" } })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("cortesia do GestaraHub"),
    });
  });

  it("no último dia ainda vale; no dia seguinte a rotina volta ao Grátis e registra o fim", async () => {
    const run = () => plan.runPlanDailyTasks(admin, "https://app.test", { organizationIds: [tenant.organizationId] });
    await run();
    expect((await readOrganizationSubscription(admin, tenant.organizationId))?.tier).toBe("pro");

    // Adianta o relogio da cortesia: acabou ontem, a troca vale hoje.
    const sub = (await readOrganizationSubscription(admin, tenant.organizationId)) as Subscription;
    await admin
      .from("organizations")
      .update({ subscription: { ...sub, courtesyUntil: inDays(-1), scheduledChange: { tier: "free", effectiveOn: today } } })
      .eq("id", tenant.organizationId);
    const result = await run();
    expect(result.applied).toBe(1);
    const after = (await readOrganizationSubscription(admin, tenant.organizationId)) as Subscription;
    expect(after.tier).toBe("free");
    expect(after.courtesyUntil).toBeUndefined();
    const { listSubscriptionEvents } = await import("@/services/server/subscriptionEvents");
    const history = await listSubscriptionEvents(admin, tenant.organizationId);
    expect(history[0].kind).toBe("courtesy_ended");
  });
});
