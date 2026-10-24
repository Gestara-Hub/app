import { describe, expect, it } from "vitest";
import { decodeSubscriptionReference, encodeSubscriptionReference } from "../subscription";

describe("referência da assinatura no Asaas", () => {
  it("volta o espaço, o plano e o período", () => {
    const raw = encodeSubscriptionReference("org-1", "scale", "yearly");
    expect(decodeSubscriptionReference(raw)).toEqual({ organizationId: "org-1", tier: "scale", interval: "yearly" });
  });

  it("recusa referência sem plano pago ou fora do formato", () => {
    expect(decodeSubscriptionReference("org-1:free:monthly")).toBeUndefined();
    expect(decodeSubscriptionReference("org-1:pro:weekly")).toBeUndefined();
    expect(decodeSubscriptionReference("org-1:pro:monthly:extra")).toBeUndefined();
    expect(decodeSubscriptionReference(undefined)).toBeUndefined();
  });
});
