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
