import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { UserProfile } from "@gestarahub/contracts";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { auditLogPageFor } from "../auditLogPage";

/**
 * Auditoria no banco (doc 19, fase 3): filtros, visibilidade por perfil e
 * paginacao rodam na consulta. Antes, a tela trazia as 1.000 mais recentes e
 * filtrava depois (o filtro escondia eventos antigos), e o perfil vinha do
 * navegador.
 */

let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
  const org = tenant.organizationId;
  const row = (i: number, extra: Record<string, unknown>) => ({
    id: randomUUID(),
    organization_id: org,
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    actor: { userId: i % 2 === 0 ? "usr-ana" : "usr-bia", name: i % 2 === 0 ? "Ana" : "Bia", profile: "owner" },
    action: "created",
    target: { type: "client", id: `c-${i}`, label: `Aluno ${i}` },
    summary: `Ana cadastrou o aluno ${i}`,
    security: false,
    ...extra,
  });
  const rows = [
    // 1.100 eventos comuns (passa do corte de 1.000 do PostgREST).
    ...Array.from({ length: 1100 }, (_, i) => row(i, {})),
    // O mais antigo de todos, de um tipo raro: antes sumia com o filtro.
    row(-1, { target: { type: "financial_entry", id: "f-1", label: "Aluguel" }, summary: "Ana lançou 100%_aluguel" }),
    // Seguranca: so o Dono ve o de Dono; o Gerente ve o de Atendente.
    row(2000, { security: true, target: { type: "user", id: "u-1", label: "Dono", profile: "owner" }, summary: "Ana mudou o dono" }),
    row(2001, { security: true, target: { type: "user", id: "u-2", label: "Atendente", profile: "attendant" }, summary: "Ana mudou o atendente" }),
    row(2002, { security: true, target: { type: "settings", id: "s-1", label: "Configurações" }, summary: "Ana mudou as configurações" }),
  ];
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await adminClient().from("audit_logs").insert(rows.slice(i, i + 500));
    if (error) throw new Error(error.message);
  }
});

afterEach(async () => {
  await tenant.remove();
});

const pageOf = (profile: UserProfile, filter = {}, page = 1, size = 50) =>
  auditLogPageFor({ client: adminClient() as never, organizationId: tenant.organizationId, profile }, filter, page, size);

describe("auditoria paginada no banco", () => {
  it("total de verdade e páginas na ordem, mais recente primeiro", async () => {
    const first = await pageOf("owner");
    expect(first.total).toBe(1104);
    expect(first.items).toHaveLength(50);
    expect(first.items[0].summary).toBe("Ana mudou as configurações");
    const last = await pageOf("owner", {}, 23);
    expect(last.items).toHaveLength(4);
    expect(last.hasMore).toBe(false);
    expect(last.items.at(-1)?.target.type).toBe("financial_entry");
  });

  it("filtro por tipo acha o evento mais antigo (antes sumia depois do corte de 1.000)", async () => {
    const result = await pageOf("owner", { entityType: "financial_entry" });
    expect(result.items.map((e) => e.target.id)).toEqual(["f-1"]);
  });

  it("filtros por autor e busca (com % e _ como texto)", async () => {
    expect((await pageOf("owner", { actorId: "usr-bia" })).total).toBe(552);
    expect((await pageOf("owner", { search: "100%_alu" })).items.map((e) => e.target.id)).toEqual(["f-1"]);
    expect((await pageOf("owner", { search: "100%x" })).total).toBe(0);
  });

  it("Gerente não vê eventos de Dono nem de Configurações; outros perfis não veem nada", async () => {
    const manager = await pageOf("manager", { security: true });
    expect(manager.items.map((e) => e.target.id)).toEqual(["u-2"]);
    expect((await pageOf("owner", { security: true })).total).toBe(3);
    expect((await pageOf("professional")).total).toBe(0);
  });
});
