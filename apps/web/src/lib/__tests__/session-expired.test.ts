import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sessao do banco vencida (25/11/2026): a tela logada leva ao login com o aviso
 * e o endereco de volta, uma vez so; permissao negada (403) e pagina publica nao.
 */

async function freshModule() {
  vi.resetModules();
  return import("../session-expired");
}

const assign = vi.fn();

beforeEach(() => {
  assign.mockReset();
  vi.stubGlobal("window", { location: { pathname: "/classes", search: "?tab=open", assign } });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("sessão expirada na tela", () => {
  it("reconhece só o FORBIDDEN com 401", async () => {
    const { isSessionExpiredError } = await freshModule();
    expect(isSessionExpiredError({ code: "FORBIDDEN", httpStatus: 401 })).toBe(true);
    expect(isSessionExpiredError({ code: "FORBIDDEN", httpStatus: 403 })).toBe(false);
    expect(isSessionExpiredError({ code: "NETWORK", httpStatus: 401 })).toBe(false);
    expect(isSessionExpiredError(undefined)).toBe(false);
  });

  it("tela logada vai para a saída com o endereço de volta, uma vez", async () => {
    const { leaveExpiredSession, setInAppSession } = await freshModule();
    setInAppSession(true);
    leaveExpiredSession();
    leaveExpiredSession();
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(`/session-expired?from=${encodeURIComponent("/classes?tab=open")}`);
  });

  it("página pública não sai", async () => {
    const { leaveExpiredSession } = await freshModule();
    leaveExpiredSession();
    expect(assign).not.toHaveBeenCalled();
  });
});
