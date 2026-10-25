import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ownerSql } from "@/test/local";

vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

/** Respostas prontas: busca no título e no texto, total e página (50 por página). */
const owner = ownerSql();
const mark = `PgMacro${Date.now().toString(36)}`;

beforeAll(async () => {
  for (let i = 1; i <= 52; i++) {
    await owner`insert into platform.support_macros (title, body) values (${`${mark} ${String(i).padStart(2, "0")}`}, ${i === 3 ? `Fale sobre o pagamento ${mark}` : "Texto comum"})`;
  }
});

afterAll(async () => {
  await owner`delete from platform.support_macros where title like ${`${mark}%`}`;
  await owner.end();
});

describe("busca de respostas prontas", () => {
  it("conta o total e pagina de 50 em 50", async () => {
    const { searchMacros } = await import("@/lib/server/macros");
    const first = await searchMacros({ q: mark });
    expect(first.total).toBe(52);
    expect(first.rows).toHaveLength(50);
    expect(first.rows[0].title).toBe(`${mark} 01`);
    const second = await searchMacros({ q: mark, page: 2 });
    expect(second.rows.map((r) => r.title)).toEqual([`${mark} 51`, `${mark} 52`]);
    expect((await searchMacros({ q: mark, page: 9 })).page).toBe(2);
  });

  it("busca no título e no texto, sem diferenciar maiúsculas, e trata curingas como letras", async () => {
    const { searchMacros } = await import("@/lib/server/macros");
    expect((await searchMacros({ q: `${mark} 07` })).total).toBe(1);
    expect((await searchMacros({ q: `PAGAMENTO ${mark}` })).rows.map((r) => r.title)).toEqual([`${mark} 03`]);
    expect((await searchMacros({ q: `${mark} %` })).total).toBe(0);
    expect((await searchMacros({ q: "x".repeat(300) })).total).toBe(0);
  });
});
