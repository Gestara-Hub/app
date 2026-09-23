import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/session";

describe("safeRedirectPath (destino pos-login)", () => {
  it.each([
    ["//evil.com"],
    ["//evil.com/classes"],
    ["/\\evil.com"],
    ["/\\/evil.com"],
    ["https://x"],
    ["http://evil.com/"],
    ["javascript:alert(1)"],
    ["classes"],
    ["/\n/evil.com"],
    ["/classes\n"],
    ["/\t/evil.com"],
    ["/\r"],
    ["/\u0000"],
    ["/\u007f"],
    [decodeURIComponent("/%0a")],
    [""],
  ])("rejeita %j", (from) => {
    expect(safeRedirectPath(from)).toBeUndefined();
  });

  it("rejeita valores nao-string", () => {
    for (const from of [undefined, null, 42, {}, ["/classes"], true]) {
      expect(safeRedirectPath(from)).toBeUndefined();
    }
  });

  it("rejeita caminho gigante", () => {
    expect(safeRedirectPath(`/${"a".repeat(2048)}`)).toBeUndefined();
  });

  it("aceita caminho relativo com query e hash", () => {
    expect(safeRedirectPath("/classes?tab=1#x")).toBe("/classes?tab=1#x");
  });

  it("aceita a raiz", () => {
    expect(safeRedirectPath("/")).toBe("/");
  });

  it("aceita rota aninhada", () => {
    expect(safeRedirectPath("/classes/sessions/abc")).toBe("/classes/sessions/abc");
  });
});
