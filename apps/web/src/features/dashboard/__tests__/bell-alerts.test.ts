import { describe, expect, it } from "vitest";
import type { Subscription, WhatsAppConnectionView } from "@gestarahub/contracts";
import { planBellAlert, quotaBellAlert } from "../bell-alerts";

// Sino: avisos do plano (os leves; os de plano caindo ficam fixos no topo) e
// da franquia de mensagens automaticas. Hoje e terca 22/09/2026.

const TODAY = "2026-09-22";
const PRO: Subscription = { tier: "pro", interval: "monthly", status: "active", paymentMethod: "pix", renewsOn: "2026-10-12" };

describe("aviso do plano no sino", () => {
  it("renova em 2 dias (Pix): avisa e leva ao plano", () => {
    expect(planBellAlert({ ...PRO, renewsOn: "2026-09-24" }, TODAY)).toMatchObject({
      kind: "plan",
      title: "Seu plano renova em 24/09",
      href: "/settings?tab=plano",
      action: "Ver o plano",
    });
  });

  it("pagamento pendente no dia da renovação", () => {
    expect(planBellAlert({ ...PRO, renewsOn: TODAY }, TODAY)).toMatchObject({ title: "Pagamento do plano pendente", tone: "warning" });
  });

  it("plano caindo ou já de volta ao Grátis fica no aviso fixo, não no sino", () => {
    expect(planBellAlert({ ...PRO, renewsOn: "2026-09-19" }, TODAY)).toBeNull();
    expect(planBellAlert({ tier: "free", revertedFrom: { tier: "pro", on: "2026-09-10" } }, TODAY)).toBeNull();
  });

  it("assinatura encerrada leva aos planos", () => {
    const closed: Subscription = { tier: "free", closedFrom: { tier: "pro", renewsOn: "2026-08-20", on: "2026-09-20" } };
    expect(planBellAlert(closed, TODAY)).toMatchObject({ title: "A assinatura do plano foi encerrada", href: "/plans" });
  });

  it("sem renovação perto ou com o Grátis marcado (cortesia), nada", () => {
    expect(planBellAlert(PRO, TODAY)).toBeNull();
    expect(
      planBellAlert({ ...PRO, renewsOn: "2026-09-24", scheduledChange: { tier: "free", effectiveOn: "2026-09-24" } }, TODAY),
    ).toBeNull();
    expect(planBellAlert(undefined, TODAY)).toBeNull();
  });
});

const CONNECTED: WhatsAppConnectionView = {
  organizationId: "org",
  officialStatus: "connected",
  allowedSendHours: { start: "08:00", end: "20:00" },
  monthlyQuota: { used: 100, included: 300, cycleStart: "2026-09-12" },
  mode: "official",
  canUseOfficial: true,
  isQuotaExhausted: false,
  officialAvailable: true,
};
const withUsed = (used: number, exhausted = false): WhatsAppConnectionView => ({
  ...CONNECTED,
  monthlyQuota: { ...CONNECTED.monthlyQuota, used },
  isQuotaExhausted: exhausted,
});

describe("aviso da franquia de mensagens no sino", () => {
  it("com folga, nada", () => {
    expect(quotaBellAlert(CONNECTED)).toBeNull();
  });

  it("restando 20% ou menos, avisa quanto falta e leva à Conexão", () => {
    expect(quotaBellAlert(withUsed(250))).toMatchObject({
      kind: "messages",
      title: "Restam 50 mensagens automáticas no ciclo",
      text: "250 de 300 usadas.",
      href: "/communication?tab=connection",
    });
    expect(quotaBellAlert(withUsed(299))?.title).toBe("Resta 1 mensagem automática no ciclo");
  });

  it("acabou: as mensagens saem com 1 toque até renovar", () => {
    expect(quotaBellAlert(withUsed(300, true))).toMatchObject({ title: "As mensagens automáticas do ciclo acabaram", tone: "warning" });
  });

  it("sem envio automático saindo de verdade, nada", () => {
    expect(quotaBellAlert({ ...withUsed(300, true), officialAvailable: false })).toBeNull();
    expect(quotaBellAlert({ ...withUsed(300, true), officialStatus: "not_connected" })).toBeNull();
    expect(quotaBellAlert({ ...withUsed(0), canUseOfficial: false, monthlyQuota: { used: 0, included: 0 } })).toBeNull();
    expect(quotaBellAlert(undefined)).toBeNull();
  });
});

