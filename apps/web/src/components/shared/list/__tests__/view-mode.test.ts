import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEW_MODE,
  resolveViewMode,
  shouldShowViewModeTip,
  VIEW_MODE_TIP_MIN_ITEMS,
  viewModeTipSeenKey,
} from "@/components/shared/list/view-mode-script";

describe("modo de visualização: padrão", () => {
  it("sem escolha salva, toda listagem abre em Lista", () => {
    expect(DEFAULT_VIEW_MODE).toBe("list");
    expect(resolveViewMode(null)).toBe("list");
    expect(resolveViewMode(undefined)).toBe("list");
    expect(resolveViewMode("")).toBe("list");
    expect(resolveViewMode("cards")).toBe("list");
  });

  it("a escolha salva vale", () => {
    expect(resolveViewMode("grid")).toBe("grid");
    expect(resolveViewMode("list", "grid")).toBe("list");
  });
});

describe("modo de visualização: dica Lista ou cards", () => {
  it("aparece a partir do 1º registro", () => {
    expect(VIEW_MODE_TIP_MIN_ITEMS).toBe(1);
    expect(shouldShowViewModeTip(0, false)).toBe(false);
    expect(shouldShowViewModeTip(1, false)).toBe(true);
    expect(shouldShowViewModeTip(12, false)).toBe(true);
  });

  it("uma vez por tela: vista não volta", () => {
    expect(shouldShowViewModeTip(5, true)).toBe(false);
    expect(viewModeTipSeenKey("clients")).toBe("gestarahub_coachmark_view_mode_clients");
    expect(viewModeTipSeenKey("plans")).not.toBe(viewModeTipSeenKey("turmas"));
  });

  it("limite abaixo de 1 não mostra a dica em tela vazia", () => {
    expect(shouldShowViewModeTip(0, false, 0)).toBe(false);
    expect(shouldShowViewModeTip(2, false, 3)).toBe(false);
    expect(shouldShowViewModeTip(3, false, 3)).toBe(true);
  });
});
