import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeCharge } from "../src/billing.ts";
import {
  carryOverSources,
  coversModality,
  isUsableOn,
  modalitiesOverlap,
  packageExpiresAt,
  packageState,
  pickPackageFor,
  usageReasonFor,
} from "../src/packages.ts";

const today = "2026-09-22";

function pkg(
  over: Partial<Parameters<typeof packageState>[0] & { id: string; packageId: string; modalityIds: string[]; purchasedAt: string }> = {},
) {
  return {
    id: "p",
    packageId: "lp-10",
    lessonsTotal: 10,
    lessonsUsed: 0,
    status: "active" as const,
    modalityIds: [] as string[],
    purchasedAt: "2026-09-01",
    ...over,
  };
}

describe("pacote: validade", () => {
  it("vale até a compra + os dias; sem validade não vence", () => {
    assert.equal(packageExpiresAt("2026-10-01", 30), "2026-10-31");
    assert.equal(packageExpiresAt("2026-01-31", 30), "2026-03-02");
    assert.equal(packageExpiresAt("2026-10-01"), undefined);
  });

  it("vence no dia seguinte ao último dia válido", () => {
    assert.equal(packageState(pkg({ expiresAt: today }), today).isExpired, false);
    assert.equal(packageState(pkg({ expiresAt: "2026-09-21" }), today).isExpired, true);
  });
});

describe("pacote: o que a chamada gasta (regra 4)", () => {
  it("presença gasta; falta sem justificativa gasta se o pacote mandar; justificada nunca", () => {
    assert.equal(usageReasonFor("present", true), "present");
    assert.equal(usageReasonFor("present", false), "present");
    assert.equal(usageReasonFor("absent", true), "absent");
    assert.equal(usageReasonFor("absent", false), null);
    assert.equal(usageReasonFor("justified", true), null);
  });
});

describe("pacote: modalidades", () => {
  it("lista vazia vale para todas", () => {
    assert.equal(coversModality([], "pilates"), true);
    assert.equal(coversModality([], undefined), true);
    assert.equal(coversModality(["pilates"], "pilates"), true);
    assert.equal(coversModality(["pilates"], "yoga"), false);
    assert.equal(coversModality(["pilates"], undefined), false);
  });

  it("sobreposição: alguma em comum, ou um dos dois vale para todas", () => {
    assert.equal(modalitiesOverlap(["a", "b"], ["b"]), true);
    assert.equal(modalitiesOverlap(["a"], ["b"]), false);
    assert.equal(modalitiesOverlap([], ["b"]), true);
    assert.equal(modalitiesOverlap(["a"], []), true);
  });
});

describe("pacote: saldo e avisos (regra 5)", () => {
  it("saldo, última aula e usado até o fim", () => {
    assert.deepEqual(packageState(pkg({ lessonsUsed: 3 }), today), {
      remaining: 7,
      isExpired: false,
      isUsedUp: false,
      isLastLesson: false,
      expiresSoon: false,
      daysToExpire: undefined,
    });
    const last = packageState(pkg({ lessonsUsed: 9 }), today);
    assert.equal(last.isLastLesson, true);
    assert.equal(last.remaining, 1);
    const done = packageState(pkg({ lessonsUsed: 10 }), today);
    assert.equal(done.isUsedUp, true);
    assert.equal(done.remaining, 0);
    assert.equal(done.isLastLesson, false);
  });

  it("vencido perde o saldo; renovado e cancelado não têm saldo", () => {
    assert.equal(packageState(pkg({ expiresAt: "2026-09-01" }), today).remaining, 0);
    assert.equal(packageState(pkg({ status: "renewed" }), today).remaining, 0);
    assert.equal(packageState(pkg({ status: "canceled" }), today).remaining, 0);
  });

  it("vence em até 7 dias: aviso só com saldo e ainda válido", () => {
    const soon = packageState(pkg({ expiresAt: "2026-09-29" }), today);
    assert.equal(soon.expiresSoon, true);
    assert.equal(soon.daysToExpire, 7);
    assert.equal(packageState(pkg({ expiresAt: "2026-09-30" }), today).expiresSoon, false);
    assert.equal(packageState(pkg({ expiresAt: today }), today).daysToExpire, 0);
    assert.equal(packageState(pkg({ expiresAt: "2026-09-25", lessonsUsed: 10 }), today).expiresSoon, false);
  });
});

