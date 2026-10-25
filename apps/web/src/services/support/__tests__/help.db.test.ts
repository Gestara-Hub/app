import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestTenant, ownerSql, signInAs, type TestTenant } from "@/test/db";

/**
 * Uso da ajuda do app no Supabase local (doc technical/26, 18.2): busca sem
 * resultado e "isso ajudou?" ficam registrados, sem dado pessoal.
 */
const { logHelpEventAction } = await import("../helpActions");
const { unwrap } = await import("@/services/server/action");
const { resetRateLimit } = await import("@/lib/security/rate-limit");

let tenant: TestTenant;
const owner = await ownerSql();

beforeAll(async () => {
  tenant = await createTestTenant({ name: "Espaço da ajuda" });
});

afterAll(async () => {
  await owner`delete from platform.help_events where organization_id = ${tenant.organizationId}`;
  await tenant.remove();
  await owner.end();
});

beforeEach(async () => {
  await signInAs(tenant.owner);
  await resetRateLimit(`help:${tenant.owner.id}`);
  await owner`delete from platform.help_events where organization_id = ${tenant.organizationId}`;
});

const rows = () =>
  owner<{ kind: string; term: string | null; chunk_id: string | null; route: string | null }[]>`
    select kind, term, chunk_id, route from platform.help_events where organization_id = ${tenant.organizationId} order by created_at`;

describe("uso da ajuda", () => {
  it("guarda a busca sem resultado em minúsculas, com a tela", async () => {
    await unwrap(logHelpEventAction({ kind: "miss", term: "  Emitir NOTA fiscal ", route: "/finance" }));
    expect(await rows()).toEqual([{ kind: "miss", term: "emitir nota fiscal", chunk_id: null, route: "/finance" }]);
  });

  it("masca CPF e e-mail antes de guardar", async () => {
    await unwrap(logHelpEventAction({ kind: "miss", term: "cpf 529.982.247-25 ana@teste.com" }));
    const [row] = await rows();
    expect(row.term).not.toMatch(/529\.982|ana@teste/);
  });

  it("guarda o 'isso ajudou?' por trecho", async () => {
    await unwrap(logHelpEventAction({ kind: "helpful", chunkId: "alunos#cadastrar-um-aluno", route: "/clients" }));
    await unwrap(logHelpEventAction({ kind: "not_helpful", chunkId: "alunos#cadastrar-um-aluno" }));
    expect((await rows()).map((r) => [r.kind, r.chunk_id])).toEqual([
      ["helpful", "alunos#cadastrar-um-aluno"],
      ["not_helpful", "alunos#cadastrar-um-aluno"],
    ]);
  });

  it("termo curto demais não é guardado", async () => {
    await unwrap(logHelpEventAction({ kind: "miss", term: " a " }));
    expect(await rows()).toEqual([]);
  });

  it("passou do limite por minuto: ignora em silêncio, sem erro", async () => {
    for (let i = 0; i < 45; i += 1) await unwrap(logHelpEventAction({ kind: "miss", term: `busca ${i}` }));
    expect((await rows()).length).toBe(40);
  });
});
