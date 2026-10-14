import { describe, expect, it } from "vitest";
import { selectEndingPackages, type PackageLike } from "../package-ending";

const TODAY = "2026-10-14";

function pkg(id: string, over: Partial<PackageLike> = {}): PackageLike {
  return {
    id,
    studentId: `stu-${id}`,
    status: "active",
    lessonsTotal: 10,
    lessonsUsed: 3,
    purchasedAt: "2026-09-01",
    createdAt: "2026-09-01T12:00:00.000Z",
    modalityIds: [],
    ...over,
  };
}

const ids = (list: PackageLike[]) => selectEndingPackages(list, TODAY).map((p) => `${p.pkg.id}:${p.reason}`);

describe("Para fazer hoje: pacotes acabando", () => {
  it("última aula, vencendo em até 7 dias e vencido há até 7 dias", () => {
    expect(
      ids([
        pkg("last", { lessonsUsed: 9 }),
        pkg("soon", { expiresAt: "2026-10-21" }),
        pkg("expired", { expiresAt: "2026-10-07" }),
      ]),
    ).toEqual(["expired:expired", "soon:expiring", "last:last_lesson"]);
  });

  it("fora da janela não entra: vence em 8 dias, venceu há 8 dias, saldo folgado, usado até o fim", () => {
    expect(
      ids([
        pkg("far", { expiresAt: "2026-10-22" }),
        pkg("old", { expiresAt: "2026-10-06" }),
        pkg("plenty"),
        pkg("usedUp", { lessonsUsed: 10 }),
      ]),
    ).toEqual([]);
  });

  it("última aula perto de vencer conta como vencendo", () => {
    expect(selectEndingPackages([pkg("both", { lessonsUsed: 9, expiresAt: "2026-10-16" })], TODAY)).toEqual([
      expect.objectContaining({ reason: "expiring", daysToExpire: 2 }),
    ]);
  });

  it("renovado, cancelado ou com pacote mais novo nas mesmas modalidades sai", () => {
    expect(
      ids([
        pkg("renewed", { status: "renewed", lessonsUsed: 9 }),
        pkg("canceled", { status: "canceled", lessonsUsed: 9 }),
        pkg("expiredOld", { studentId: "ana", expiresAt: "2026-10-10", modalityIds: ["pilates"] }),
        pkg("bought", { studentId: "ana", purchasedAt: "2026-10-12", modalityIds: ["pilates"] }),
      ]),
    ).toEqual([]);
  });

  it("pacote novo em outra modalidade ou cancelado não esconde o aviso", () => {
    expect(
      ids([
        pkg("pilates", { studentId: "ana", lessonsUsed: 9, modalityIds: ["pilates"] }),
        pkg("music", { studentId: "ana", purchasedAt: "2026-10-01", modalityIds: ["music"] }),
        pkg("canceledNew", { studentId: "ana", purchasedAt: "2026-10-02", status: "canceled", modalityIds: ["pilates"] }),
      ]),
    ).toEqual(["pilates:last_lesson"]);
  });

  it("mesma data de compra: vale o criado depois", () => {
    expect(
      ids([
        pkg("first", { studentId: "ana", lessonsUsed: 9, createdAt: "2026-09-01T10:00:00.000Z" }),
        pkg("second", { studentId: "ana", createdAt: "2026-09-01T11:00:00.000Z" }),
      ]),
    ).toEqual([]);
  });

  it("vencidos primeiro, depois quem vence antes", () => {
    expect(
      ids([
        pkg("in5", { expiresAt: "2026-10-19" }),
        pkg("in1", { expiresAt: "2026-10-15" }),
        pkg("gone", { expiresAt: "2026-10-13" }),
      ]),
    ).toEqual(["gone:expired", "in1:expiring", "in5:expiring"]);
  });
});
