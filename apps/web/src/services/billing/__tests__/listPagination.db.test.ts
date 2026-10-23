import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { listChargesFromDb } from "../billingBackend";
import { generateMembershipChargesAction } from "../membershipBackend";
import { listClientsFromDb } from "../../clients/clientsBackend";

/**
 * Doc 19, fase 0: o Supabase devolve no maximo 1.000 linhas por consulta e
 * corta o resto sem erro. As listas do espaco leem todas as paginas: com mais
 * de 1.000 mensalidades, a geracao enxerga todas e nao recria nenhuma.
 */

let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

describe("listas com mais de 1.000 linhas", () => {
  it("lê todas as mensalidades e a geração seguinte não recria nenhuma", { timeout: 120_000 }, async () => {
    const admin = adminClient();
    const planId = randomUUID();
    await admin
      .from("plans")
      .insert({ id: planId, organization_id: tenant.organizationId, name: "Mensal", price_cents: 15000, period: "monthly", status: "active" })
      .throwOnError();
    const students = Array.from({ length: 110 }, (_, i) => ({
      id: randomUUID(),
      organization_id: tenant.organizationId,
      name: `Aluno ${String(i).padStart(3, "0")}`,
      phone: "11977770000",
      plan_id: planId,
      plan_start_date: "2026-01-05",
      due_day: 10,
      membership_status: "active",
      status: "active",
    }));
    await admin.from("clients").insert(students).throwOnError();

    const created = await generateMembershipChargesAction(tenant.organizationId);
    expect(created).toBeGreaterThan(1000);

    const charges = await listChargesFromDb(tenant.organizationId, { kind: "membership" });
    expect(charges).toHaveLength(created);
    expect(new Set(charges.map((c) => c.id)).size).toBe(created);
    expect(await listClientsFromDb(tenant.organizationId)).toHaveLength(110);

    expect(await generateMembershipChargesAction(tenant.organizationId)).toBe(0);
  });
});
