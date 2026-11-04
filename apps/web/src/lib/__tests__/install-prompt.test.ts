import { describe, expect, it } from "vitest";
import { dismissInstall, installPlatform, shouldOfferInstall } from "../install-prompt";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const WIN_FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0";

const base = { maxTouchPoints: 0, standalone: false, canPrompt: false };

describe("onde sugerir instalar", () => {
  it("navegador com janela de instalação usa a dele", () => {
    expect(installPlatform({ ...base, userAgent: MAC_CHROME, canPrompt: true })).toBe("prompt");
  });

  it("iPhone ensina o caminho pelo Compartilhar", () => {
    expect(installPlatform({ ...base, userAgent: IPHONE, maxTouchPoints: 5 })).toBe("ios");
  });

  it("iPad que se apresenta como Mac também é iOS", () => {
    expect(installPlatform({ ...base, userAgent: MAC_SAFARI, maxTouchPoints: 5 })).toBe("ios");
  });

  it("Safari do Mac instala pelo Dock", () => {
    expect(installPlatform({ ...base, userAgent: MAC_SAFARI })).toBe("mac-safari");
  });

  it("Chrome sem a janela liberada e Firefox não recebem sugestão", () => {
    expect(installPlatform({ ...base, userAgent: MAC_CHROME })).toBeNull();
    expect(installPlatform({ ...base, userAgent: WIN_FIREFOX })).toBeNull();
  });

  it("já instalado nunca sugere", () => {
    expect(installPlatform({ ...base, userAgent: IPHONE, standalone: true })).toBeNull();
    expect(installPlatform({ ...base, userAgent: MAC_CHROME, standalone: true, canPrompt: true })).toBeNull();
  });
});

describe("quando sugerir de novo", () => {
  it("sugere na primeira vez", () => {
    expect(shouldOfferInstall(undefined, "2026-11-04")).toBe(true);
  });

  it("depois do Agora não, espera 14 dias", () => {
    const state = dismissInstall(undefined, "2026-11-04");
    expect(shouldOfferInstall(state, "2026-11-17")).toBe(false);
    expect(shouldOfferInstall(state, "2026-11-18")).toBe(true);
  });

  it("na terceira recusa, para de sugerir", () => {
    let state = dismissInstall(undefined, "2026-01-01");
    state = dismissInstall(state, "2026-02-01");
    state = dismissInstall(state, "2026-03-01");
    expect(state.dismissals).toBe(3);
    expect(shouldOfferInstall(state, "2026-12-01")).toBe(false);
  });
});
