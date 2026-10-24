import { describe, expect, it } from "vitest";
import { isPlatformAdminUser } from "../platform-admin";

describe("administrador da plataforma no app dos clientes", () => {
  it("só o marcador gravado pelo servidor conta", () => {
    expect(isPlatformAdminUser({ app_metadata: { platform: true } })).toBe(true);
  });

  it("usuário de espaço, sem marcador ou com valor diferente de true não conta", () => {
    expect(isPlatformAdminUser({ app_metadata: {} })).toBe(false);
    expect(isPlatformAdminUser({ app_metadata: { platform: "true" } })).toBe(false);
    expect(isPlatformAdminUser({ app_metadata: { provider: "email" } })).toBe(false);
    expect(isPlatformAdminUser({ app_metadata: null })).toBe(false);
    expect(isPlatformAdminUser(null)).toBe(false);
    expect(isPlatformAdminUser(undefined)).toBe(false);
  });
});
