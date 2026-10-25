import { describe, expect, it } from "vitest";
import { browserName, clientInfoText, systemName } from "../client-info";

const CHROME_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const SAFARI_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const EDGE_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0";

describe("contexto técnico do problema", () => {
  it("reconhece navegador e sistema", () => {
    expect(browserName(CHROME_MAC)).toBe("Chrome 130");
    expect(browserName(SAFARI_IOS)).toBe("Safari 17");
    expect(browserName(EDGE_WIN)).toBe("Edge 130");
    expect(browserName(FIREFOX_LINUX)).toBe("Firefox 131");
    expect(systemName(CHROME_MAC)).toBe("macOS");
    expect(systemName(SAFARI_IOS)).toBe("iOS");
    expect(systemName(EDGE_WIN)).toBe("Windows");
    expect(systemName(FIREFOX_LINUX)).toBe("Linux");
  });

  it("monta o texto curto com perfil e versão", () => {
    expect(clientInfoText({ userAgent: SAFARI_IOS, profile: "owner", version: "abc1234" })).toBe(
      "Safari 17 no iOS (celular) · perfil owner · versão abc1234",
    );
    expect(clientInfoText({ userAgent: CHROME_MAC, profile: "manager" })).toBe("Chrome 130 no macOS (computador) · perfil manager");
  });

  it("sem User-Agent, não quebra", () => {
    expect(clientInfoText({ userAgent: null, profile: "owner" })).toBe("Navegador desconhecido no sistema desconhecido (computador) · perfil owner");
  });
});
