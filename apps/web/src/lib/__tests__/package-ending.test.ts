import { describe, expect, it } from "vitest";
import { selectEndingPackages, type PackageLike } from "@/lib/package-ending";

const TODAY = "2026-10-14";

function pkg(id: string, over: Partial<PackageLike> = {}): PackageLike {
  return {
    id,
    studentId: `stu-${id}`,
    packageId: "lp-10",
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

  it("fora da janela não entra: vence em 8 dias, venceu há 8 dias, saldo folgado", () => {
    expect(
      ids([
        pkg("far", { expiresAt: "2026-10-22" }),
        pkg("old", { expiresAt: "2026-10-06" }),
        pkg("plenty"),
      ]),
    ).toEqual([]);
  });

  it("usado até o fim e ainda válido entra como \"Aulas acabaram\"", () => {
    expect(
      ids([
        pkg("noExpiry", { lessonsUsed: 10 }),
        pkg("validLong", { lessonsUsed: 10, expiresAt: "2026-12-01" }),
        // Sem aulas e vencendo em breve: o que importa e que as aulas acabaram.
        pkg("validSoon", { lessonsUsed: 10, expiresAt: "2026-10-16" }),
      ]),
    ).toEqual(["validSoon:used_up", "validLong:used_up", "noExpiry:used_up"]);
  });

  it("usado até o fim e vencido segue a regra do vencido (até 7 dias)", () => {
    expect(
      ids([
        pkg("recent", { lessonsUsed: 10, expiresAt: "2026-10-10" }),
        pkg("long", { lessonsUsed: 10, expiresAt: "2026-10-01" }),
      ]),
    ).toEqual(["recent:expired"]);
  });

  it("usado até o fim sai quando compra de novo o mesmo pacote", () => {
    expect(
      ids([
        pkg("usedUp", { studentId: "ana", lessonsUsed: 10, modalityIds: ["pilates"] }),
        pkg("bought", { studentId: "ana", purchasedAt: "2026-10-12", modalityIds: ["pilates"] }),
      ]),
    ).toEqual([]);
  });

  it("ordem: vencidos, sem aulas, vencendo, última aula", () => {
    expect(
      ids([
        pkg("last", { lessonsUsed: 9 }),
        pkg("soon", { expiresAt: "2026-10-20" }),
        pkg("usedUp", { lessonsUsed: 10 }),
        pkg("gone", { expiresAt: "2026-10-13" }),
      ]),
    ).toEqual(["gone:expired", "usedUp:used_up", "soon:expiring", "last:last_lesson"]);
  });

  it("última aula perto de vencer conta como vencendo", () => {
    expect(selectEndingPackages([pkg("both", { lessonsUsed: 9, expiresAt: "2026-10-16" })], TODAY)).toEqual([
      expect.objectContaining({ reason: "expiring", daysToExpire: 2 }),
    ]);
  });

  it("renovado, cancelado ou com compra mais nova do mesmo pacote sai", () => {
    expect(
      ids([
        pkg("renewed", { status: "renewed", lessonsUsed: 9 }),
        pkg("canceled", { status: "canceled", lessonsUsed: 9 }),
        pkg("expiredOld", { studentId: "ana", expiresAt: "2026-10-10", modalityIds: ["pilates"] }),
        pkg("bought", { studentId: "ana", purchasedAt: "2026-10-12", modalityIds: ["pilates"] }),
      ]),
    ).toEqual([]);
  });

  it("pacote diferente (mesmo na mesma modalidade) não renova: o aviso continua", () => {
    expect(
      ids([
        pkg("group", { studentId: "ana", lessonsUsed: 9, modalityIds: ["pilates"] }),
        pkg("private", { studentId: "ana", packageId: "lp-private", purchasedAt: "2026-10-01", modalityIds: ["pilates"] }),
      ]),
    ).toEqual(["group:last_lesson"]);
  });

  it("pacote novo em outra modalidade ou cancelado não esconde o aviso", () => {
    expect(
      ids([
        pkg("pilates", { studentId: "ana", lessonsUsed: 9, modalityIds: ["pilates"] }),
        pkg("music", { studentId: "ana", packageId: "lp-music", purchasedAt: "2026-10-01", modalityIds: ["music"] }),
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
