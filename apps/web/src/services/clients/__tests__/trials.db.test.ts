import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestTenant, type TestTenant } from "@/test/db";
import { serviceAction } from "@/services/world/serviceActions";

/** Experimental e conversao no banco: o filtro da lista e a lista de experimentais rodam no servidor. */

let tenant: TestTenant;
beforeEach(async () => {
  tenant = await createTestTenant();
});
afterEach(async () => {
  await tenant.remove();
});

describe("experimentais no banco", () => {
  it("lista filtrada e lista de experimentais respondem sem erro", async () => {
    const page = await serviceAction("clients.listPaginated", [{ trial: "trial", page: 1, pageSize: 20 }]);
    if (!page.ok) throw new Error(JSON.stringify(page.error));
    expect(page.data).toMatchObject({ items: [], total: 0 });
    const trials = await serviceAction("clients.listTrials", []);
    if (!trials.ok) throw new Error(JSON.stringify(trials.error));
    expect(trials.data).toEqual([]);
  });
});
