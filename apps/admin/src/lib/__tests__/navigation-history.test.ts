import { beforeEach, describe, expect, it } from "vitest";
import {
  hasPreviousRoute,
  markHistoryPop,
  recordNavigation,
  resetNavigationHistory,
} from "@/lib/navigation-history";

describe("Voltar: rotas visitadas no painel", () => {
  beforeEach(() => resetNavigationHistory());

  it("aberta direto não tem para onde voltar", () => {
    recordNavigation("/spaces/org-1");
    expect(hasPreviousRoute()).toBe(false);
  });

  it("vindo de outra tela, volta para ela; depois de voltar, não sai do app", () => {
    recordNavigation("/support/th-1");
    recordNavigation("/spaces/org-1");
    expect(hasPreviousRoute()).toBe(true);
    markHistoryPop(); // voltou pelo navegador
    recordNavigation("/support/th-1");
    expect(hasPreviousRoute()).toBe(false);
  });

  it("ir para a frente para a tela anterior empilha (conversa > espaço > conversa)", () => {
    recordNavigation("/support/th-1");
    recordNavigation("/spaces/org-1");
    recordNavigation("/support/th-1"); // pelo link, nao pelo voltar
    expect(hasPreviousRoute()).toBe(true);
    markHistoryPop();
    recordNavigation("/spaces/org-1");
    expect(hasPreviousRoute()).toBe(true);
  });

  it("a mesma rota de novo não conta", () => {
    recordNavigation("/spaces");
    recordNavigation("/spaces");
    expect(hasPreviousRoute()).toBe(false);
  });
});
