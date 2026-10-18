import { beforeEach, describe, expect, it } from "vitest";
import { hasPreviousRoute, recordNavigation, resetNavigationHistory } from "@/lib/navigation-history";

describe("Voltar: rotas visitadas no app", () => {
  beforeEach(() => resetNavigationHistory());

  it("aberta direto não tem para onde voltar", () => {
    recordNavigation("/clients/cli-1");
    expect(hasPreviousRoute()).toBe(false);
  });

  it("vindo de outra tela, volta para ela; depois de voltar, não sai do app", () => {
    recordNavigation("/classes/t-1");
    recordNavigation("/clients/cli-1");
    expect(hasPreviousRoute()).toBe(true);
    recordNavigation("/classes/t-1"); // voltou
    expect(hasPreviousRoute()).toBe(false);
  });

  it("a mesma rota de novo não conta", () => {
    recordNavigation("/classes");
    recordNavigation("/classes");
    expect(hasPreviousRoute()).toBe(false);
  });
});
