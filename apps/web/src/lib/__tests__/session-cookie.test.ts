import { describe, expect, it } from "vitest";
import type { UserView } from "@gestarahub/contracts";
import { decodeSession, encodeSession } from "../session-cookie";

// Cookie do app assinado (auditoria de 30/10/2026): claims forjadas nao valem.

const user = {
  id: "u-1",
  organizationId: "11111111-1111-4111-8111-111111111111",
  name: "José Ávila",
  email: "jose@exemplo.com",
  profile: "professional",
  status: "active",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
} as UserView;

describe("cookie de sessão assinado", () => {
  it("o que o servidor grava, ele lê (com acento no nome)", () => {
    expect(decodeSession(encodeSession(user))).toEqual(user);
  });

  it("cookie sem assinatura (o formato antigo) não vale", () => {
    const unsigned = Buffer.from(JSON.stringify(user), "utf8").toString("base64");
    expect(decodeSession(unsigned)).toBeNull();
  });

  it("trocar o perfil ou o espaço nas claims invalida a assinatura", () => {
    const [, signature] = encodeSession(user).split(".");
    const forged = Buffer.from(JSON.stringify({ ...user, profile: "owner", organizationId: "outro" }), "utf8").toString("base64");
    expect(decodeSession(`${forged}.${signature}`)).toBeNull();
  });

  it("assinatura cortada, vazia ou lixo não vale", () => {
    const value = encodeSession(user);
    expect(decodeSession(value.slice(0, -3))).toBeNull();
    expect(decodeSession(`${value.split(".")[0]}.`)).toBeNull();
    expect(decodeSession("abc.def")).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
  });
});
