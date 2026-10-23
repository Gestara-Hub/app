import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import type { TenantContext } from "@/services/server/tenant";
import { communicationServiceImpl } from "@/services/communication";
import { forgetCachedWorld, runInWorld } from "@/services/world/runWorld";
import { store } from "@/services/world/store";
import { runBirthdayGreetingsFor } from "../birthdayGreetingsCron";

/**
 * Parabens na rotina de hora em hora (doc 19, secao 12): o espaco Pro com o
 * WhatsApp oficial recebe, uma vez por aluno no dia; abrir o historico nao
 * envia nada (a leitura nao grava).
 */

let tenant: TestTenant;
let ctx: TenantContext;

beforeEach(async () => {
  tenant = await createTestTenant();
  ctx = { client: adminClient(), organizationId: tenant.organizationId, userId: tenant.owner.id, profile: "owner", require: () => undefined } as unknown as TenantContext;
  const org = tenant.organizationId;
  // Hoje no horario do Brasil (o servidor roda com o fuso do Brasil).
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const ts = new Date().toISOString();
  await adminClient().from("organizations").update({ subscription: { tier: "pro", status: "active" } }).eq("id", org);
  await adminClient().from("whatsapp_connections").upsert({ organization_id: org, official_status: "connected", phone_number: "5511900000000" });
  await runInWorld(ctx, async () => {
    // Modelo de parabens ligado desde a meia-noite (o teste roda a qualquer hora).
    await communicationServiceImpl.listTemplates();
    const template = store.messageTemplates.find((t) => t.trigger === "birthday_greeting")!;
    template.enabled = true;
    template.sendHour = "00:00";
    store.clients.push({ id: randomUUID(), organizationId: org, name: "Bia", phone: "11977770000", birthDate: `2000-${today.slice(5)}`, status: "active", createdAt: ts, updatedAt: ts } as never);
  });
});

afterEach(async () => {
  forgetCachedWorld(tenant.organizationId);
  await tenant.remove();
});

const greetings = async () =>
  (await adminClient().from("message_logs").select("recipient_name").eq("organization_id", tenant.organizationId).eq("trigger", "birthday_greeting")).data ?? [];

describe("parabéns na rotina", () => {
  it("abrir o histórico não envia; a rotina envia uma vez no dia", async () => {
    await runInWorld(ctx, () => communicationServiceImpl.listLogs());
    expect(await greetings()).toEqual([]);

    // So o espaco do teste (a rotina de verdade passa por todos os conectados).
    expect(await runBirthdayGreetingsFor(tenant.organizationId)).toBe(1);
    expect(await greetings()).toEqual([{ recipient_name: "Bia" }]);

    expect(await runBirthdayGreetingsFor(tenant.organizationId)).toBe(0);
    expect(await greetings()).toHaveLength(1);
  });
});
