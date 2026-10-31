import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/** Doc 07 §1.5: botão com texto na altura padrão (36 px), sem size sm/xs/lg nem altura no className. */
describe("altura dos botões no topo e na abertura de Recebimentos online (achado 9)", () => {
  it("o topo não tem o selo do plano (fica no cartão do menu lateral) e o Ativar conta de recebimento segue a altura padrão", () => {
    const topbar = read("../app-topbar.tsx");
    expect(topbar).not.toContain("Ver todos os planos e recursos");
    const onboarding = read("../../../features/online-payments/components/online-payments-onboarding.tsx");
    const activate = onboarding.slice(onboarding.indexOf("<Button\n                onClick={() => setDialogOpen(true)}") - 80, onboarding.indexOf("Ativar conta de recebimento"));
    expect(activate).not.toMatch(/size="lg"/);
  });
});