// Niveis e urgencia (doc product/25, "Níveis, urgência e novos lembretes", 09/11/2026).
import type { ExpiringPersonDocument, OnlinePayment } from "@gestarahub/contracts";
import { disputeBellAlerts, documentBellAlerts, gatewayRejectedBellAlert } from "../bell-alerts";
import { keysToRing, newAttentionKeys, seenKeysAfterOpening } from "../bell-pulse";

const PAID: OnlinePayment = {
  id: "op-1",
  chargeId: "ch-1",
  method: "pix",
  amountCents: 15000,
  status: "paid",
  expiresAt: "2026-09-30T00:00:00.000Z",
  createdAt: "2026-09-20T12:00:00.000Z",
} as OnlinePayment;

describe("urgência: estorno, contestação e parceiro", () => {
  it("estorno ou contestação: urgente, fixo no topo e com modal, com o aluno e o valor", () => {
    const alerts = disputeBellAlerts(
      [
        { ...PAID, disputeStatus: "refunded", disputedAt: "2026-09-21T10:00:00.000Z" },
        { ...PAID, id: "op-2", chargeId: "ch-2", disputeStatus: "chargeback_requested", disputedAt: "2026-09-22T10:00:00.000Z" },
        { ...PAID, id: "op-3" },
      ],
      (chargeId) => (chargeId === "ch-1" ? "Ana" : undefined),
    );
    expect(alerts.map((a) => a.title)).toEqual(["Contestação de pagamento", "Pagamento estornado · Ana"]);
    expect(alerts[1]).toMatchObject({ tone: "danger", pinned: true, modal: true, href: "/online-payments" });
    expect(alerts[1].text).toContain("R$ 150,00".replace(" ", " "));
  });

  it("pagamento online recusado pelo parceiro: urgente; aprovado ou desligado, nada", () => {
    expect(gatewayRejectedBellAlert({ enabled: true, gatewayStatus: "rejected" } as never)).toMatchObject({ tone: "danger", pinned: true, modal: true });
    expect(gatewayRejectedBellAlert({ enabled: true, gatewayStatus: "approved" } as never)).toBeNull();
    expect(gatewayRejectedBellAlert({ enabled: false, gatewayStatus: "rejected" } as never)).toBeNull();
  });

  it("documento de saúde vencido de aluno: urgente e fixo; os demais, atenção", () => {
    const doc = (over: Partial<ExpiringPersonDocument>): ExpiringPersonDocument => ({
      id: "d1",
      ownerKind: "client",
      kind: "medical_certificate",
      ownerId: "c1",
      ownerName: "Ana",
      label: "Atestado médico",
      expiresOn: "2026-09-10",
      expiry: "expired",
      daysToExpire: -12,
      ...over,
    });
    expect(documentBellAlerts([doc({})])[0]).toMatchObject({ tone: "danger", pinned: true });
    expect(documentBellAlerts([doc({ kind: "liability_waiver", label: "Termo" })])[0]).toMatchObject({ tone: "warning" });
    expect(documentBellAlerts([doc({ expiry: "expiring", daysToExpire: 5 })])[0].pinned).toBeUndefined();
  });
});

describe("pulsar do sino", () => {
  it("pulsa só com chave nova desde a última abertura; abrir guarda as atuais", () => {
    expect(newAttentionKeys(["a", "b"], undefined)).toEqual(["a", "b"]);
    expect(newAttentionKeys(["a", "b"], ["a"])).toEqual(["b"]);
    expect(newAttentionKeys(["a"], ["a", "b"])).toEqual([]);
    expect(seenKeysAfterOpening(["a", "a", "b"])).toEqual(["a", "b"]);
    expect(seenKeysAfterOpening(Array.from({ length: 400 }, (_, i) => `k${i}`))).toHaveLength(300);
  });

  it("som: toca só o item que ainda não tocou neste aparelho (12/11/2026)", () => {
    expect(keysToRing(["a", "b"], [])).toEqual(["a", "b"]);
    expect(keysToRing(["a", "b"], ["a"])).toEqual(["b"]);
    expect(keysToRing(["a"], ["a", "b"])).toEqual([]);
  });
});
