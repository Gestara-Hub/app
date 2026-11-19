import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Subscription } from "@gestarahub/contracts";
import {
  addPlanCycle,
  graceEndsOn,
  subscriptionClosesOn,
  planDailyStep,
  planNoticeFor,
  quotePlanChange,
  type PlanPrices,
} from "../src/subscription-plan.ts";

// Precos de hoje (config/subscription.ts), em centavos.
const PRICES: PlanPrices = {
  pro: { monthly: 7990, yearly: 79900 },
  scale: { monthly: 19900, yearly: 199000 },
};

// Novembro tem 30 dias: renovacao em 01/12, hoje 11/11 = 20 dias sobrando.
const proMonthly = { tier: "pro", interval: "monthly", renewsOn: "2026-12-01" } as const;
const TODAY = "2026-11-11";

describe("troca de plano (doc 13 §6)", () => {
  it("upgrade no mesmo período: diferença proporcional hoje, renovação igual", () => {
    const quote = quotePlanChange(proMonthly, { tier: "scale", interval: "monthly" }, TODAY, PRICES);
    assert.deepEqual(quote, {
      kind: "now",
      chargeTodayCents: 7940,
      remainingDays: 20,
      periodDays: 30,
      renewsOn: "2026-12-01",
      renewalCents: 19900,
      renewalInterval: "monthly",
      restartsCycle: false,
    });
  });

  it("mensal → anual: os dias do mês abatem o anual e o ciclo começa hoje", () => {
    const quote = quotePlanChange(proMonthly, { tier: "pro", interval: "yearly" }, TODAY, PRICES);
    assert.equal(quote.kind, "now");
    if (quote.kind !== "now") return;
    assert.equal(quote.chargeTodayCents, 74573);
    assert.equal(quote.renewsOn, "2027-11-11");
    assert.equal(quote.restartsCycle, true);
  });

  it("Pro mensal → Scale anual segue o upgrade com o ciclo anual de hoje", () => {
    const quote = quotePlanChange(proMonthly, { tier: "scale", interval: "yearly" }, TODAY, PRICES);
    assert.equal(quote.kind, "now");
    if (quote.kind !== "now") return;
    assert.equal(quote.chargeTodayCents, 199000 - 5327);
    assert.equal(quote.renewalCents, 199000);
  });

  it("Pro anual → Scale mensal: Scale na hora (no anual), mensal na renovação", () => {
    const quote = quotePlanChange(
      { tier: "pro", interval: "yearly", renewsOn: "2027-06-01" },
      { tier: "scale", interval: "monthly" },
      "2026-12-01",
      PRICES,
    );
    assert.equal(quote.kind, "now");
    if (quote.kind !== "now") return;
    // 182 de 365 dias sobrando.
    assert.equal(quote.chargeTodayCents, Math.round((199000 - 79900) * (182 / 365)));
    assert.equal(quote.renewsOn, "2027-06-01");
    assert.equal(quote.thenInterval, "monthly");
    assert.equal(quote.renewalCents, 19900);
  });

  it("downgrade, anual → mensal e Grátis ficam para o fim do período pago", () => {
    const scaleMonthly = { ...proMonthly, tier: "scale" } as const;
    assert.deepEqual(quotePlanChange(scaleMonthly, { tier: "pro", interval: "monthly" }, TODAY, PRICES), {
      kind: "scheduled",
      effectiveOn: "2026-12-01",
      renewalCents: 7990,
    });
    assert.deepEqual(
      quotePlanChange({ tier: "pro", interval: "yearly", renewsOn: "2027-03-01" }, { tier: "pro", interval: "monthly" }, TODAY, PRICES),
      { kind: "scheduled", effectiveOn: "2027-03-01", renewalCents: 7990 },
    );
    assert.deepEqual(quotePlanChange(proMonthly, { tier: "free", interval: "monthly" }, TODAY, PRICES), {
      kind: "scheduled",
      effectiveOn: "2026-12-01",
      renewalCents: 0,
    });
  });

  it("do Grátis é checkout; o mesmo plano não muda nada", () => {
    assert.deepEqual(quotePlanChange({ tier: "free", interval: "monthly" }, { tier: "pro", interval: "yearly" }, TODAY, PRICES), {
      kind: "checkout",
    });
    assert.deepEqual(quotePlanChange(proMonthly, { tier: "pro", interval: "monthly" }, TODAY, PRICES), { kind: "same" });
  });

  it("período mensal e anual: datas do calendário", () => {
    assert.equal(addPlanCycle("2026-01-31", "monthly"), "2026-02-28");
    assert.equal(addPlanCycle("2026-11-11", "yearly"), "2027-11-11");
    assert.equal(graceEndsOn("2026-11-13"), "2026-11-18");
  });
});

