import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ownerSql } from "@/test/local";

vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

/**
 * Receita (doc technical/26, fase 7): assinantes e receita mensal pelos precos
 * aprovados (anual/12, cortesia fora), movimento e funil, so agregados.
 */
const owner = ownerSql();
const ids: string[] = [];

beforeAll(async () => {
  const make = async (name: string, subscription: Record<string, unknown>) => {
    const [row] = await owner<{ id: string }[]>`insert into public.organizations (name, model, subscription) values (${name}, 'classes', ${owner.json(subscription as never)}) returning id`;
    ids.push(row.id);
    return row.id;
  };
  await make("Receita pro mensal", { tier: "pro", interval: "monthly", status: "active" });
  await make("Receita pro anual", { tier: "pro", interval: "yearly", status: "active" });
  await make("Receita scale mensal", { tier: "scale", interval: "monthly", status: "active" });
  await make("Receita cortesia", { tier: "pro", interval: "monthly", status: "active", courtesyUntil: "2099-01-01" });
  await make("Receita livre", { tier: "free" });
});

afterAll(async () => {
  await owner`delete from public.organizations where id = any(${ids})`;
  await owner.end();
});

describe("receita", () => {
  it("soma a receita mensal sem cortesia e divide o anual por 12", async () => {
    const { subscribers } = await import("@/lib/server/revenue");
    const before = await subscribers();
    // Os dados de teste entram nas somas: confere pelo menos o que sabemos que somamos.
    const byKey = (tier: string, interval: string) => before.rows.find((r) => r.tier === tier && r.interval === interval);
    expect(byKey("pro", "monthly")!.count).toBeGreaterThanOrEqual(1);
    expect(byKey("pro", "yearly")!.mrrCents / byKey("pro", "yearly")!.count).toBeCloseTo(79900 / 12, 0);
    expect(byKey("scale", "monthly")!.mrrCents / byKey("scale", "monthly")!.count).toBe(19900);
    expect(before.courtesy).toBeGreaterThanOrEqual(1);
    expect(before.mrrCents).toBe(before.rows.reduce((s, r) => s + r.mrrCents, 0));
  });

  it("movimento traz 6 meses e o funil é coerente", async () => {
    const { movement, funnel } = await import("@/lib/server/revenue");
    const months = await movement();
    expect(months).toHaveLength(6);
    expect(months[0].month > months[5].month).toBe(true);
    expect(months[0].created).toBeGreaterThanOrEqual(5);
    const steps = await funnel();
    expect(steps.spacesTotal).toBeGreaterThanOrEqual(5);
    expect(steps.withStudents).toBeLessThanOrEqual(steps.spacesTotal);
    expect(steps.paying).toBeGreaterThanOrEqual(3);
    expect(steps.payingActive30d).toBeLessThanOrEqual(steps.paying);
  });
});
