import { describe, expect, it } from "vitest";
import { ADMIN_ROLES, ROLE_PERMISSIONS, can, isAdminRole } from "../permissions";

describe("papéis do painel", () => {
  it("o proprietário pode tudo o que existe", () => {
    const all = new Set(Object.values(ROLE_PERMISSIONS).flat());
    for (const permission of all) expect(can("platform_owner", permission)).toBe(true);
  });

  it("só o proprietário gere a equipe, as concessões de configuração e a LGPD", () => {
    for (const role of ADMIN_ROLES.filter((r) => r !== "platform_owner")) {
      expect(can(role, "team:manage")).toBe(false);
      expect(can(role, "team:view")).toBe(false);
      expect(can(role, "lgpd:manage")).toBe(false);
      expect(can(role, "settings:manage")).toBe(false);
      expect(can(role, "audit:view")).toBe(false);
    }
  });

  it("o suporte atende mas não mexe em plano; o financeiro concede plano mas não atende", () => {
    expect(can("platform_support", "support:reply")).toBe(true);
    expect(can("platform_support", "plans:grant")).toBe(false);
    expect(can("platform_finance", "plans:grant")).toBe(true);
    expect(can("platform_finance", "support:reply")).toBe(false);
  });

  it("só proprietário e suporte abrem a visão de suporte; o financeiro e a leitura não", () => {
    expect(can("platform_owner", "support:access")).toBe(true);
    expect(can("platform_support", "support:access")).toBe(true);
    expect(can("platform_finance", "support:access")).toBe(false);
    expect(can("platform_viewer", "support:access")).toBe(false);
  });

  it("a leitura só lê", () => {
    for (const permission of ROLE_PERMISSIONS.platform_viewer) {
      expect(permission.endsWith(":view")).toBe(true);
    }
  });

  it("sem papel não pode nada, e papel desconhecido não vale", () => {
    expect(can(undefined, "dashboard:view")).toBe(false);
    expect(isAdminRole("owner")).toBe(false);
    expect(isAdminRole("platform_owner")).toBe(true);
  });
});
