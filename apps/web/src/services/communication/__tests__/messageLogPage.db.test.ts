import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { MessageLog } from "@gestarahub/contracts";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { messageKindMatches } from "../messagesService";
import { messageLogPageFor } from "../messageLogPage";

/**
 * Historico de mensagens no banco (doc 19, secao 12): filtros e paginacao na
 * consulta, com as mesmas regras do espaco local (`messageKindMatches`).
 */

let tenant: TestTenant;
const TRIGGERS: [string, string][] = [
  ["billing_after_due", "billing"],
  ["birthday_greeting", "retention"],
  ["class_canceled", "administrative"],
  ["manual_broadcast", "administrative"],
];

let anaId = "";

beforeEach(async () => {
  tenant = await createTestTenant();
  anaId = randomUUID();
  const { error: clientError } = await adminClient()
    .from("clients")
    .insert({ id: anaId, organization_id: tenant.organizationId, name: "Ana", phone: "11977770000", status: "active" });
  if (clientError) throw new Error(clientError.message);
  const rows = Array.from({ length: 1200 }, (_, i) => {
    const [trigger, category] = TRIGGERS[i % 4];
    return {
      id: randomUUID(),
      organization_id: tenant.organizationId,
      recipient_name: i === 7 ? "Bia 100%_Souza" : `Aluno ${i}`,
      recipient_phone: i === 9 ? "5511912345678" : "5511977770000",
      trigger,
      category,
      content: i === 11 ? "Aula de sábado cancelada" : "Oi!",
      status: i % 3 === 0 ? "delivered" : "opened",
      client_id: i % 10 === 0 ? anaId : null,
      sent_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    };
  });
  for (let i = 0; i < rows.length; i += 600) {
    const { error } = await adminClient().from("message_logs").insert(rows.slice(i, i + 600));
    if (error) throw new Error(error.message);
  }
});

afterEach(async () => {
  await tenant.remove();
});

const pageOf = (filter = {}) =>
  messageLogPageFor({ client: adminClient() as never, organizationId: tenant.organizationId }, { pageSize: 25, ...filter });

describe("histórico de mensagens no banco", () => {
  it("total de verdade (passa do corte de 1.000) e mais nova primeiro", async () => {
    const first = await pageOf();
    expect(first.total).toBe(1200);
    expect(first.items).toHaveLength(25);
    expect(first.items[0].recipientName).toBe("Aluno 1199");
    const last = await pageOf({ page: 48 });
    expect(last.items.at(-1)?.recipientName).toBe("Aluno 0");
    expect(last.hasMore).toBe(false);
  });

  it("tipo igual à regra do espaço local", async () => {
    for (const kind of ["billing", "retention", "notices", "manual"] as const) {
      const result = await pageOf({ kind, pageSize: 100 });
      expect(result.total).toBe(300);
      expect(result.items.every((log: MessageLog) => messageKindMatches(log, kind))).toBe(true);
    }
  });

  it("situação, aluno e busca por nome (com % e _), telefone ou texto", async () => {
    expect((await pageOf({ status: "delivered" })).total).toBe(400);
    expect((await pageOf({ clientId: anaId })).total).toBe(120);
    expect((await pageOf({ search: "100%_sou" })).items.map((l) => l.recipientName)).toEqual(["Bia 100%_Souza"]);
    expect((await pageOf({ search: "100%x" })).total).toBe(0);
    expect((await pageOf({ search: "(11) 91234-5678" })).items.map((l) => l.recipientName)).toEqual(["Aluno 9"]);
    expect((await pageOf({ search: "sábado" })).items.map((l) => l.recipientName)).toEqual(["Aluno 11"]);
  });
});
