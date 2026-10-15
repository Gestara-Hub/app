import { afterEach, describe, expect, it, vi } from "vitest";
import {
  discoveryDismissedKey,
  discoveryVisitedKey,
  markDiscoveryVisit,
  readStorageFlag,
  setStorageFlag,
} from "../discovery-flags";

const scope = { organizationId: "org-1", id: "usr-1" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("discovery-flags", () => {
  it("chaves por organização e usuário", () => {
    expect(discoveryDismissedKey(scope)).toBe("gestarahub_discovery_dismissed:org-1:usr-1");
    expect(discoveryVisitedKey(scope, "finance")).toBe("gestarahub_discovery_visited:org-1:usr-1:finance");
  });

  it("grava e lê a marca no localStorage", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
      },
    });
    expect(readStorageFlag(discoveryVisitedKey(scope, "course_billing"))).toBe(false);
    markDiscoveryVisit(scope, "course_billing");
    expect(readStorageFlag(discoveryVisitedKey(scope, "course_billing"))).toBe(true);
    // Outro usuario da mesma organizacao nao herda a marca.
    expect(readStorageFlag(discoveryVisitedKey({ ...scope, id: "usr-2" }, "course_billing"))).toBe(false);
  });

  it("sem storage (bloqueado ou no server) não quebra e lê falso", () => {
    expect(readStorageFlag("x")).toBe(false);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(() => setStorageFlag("x")).not.toThrow();
    expect(readStorageFlag("x")).toBe(false);
  });
});
