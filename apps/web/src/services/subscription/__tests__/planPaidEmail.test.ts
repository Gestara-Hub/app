import { describe, expect, it } from "vitest";
import type { Subscription } from "@gestarahub/contracts";
import { planPaidNotice } from "@/services/server/planEmails";

/** E-mail de pagamento do plano confirmado (19/11/2026): o nosso, no lugar do e-mail do Asaas. */

const pro: Subscription = {
  tier: "pro",
  interval: "monthly",
  status: "active",
  priceCents: 7990,
  renewsOn: "2026-12-19",
  changedAt: "2026-11-19T12:00:00.000Z",
};

describe("e-mail de pagamento do plano", () => {
  it("plano ligado: valor, até quando e botão para o app", () => {
    const notice = planPaidNotice("activated", pro, "https://gestarahub.com.br");
    expect(notice.title).toBe("Plano Profissional ativo");
    expect(notice.text).toContain("79,90");
    expect(notice.text).toContain("Pago até 19/12.");
    expect(notice.actionUrl).toBe("https://gestarahub.com.br/settings?tab=plano");
  });

  it("renovação e plano religado têm títulos próprios", () => {
    expect(planPaidNotice("renewed", pro, "https://x.test").title).toBe("Pagamento do plano confirmado");
    expect(planPaidNotice("reactivated", pro, "https://x.test").title).toBe("Plano Profissional religado");
  });
});
