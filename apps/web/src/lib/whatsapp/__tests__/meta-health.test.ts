import { describe, expect, it } from "vitest";
import { dailyLimitOf, parseMetaHealth } from "../meta-health";

// Situacao do numero na Meta (doc technical/07 §1.6). Resposta real de
// 17/11/2026: conta sem pagamento (141006), nome em analise e erros de
// chamadas por SIP (ignorados).
const AT = "2026-11-17T23:00:00.000Z";

const BLOCKED_BY_PAYMENT = {
  name_status: "PENDING_REVIEW",
  quality_rating: "GREEN",
  health_status: {
    can_send_message: "BLOCKED",
    entities: [
      {
        entity_type: "PHONE_NUMBER",
        can_send_message: "LIMITED",
        errors: [{ error_code: 138024, error_description: "WhatsApp Business calling cannot use SIP" }],
      },
      {
        entity_type: "WABA",
        can_send_message: "BLOCKED",
        errors: [{ error_code: 141006, error_description: "There is an error with the payment method." }],
      },
      { entity_type: "APP", can_send_message: "AVAILABLE", errors: [{ error_code: 138025 }] },
    ],
  },
};

describe("situação na Meta", () => {
  it("conta sem pagamento: bloqueado, com o motivo em português e sem os erros de chamada", () => {
    expect(parseMetaHealth(BLOCKED_BY_PAYMENT, AT)).toEqual({
      checkedAt: AT,
      sendState: "blocked",
      paymentBlocked: true,
      nameStatus: "pending_review",
      quality: "green",
      issues: [
        {
          code: 141006,
          payment: true,
          text: "A conta do WhatsApp do espaço está sem forma de pagamento válida na Meta. Cadastre um cartão.",
        },
      ],
    });
  });

  it("tudo certo: liberado, sem problemas, com o limite diário", () => {
    expect(
      parseMetaHealth(
        { name_status: "APPROVED", quality_rating: "GREEN", messaging_limit_tier: "TIER_1K", health_status: { can_send_message: "AVAILABLE", entities: [] } },
        AT,
      ),
    ).toEqual({ checkedAt: AT, sendState: "available", paymentBlocked: false, nameStatus: "approved", quality: "green", dailyLimit: 1000, issues: [] });
  });

  it("erro desconhecido entra com o código; pagamento também pelo texto da Meta", () => {
    const health = parseMetaHealth(
      {
        health_status: {
          can_send_message: "BLOCKED",
          entities: [{ errors: [{ error_code: 141999, error_description: "Something else" }, { error_code: 141500, error_description: "Payment account disabled" }] }],
        },
      },
      AT,
    );
    expect(health.issues.map((i) => [i.code, i.payment])).toEqual([
      [141999, false],
      [141500, true],
    ]);
    expect(health.issues[0].text).toBe("A Meta apontou um problema na conta do WhatsApp (código 141999).");
    expect(health.paymentBlocked).toBe(true);
  });

  it("limite diário pela faixa da Meta", () => {
    expect(dailyLimitOf("TIER_250")).toBe(250);
    expect(dailyLimitOf("TIER_10K")).toBe(10000);
    expect(dailyLimitOf("TIER_UNLIMITED")).toBeNull();
    expect(dailyLimitOf(undefined)).toBeUndefined();
    expect(dailyLimitOf("OUTRO")).toBeUndefined();
  });
});
