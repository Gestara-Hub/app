import { afterEach, describe, expect, it, vi } from "vitest";
import { openWhatsApp } from "../open";

/**
 * WhatsApp no app instalado (17/11/2026): abrir em janela nova deixava a volta
 * numa tela em branco; no app instalado a navegacao vai na mesma janela.
 */

function fakeWindow(standalone: boolean) {
  const assign = vi.fn();
  const open = vi.fn();
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({ matches: standalone && query === "(display-mode: standalone)" }),
    location: { assign },
    open,
  });
  vi.stubGlobal("navigator", {});
  return { assign, open };
}

afterEach(() => vi.unstubAllGlobals());

describe("openWhatsApp", () => {
  const url = "https://api.whatsapp.com/send?phone=5511977770000&text=Oi";

  it("no app instalado, abre na mesma janela", () => {
    const w = fakeWindow(true);
    openWhatsApp(url);
    expect(w.assign).toHaveBeenCalledWith(url);
    expect(w.open).not.toHaveBeenCalled();
  });

  it("no navegador, abre em aba nova", () => {
    const w = fakeWindow(false);
    openWhatsApp(url);
    expect(w.open).toHaveBeenCalledWith(url, "_blank", "noopener,noreferrer");
    expect(w.assign).not.toHaveBeenCalled();
  });
});
