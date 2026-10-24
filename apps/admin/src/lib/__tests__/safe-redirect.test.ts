import { describe, expect, it } from "vitest";
import { safeNext } from "../safe-redirect";

describe("destino depois do login", () => {
  it("aceita só caminho do próprio painel", () => {
    expect(safeNext("/audit?group=auth")).toBe("/audit?group=auth");
    expect(safeNext("/team")).toBe("/team");
  });

  it("recusa endereço externo, protocolo e telas de entrada", () => {
    for (const value of ["//evil.com", "https://evil.com", "javascript:alert(1)", "/\\evil.com", "/login", "/login/x", "/mfa", "", undefined, null]) {
      expect(safeNext(value as string | null | undefined)).toBe("/");
    }
  });
});
