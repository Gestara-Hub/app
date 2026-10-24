import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { can } from "@/lib/permissions";

describe("cartão do plano na barra lateral (achado 71)", () => {
  it("só o dono pode contratar plano", () => {
    expect(can("owner", "subscription:manage")).toBe(true);
    for (const profile of ["manager", "attendant", "professional"]) {
      expect(can(profile as never, "subscription:manage")).toBe(false);
    }
  });

  it("a barra lateral só mostra o cartão a quem pode contratar", () => {
    const sidebar = readFileSync(fileURLToPath(new URL("../app-sidebar.tsx", import.meta.url)), "utf8");
    expect(sidebar).toMatch(/can\("subscription:manage"\) \? <SidebarSubscriptionCard \/> : null/);
  });
});