describe("renovação e tolerância de 5 dias", () => {
  const pix: Subscription = { tier: "pro", interval: "monthly", status: "active", paymentMethod: "pix", renewsOn: "2026-11-13" };
  const card: Subscription = { ...pix, paymentMethod: "credit_card" };

  it("avisos na ordem da doc (Pix)", () => {
    assert.equal(planNoticeFor(pix, "2026-11-09"), null);
    assert.deepEqual(planNoticeFor(pix, "2026-11-10"), { kind: "renews_soon", renewsOn: "2026-11-13" });
    assert.deepEqual(planNoticeFor(pix, "2026-11-13"), { kind: "payment_pending", renewsOn: "2026-11-13" });
    assert.deepEqual(planNoticeFor(pix, "2026-11-16"), { kind: "grace_ending", renewsOn: "2026-11-13", daysLeft: 2 });
    assert.deepEqual(planNoticeFor(pix, "2026-11-18"), {
      kind: "reverted",
      renewsOn: "2026-11-13",
      daysLeft: 15,
      closesOn: "2026-12-03",
    });
  });

  it("Pix Automático ativo: como o cartão, sem \"pague até o dia\"; aviso só se o débito não passar", () => {
    const auto: Subscription = { ...pix, pixAutomatic: { authorizationId: "a1", status: "ACTIVE", updatedAt: "2026-11-01T00:00:00Z" } };
    assert.equal(planNoticeFor(auto, "2026-11-10"), null);
    assert.equal(planNoticeFor(auto, "2026-11-13"), null);
    assert.deepEqual(planNoticeFor(auto, "2026-11-14"), { kind: "payment_pending", renewsOn: "2026-11-13" });
    // Autorização ainda pendente: segue o Pix comum.
    const offered: Subscription = { ...pix, pixAutomatic: { authorizationId: "a1", status: "CREATED", updatedAt: "2026-11-01T00:00:00Z" } };
    assert.deepEqual(planNoticeFor(offered, "2026-11-10"), { kind: "renews_soon", renewsOn: "2026-11-13" });
  });

  it("cartão: sem aviso antes nem no dia (é cobrado sozinho)", () => {
    assert.equal(planNoticeFor(card, "2026-11-10"), null);
    assert.equal(planNoticeFor(card, "2026-11-13"), null);
    assert.deepEqual(planNoticeFor(card, "2026-11-14"), { kind: "payment_pending", renewsOn: "2026-11-13" });
  });

  it("Grátis marcado não cobra a renovação", () => {
    const leaving: Subscription = { ...pix, scheduledChange: { tier: "free", effectiveOn: "2026-11-13" } };
    assert.equal(planNoticeFor(leaving, "2026-11-12"), null);
  });

  it("rotina diária: aplica a troca no dia, volta ao Grátis no 5º dia e não repete e-mail", () => {
    const scheduled: Subscription = { ...pix, scheduledChange: { tier: "pro", interval: "monthly", effectiveOn: "2026-11-13" } };
    assert.equal(planDailyStep(scheduled, "2026-11-13").applyScheduled, true);
    assert.equal(planDailyStep(pix, "2026-11-18").revertToFree, true);
    assert.equal(planDailyStep(pix, "2026-11-13").email?.kind, "payment_pending");
    const sent: Subscription = { ...pix, noticesSent: ["2026-11-13:payment_pending"] };
    assert.equal(planDailyStep(sent, "2026-11-13").email, null);
  });
});

describe("depois de voltar ao Grátis: 15 dias para pagar, depois encerra", () => {
  // Renovacao 13/11 nao paga: Gratis em 18/11, assinatura encerrada em 03/12.
  const reverted: Subscription = { tier: "free", revertedFrom: { tier: "pro", interval: "monthly", on: "2026-11-13" } };

  it("o encerramento é 15 dias depois de voltar ao Grátis", () => {
    assert.equal(subscriptionClosesOn("2026-11-13"), "2026-12-03");
  });

  it("aviso no dia, lembrete no 7º dia e faltam 2 dias no fim", () => {
    assert.equal(planNoticeFor(reverted, "2026-11-18")?.kind, "reverted");
    assert.equal(planNoticeFor(reverted, "2026-11-24")?.kind, "reverted");
    assert.deepEqual(planNoticeFor(reverted, "2026-11-25"), {
      kind: "revert_reminder",
      renewsOn: "2026-11-13",
      daysLeft: 8,
      closesOn: "2026-12-03",
    });
    assert.deepEqual(planNoticeFor(reverted, "2026-12-01"), {
      kind: "closing_soon",
      renewsOn: "2026-11-13",
      daysLeft: 2,
      closesOn: "2026-12-03",
    });
  });

  it("a rotina encerra no 15º dia e manda o último e-mail uma vez", () => {
    assert.deepEqual(planDailyStep(reverted, "2026-12-02"), {
      applyScheduled: false,
      revertToFree: false,
      closeSubscription: false,
      email: { kind: "closing_soon", renewsOn: "2026-11-13", daysLeft: 1, closesOn: "2026-12-03" },
    });
    const closing = planDailyStep(reverted, "2026-12-03");
    assert.equal(closing.closeSubscription, true);
    assert.deepEqual(closing.email, { kind: "closed", renewsOn: "2026-11-13" });
    const sent: Subscription = { ...reverted, noticesSent: ["2026-11-13:closed"] };
    assert.equal(planDailyStep(sent, "2026-12-03").email, null);
  });

  it("encerrada: aviso por 7 dias, depois nada", () => {
    const closed: Subscription = { tier: "free", closedFrom: { tier: "pro", renewsOn: "2026-11-13", on: "2026-12-03" } };
    assert.deepEqual(planNoticeFor(closed, "2026-12-09"), { kind: "closed", renewsOn: "2026-11-13" });
    assert.equal(planNoticeFor(closed, "2026-12-10"), null);
    assert.deepEqual(planDailyStep(closed, "2026-12-04"), {
      applyScheduled: false,
      revertToFree: false,
      closeSubscription: false,
      email: null,
    });
  });
});
