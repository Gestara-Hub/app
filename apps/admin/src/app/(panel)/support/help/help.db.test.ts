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