describe("pacote: qual pacote paga a aula", () => {
  it("só ativo, com saldo e válido na data da aula", () => {
    assert.equal(isUsableOn(pkg(), today), true);
    assert.equal(isUsableOn(pkg({ lessonsUsed: 10 }), today), false);
    assert.equal(isUsableOn(pkg({ status: "renewed" }), today), false);
    assert.equal(isUsableOn(pkg({ expiresAt: "2026-09-21" }), today), false);
    // Chamada atrasada de uma aula de quando o pacote ainda valia.
    assert.equal(isUsableOn(pkg({ expiresAt: "2026-09-21" }), "2026-09-20"), true);
  });

  it("o que vence primeiro, sem validade por último, cobrindo a modalidade", () => {
    const noExpiry = pkg({ id: "sem", purchasedAt: "2026-08-01" });
    const later = pkg({ id: "tarde", expiresAt: "2026-12-01" });
    const sooner = pkg({ id: "cedo", expiresAt: "2026-10-01" });
    const other = pkg({ id: "outra", expiresAt: "2026-09-25", modalityIds: ["yoga"] });
    assert.equal(pickPackageFor([noExpiry, later, sooner, other], { modalityId: "pilates", date: today })?.id, "cedo");
    assert.equal(pickPackageFor([noExpiry, other], { modalityId: "yoga", date: today })?.id, "outra");
    assert.equal(pickPackageFor([other], { modalityId: "pilates", date: today }), undefined);
  });
});

describe("pacote: renovação (regra 6, só o mesmo pacote do catálogo)", () => {
  it("leva o saldo das compras válidas do mesmo pacote", () => {
    const first = pkg({ id: "primeira", modalityIds: ["pilates"], lessonsUsed: 7 });
    const expired = pkg({ id: "vencido", modalityIds: ["pilates"], expiresAt: "2026-09-01" });
    const usedUp = pkg({ id: "usado", modalityIds: ["pilates"], lessonsUsed: 10 });
    const result = carryOverSources([first, expired, usedUp], "lp-10", today);
    assert.deepEqual(result.sources.map((p) => p.id), ["primeira"]);
    assert.equal(result.lessons, 3);
  });

  it("pacote diferente, mesmo na mesma modalidade ou para todas, fica separado", () => {
    const group = pkg({ id: "grupo", packageId: "lp-grupo", modalityIds: ["pilates"], lessonsUsed: 2 });
    const all = pkg({ id: "todas", packageId: "lp-todas", modalityIds: [], lessonsUsed: 1 });
    assert.deepEqual(carryOverSources([group, all], "lp-particular", today), { sources: [], lessons: 0 });
    assert.equal(carryOverSources([group, all], "lp-grupo", today).lessons, 8);
  });
});

describe("pacote: rótulo da cobrança", () => {
  it("à vista e parcelado", () => {
    assert.equal(describeCharge({ kind: "package", description: "10 aulas" }, "Ana"), 'compra do pacote "10 aulas" de Ana');
    assert.equal(
      describeCharge({ kind: "package", description: "10 aulas", cycleIndex: 2, cycleTotal: 3 }, "Ana"),
      'parcela 2 de 3 do pacote "10 aulas" de Ana',
    );
    assert.equal(
      describeCharge({ kind: "extra", description: "Kimono", cycleIndex: 1, cycleTotal: 2 }, "Ana"),
      'parcela 1 de 2 da cobrança avulsa "Kimono" de Ana',
    );
  });
});
