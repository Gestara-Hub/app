import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/** Passada final de 24/10/2026 (docs/qa/2026-10-24-teste-final.md). */
describe("achados 82 a 84 da passada final", () => {
  it("campos do checkout do plano com letra de 16 px no celular", () => {
    for (const file of [
      "../../features/subscription/components/subscription-checkout-view.tsx",
    ]) {
      expect(read(file)).not.toMatch(/<Input[^>]*className="h-9 text-xs/);
    }
  });

  it("a lista de recursos do Plano GestaraHub não usa a sigla DRE", () => {
    expect(read("../../features/settings/components/subscription-plan-card.tsx")).not.toContain("DRE gerencial");
  });

  it("a caixa das ações da cobrança cresce com dois botões (valor não encosta nos ícones)", () => {
    const billing = read("../../features/turmas/components/billing-view.tsx");
    expect(billing).toContain("min-h-8 min-w-8");
    expect(billing).not.toMatch(/flex size-8 items-center justify-center">\s*\{renderChargeActions/);
  });
});
