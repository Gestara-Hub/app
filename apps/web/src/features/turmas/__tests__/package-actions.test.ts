import { describe, expect, it } from "vitest";
import {
  canCancelPackage,
  canRenewPackage,
  canSellPackageTo,
  cancelablePackage,
  type PackageActionFacts,
} from "../package-actions";

const pkg = (over: Partial<PackageActionFacts> & { id?: string } = {}) => ({
  id: "p",
  status: "active" as const,
  lessonsUsed: 0,
  usages: [] as unknown[],
  purchasedAt: "2026-09-01",
  createdAt: "2026-09-01T10:00:00.000Z",
  ...over,
});

describe("pacote do aluno: ações", () => {
  it("vender depende só do aluno ativo, não do pacote atual", () => {
    expect(canSellPackageTo({ status: "active" })).toBe(true);
    expect(canSellPackageTo({ status: "inactive" })).toBe(false);
  });

  it("cancelar: em uso e sem aula usada", () => {
    expect(canCancelPackage(pkg())).toBe(true);
    expect(canCancelPackage(pkg({ lessonsUsed: 1, usages: [{}] }))).toBe(false);
    expect(canCancelPackage(pkg({ status: "canceled" }))).toBe(false);
    expect(canCancelPackage(pkg({ status: "renewed" }))).toBe(false);
  });

  it("renovar: só o pacote em uso (vencido ou usado até o fim também)", () => {
    expect(canRenewPackage(pkg())).toBe(true);
    expect(canRenewPackage(pkg({ lessonsUsed: 10 }))).toBe(true);
    expect(canRenewPackage(pkg({ status: "canceled" }))).toBe(false);
    expect(canRenewPackage(pkg({ status: "renewed" }))).toBe(false);
  });

  it("o menu cancela o mais recente que ainda pode; cancelado ou renovado não conta", () => {
    const old = pkg({ id: "old", purchasedAt: "2026-08-01" });
    const recent = pkg({ id: "recent", purchasedAt: "2026-09-20" });
    const sameDayLater = pkg({ id: "later", purchasedAt: "2026-09-20", createdAt: "2026-09-20T15:00:00.000Z" });
    expect(cancelablePackage([old, recent])?.id).toBe("recent");
    expect(cancelablePackage([recent, sameDayLater])?.id).toBe("later");
    expect(cancelablePackage([pkg({ status: "canceled" }), pkg({ status: "renewed" })])).toBeUndefined();
    expect(cancelablePackage([pkg({ id: "used", lessonsUsed: 2, usages: [{}, {}] })])).toBeUndefined();
    expect(cancelablePackage([])).toBeUndefined();
  });
});
