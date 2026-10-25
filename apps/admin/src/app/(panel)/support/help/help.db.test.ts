import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ownerSql } from "@/test/local";

vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

/** Uso da ajuda no painel (doc technical/26, 18.2): contagem de buscas sem resultado e do "isso ajudou?". */
const { listHelpFeedback, listHelpMisses } = await import("@/lib/server/support");
const owner = ownerSql();

const TAG = "teste-ajuda-painel";

beforeEach(async () => {
  await owner`delete from platform.help_events where route = ${TAG}`;
});

afterAll(async () => {
  await owner`delete from platform.help_events where route = ${TAG}`;
  await owner.end();
});

const add = (kind: string, term: string | null, chunk: string | null, org: string | null, ago = "0 days") =>
  owner`insert into platform.help_events (kind, term, chunk_id, route, organization_id, created_at)
        values (${kind}, ${term}, ${chunk}, ${TAG}, ${org}, now() - ${ago}::interval)`;

describe("uso da ajuda", () => {
  it("conta buscas e espaços diferentes, a mais repetida primeiro", async () => {
    await add("miss", "emitir nota fiscal", null, "org-a");
    await add("miss", "emitir nota fiscal", null, "org-b");
    await add("miss", "emitir nota fiscal", null, "org-a");
    await add("miss", "backup dos dados", null, "org-a");
    const mine = (await listHelpMisses()).filter((m) => ["emitir nota fiscal", "backup dos dados"].includes(m.term));
    expect(mine.map((m) => [m.term, m.searches, m.spaces])).toEqual([
      ["emitir nota fiscal", 3, 2],
      ["backup dos dados", 1, 1],
    ]);
  });

  it("ignora o que passou do período", async () => {
    await add("miss", "termo antigo de teste", null, "org-a", "45 days");
    expect((await listHelpMisses(30)).some((m) => m.term === "termo antigo de teste")).toBe(false);
    expect((await listHelpMisses(60)).some((m) => m.term === "termo antigo de teste")).toBe(true);
  });

  it("feedback por trecho, o que menos ajuda primeiro", async () => {
    await add("helpful", null, "teste#bom", "org-a");
    await add("not_helpful", null, "teste#ruim", "org-a");
    await add("not_helpful", null, "teste#ruim", "org-b");
    await add("helpful", null, "teste#ruim", "org-b");
    const mine = (await listHelpFeedback()).filter((row) => row.chunkId.startsWith("teste#"));
    expect(mine).toEqual([
      { chunkId: "teste#ruim", helpful: 1, notHelpful: 2 },
      { chunkId: "teste#bom", helpful: 1, notHelpful: 0 },
    ]);
  });
});

describe("filtros e paginação do uso da ajuda", () => {
  it("busca pelo termo, conta o total e pagina", async () => {
    const { helpMissTotals, listHelpMissesPage } = await import("@/lib/server/support");
    for (let i = 1; i <= 27; i++) await add("miss", `termo paginado ${String(i).padStart(2, "0")}`, null, "org-a");
    await add("miss", "termo paginado 01", null, "org-b");
    await add("miss", "outra coisa de teste", null, "org-a");
    const first = await listHelpMissesPage({ days: 30, q: "termo paginado", page: 1 });
    expect(first.total).toBe(27);
    expect(first.rows).toHaveLength(25);
    expect(first.rows[0]).toMatchObject({ term: "termo paginado 01", searches: 2, spaces: 2 });
    expect(first.hasNext).toBe(true);
    const second = await listHelpMissesPage({ days: 30, q: "termo paginado", page: 2 });
    expect(second.rows).toHaveLength(2);
    expect(await listHelpMissesPage({ days: 30, q: "termo paginado", page: 9 })).toMatchObject({ page: 2, total: 27 });
    expect((await listHelpMissesPage({ days: 30, q: "%", page: 1 })).total).toBe(0);
    expect((await listHelpMissesPage({ days: 30, q: "outra coisa", page: 1 })).rows.map((r) => r.term)).toEqual(["outra coisa de teste"]);
    const totals = await helpMissTotals(30);
    expect(totals.searches).toBeGreaterThanOrEqual(29);
  });

  it("o período de 7, 30 e 90 dias muda o que aparece", async () => {
    const { listHelpMissesPage } = await import("@/lib/server/support");
    await add("miss", "busca de 20 dias", null, "org-a", "20 days");
    await add("miss", "busca de 60 dias", null, "org-a", "60 days");
    const terms = async (days: number) => (await listHelpMissesPage({ days, q: "busca de", page: 1 })).rows.map((r) => r.term).sort();
    expect(await terms(7)).toEqual([]);
    expect(await terms(30)).toEqual(["busca de 20 dias"]);
    expect(await terms(90)).toEqual(["busca de 20 dias", "busca de 60 dias"]);
  });
});
