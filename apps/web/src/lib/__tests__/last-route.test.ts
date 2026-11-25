import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LAST_ROUTE_MAX_AGE_MS,
  markRestoredOwner,
  rememberablePath,
  rememberRoute,
  restorableRoute,
  takeRestoredOwner,
} from "../last-route";

/**
 * Ultima tela do app instalado (25/11/2026): guarda o endereco com a conta,
 * sem formulario aberto nem configuracao inicial, e vale por 7 dias.
 */

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("última tela do app", () => {
  it("guarda o endereço sem os parâmetros de formulário", () => {
    expect(rememberablePath("/classes/abc", "tab=chamada&edit=1")).toBe("/classes/abc?tab=chamada");
    expect(rememberablePath("/clients", "new=1")).toBe("/clients");
    expect(rememberablePath("/setup", "")).toBeNull();
    expect(rememberablePath("//evil.com", "")).toBeNull();
  });

  it("reabre a última tela da conta até 7 dias", () => {
    const now = 1_000_000_000;
    rememberRoute("u1:o1", "/finance", "tab=extrato", now);
    expect(restorableRoute(now + 1000)).toEqual({ owner: "u1:o1", path: "/finance?tab=extrato", at: now });
    expect(restorableRoute(now + LAST_ROUTE_MAX_AGE_MS + 1)).toBeNull();
  });

  it("a conta da tela reaberta é lida uma vez", () => {
    markRestoredOwner("u1:o1");
    expect(takeRestoredOwner()).toBe("u1:o1");
    expect(takeRestoredOwner()).toBeNull();
  });
});
