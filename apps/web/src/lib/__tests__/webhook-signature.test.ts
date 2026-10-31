import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { safeEqual, validMetaSignature } from "../security/webhook-signature";

describe("assinatura do webhook da Meta", () => {
  const secret = "segredo-de-teste";
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const signed = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  it("aceita o corpo assinado com o segredo do app", () => {
    expect(validMetaSignature(body, signed, secret)).toBe(true);
  });

  it("recusa sem assinatura, com outro segredo ou com o corpo trocado", () => {
    expect(validMetaSignature(body, null, secret)).toBe(false);
    expect(validMetaSignature(body, signed, "outro")).toBe(false);
    expect(validMetaSignature(body.replace("[]", "[{}]"), signed, secret)).toBe(false);
    expect(validMetaSignature(body, "sha1=abc", secret)).toBe(false);
  });

  it("comparação de segredos: igual só com o mesmo texto", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual(undefined, "abc")).toBe(false);
  });
});
