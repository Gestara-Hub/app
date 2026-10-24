import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";

/**
 * Historico do que roda sem pessoa (doc technical/23): o aviso do Asaas
 * repetido e reconhecido, a execucao da rotina fica registrada e o que ela
 * cria (ou nao consegue) sai resumido por espaco na Auditoria, com o
 * "sistema" como autor e o codigo do erro.
 */

const generators = vi.hoisted(() => ({
  generateMembershipChargesWithSummary: vi.fn(),
  materializeRecurrencesWithSummary: vi.fn(),
}));
vi.mock("@/services/billing/membershipBackend", () => ({
  generateMembershipChargesWithSummary: generators.generateMembershipChargesWithSummary,
}));
vi.mock("@/services/finance/financeBackend", () => ({
  materializeRecurrencesWithSummary: generators.materializeRecurrencesWithSummary,
}));

const { beginWebhookEvent, finishJobRun, finishWebhookEvent, startJobRun } = await import("../backgroundRuns");
const { runDailySpaceTasks } = await import("../dailyRoutine");
const { auditLogPageFor } = await import("@/services/audit/auditLogPage");

let tenant: TestTenant;
const admin = adminClient();

beforeEach(async () => {
  vi.clearAllMocks();
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

describe("avisos do parceiro de pagamentos", () => {
  it("o mesmo aviso já tratado é reconhecido como repetido", async () => {
    const eventId = `evt_${randomUUID()}`;
    const first = await beginWebhookEvent(admin, { eventId, event: "PAYMENT_RECEIVED", paymentId: "pay_1" });
    expect(first.duplicate).toBe(false);
    await finishWebhookEvent(admin, first.id, { status: "processed", outcome: "teste" });

    const again = await beginWebhookEvent(admin, { eventId, event: "PAYMENT_RECEIVED", paymentId: "pay_1" });
    expect(again).toEqual({ id: first.id, duplicate: true });
    await admin.from("webhook_events").delete().eq("event_id", eventId);
  });

  it("aviso que falhou é tratado de novo quando o parceiro reenvia", async () => {
    const eventId = `evt_${randomUUID()}`;
    const first = await beginWebhookEvent(admin, { eventId, event: "PAYMENT_RECEIVED" });
    await finishWebhookEvent(admin, first.id, { status: "failed", errorReference: "ABCD1234" });

    const retry = await beginWebhookEvent(admin, { eventId, event: "PAYMENT_RECEIVED" });
    expect(retry).toEqual({ id: first.id, duplicate: false });
    const { data } = await admin.from("webhook_events").select("attempts, status").eq("event_id", eventId).single();
    expect(data).toEqual({ attempts: 2, status: "received" });
    await admin.from("webhook_events").delete().eq("event_id", eventId);
  });
});

describe("rotina diária", () => {
  it("registra a execução, com o resultado e os códigos dos erros", async () => {
    const id = await startJobRun(admin, "cron.daily");
    await finishJobRun(admin, id, { organizations: 3, failures: 1, totals: { membershipCharges: 12 }, errorReferences: ["ABCD1234"] });
    const { data } = await admin.from("job_runs").select("status, failures, totals, error_references, finished_at").eq("id", id).single();
    expect(data).toMatchObject({ status: "partial", failures: 1, totals: { membershipCharges: 12 }, error_references: ["ABCD1234"] });
    expect(data?.finished_at).toBeTruthy();
    await admin.from("job_runs").delete().eq("id", id);
  });

  it("resume por espaço o que criou e registra a falha com o código", async () => {
    generators.generateMembershipChargesWithSummary.mockResolvedValue({
      count: 2,
      items: ["Ana Souza · novembro/2026", "Bia Lima · novembro/2026"],
    });
    generators.materializeRecurrencesWithSummary.mockRejectedValue(new Error("banco fora do ar"));
    const totals = { membershipCharges: 0, recurrenceEntries: 0, failures: 0, errorReferences: [] as string[] };

    await runDailySpaceTasks(admin, tenant.organizationId, totals);

    expect(totals).toMatchObject({ membershipCharges: 2, failures: 1 });
    expect(totals.errorReferences).toHaveLength(1);
    const { data: rows } = await admin
      .from("audit_logs")
      .select("summary, actor, source, failed, error_reference, changes")
      .eq("organization_id", tenant.organizationId)
      .order("timestamp", { ascending: true });
    expect(rows).toHaveLength(2);
    expect(rows?.[0]).toMatchObject({
      summary: "Rotina diária gerou 2 mensalidades",
      actor: { kind: "system", name: "Rotina diária" },
      source: "cron.daily",
      failed: false,
    });
    expect(JSON.stringify(rows?.[0].changes)).toContain("Ana Souza · novembro/2026");
    expect(rows?.[1]).toMatchObject({ source: "cron.daily", failed: true, error_reference: totals.errorReferences[0] });
    expect(rows?.[1].summary).toContain(`código ${totals.errorReferences[0]}`);
  });

  it("sem nada a fazer, nada na Auditoria", async () => {
    generators.generateMembershipChargesWithSummary.mockResolvedValue({ count: 0, items: [] });
    generators.materializeRecurrencesWithSummary.mockResolvedValue({ count: 0, items: [] });
    await runDailySpaceTasks(admin, tenant.organizationId, { membershipCharges: 0, recurrenceEntries: 0, failures: 0, errorReferences: [] });
    const { count } = await admin.from("audit_logs").select("id", { count: "exact", head: true }).eq("organization_id", tenant.organizationId);
    expect(count).toBe(0);
  });
});

describe("Auditoria: filtro Pessoas / Sistema", () => {
  it("separa o que foi feito por pessoas do que foi feito pelo sistema, e só o que falhou", async () => {
    generators.generateMembershipChargesWithSummary.mockResolvedValue({ count: 1, items: ["Ana Souza · novembro/2026"] });
    generators.materializeRecurrencesWithSummary.mockRejectedValue(new Error("falhou"));
    await runDailySpaceTasks(admin, tenant.organizationId, { membershipCharges: 0, recurrenceEntries: 0, failures: 0, errorReferences: [] });
    await admin.from("audit_logs").insert({
      organization_id: tenant.organizationId,
      actor: { userId: tenant.owner.id, name: "Teste owner", profile: "owner" },
      action: "created",
      target: { type: "client", label: "Ana Souza" },
      summary: "Teste owner cadastrou Ana Souza",
    });
    const ctx = { client: admin, organizationId: tenant.organizationId, profile: "owner" as const };

    const system = await auditLogPageFor(ctx, { actorKind: "system" }, 1, 50);
    const people = await auditLogPageFor(ctx, { actorKind: "user" }, 1, 50);
    const failed = await auditLogPageFor(ctx, { failed: true }, 1, 50);

    expect(system.items.map((e) => e.source)).toEqual(["cron.daily", "cron.daily"]);
    expect(people.items.map((e) => e.summary)).toEqual(["Teste owner cadastrou Ana Souza"]);
    expect(failed.items).toHaveLength(1);
    expect(failed.items[0]).toMatchObject({ failed: true, source: "cron.daily" });
    expect(failed.items[0].errorReference).toBeTruthy();
  });
});
