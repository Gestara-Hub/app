import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cancelar a cobranca online tambem no Asaas (21/10/2026): sem isso o aluno
 * ainda pagava o link ou o QR antigo. Ja paga no Asaas, o pagamento vale.
 */
const asaas = vi.hoisted(() => ({
  deletePayment: vi.fn(),
  getPayment: vi.fn(),
}));

vi.mock("@/lib/asaas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/asaas")>()),
  deletePayment: asaas.deletePayment,
  getPayment: asaas.getPayment,
  createWebhook: vi.fn(),
  getAccountFees: vi.fn(),
  getAccountInfo: vi.fn(),
  listWebhooks: vi.fn(),
  updateWebhook: vi.fn(),
}));
/**
 * Banco falso so com o que a expiracao usa: online_payments em aberto e a chave
 * da subconta. Encadeia select/eq/lte/limit/maybeSingle e update/in/eq.
 */
const db = vi.hoisted(() => ({
  rows: [] as Array<{ id: string; gateway_provider: string; gateway_payment_id: string }>,
  updates: [] as Array<{ values: Record<string, unknown>; ids: string[] }>,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table === "organizations") {
        const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { gateway_api_key: "$aact_sub" } }) };
        return q;
      }
      const select = {
        eq: () => select,
        lte: () => select,
        limit: async () => ({ data: db.rows }),
        maybeSingle: async () => ({ data: { organization_id: "org_1" } }),
      };
      return {
        select: () => select,
        update: (values: Record<string, unknown>) => {
          const entry = { values, ids: [] as string[] };
          db.updates.push(entry);
          const chain = {
            in: (_col: string, ids: string[]) => {
              entry.ids = ids;
              return chain;
            },
            eq: () => chain,
            then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
          };
          return chain;
        },
      };
    },
  }),
}));

const { AsaasApiError } = await import("@/lib/asaas");
const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
const { cancelGatewayPayment, expireDueOnlinePayments, verifyGatewayPaymentForWebhook } = await import(
  "@/services/onlinePayments/gateway"
);

describe("cancelar a cobrança online no Asaas", () => {
  beforeEach(() => {
    asaas.deletePayment.mockReset();
    asaas.getPayment.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("cancela quando o Asaas aceita a exclusão", async () => {
    asaas.deletePayment.mockResolvedValue({ deleted: true, id: "pay_1" });
    await expect(cancelGatewayPayment("pay_1", "key")).resolves.toBe("canceled");
    expect(asaas.deletePayment).toHaveBeenCalledWith("pay_1", "key");
  });

  it("já paga no Asaas: não cancela, o pagamento vale", async () => {
    asaas.deletePayment.mockRejectedValue(Object.assign(new Error("não pode"), { status: 400 }));
    for (const status of ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]) {
      asaas.getPayment.mockResolvedValueOnce({ status });
      await expect(cancelGatewayPayment("pay_1", "key")).resolves.toBe("paid");
    }
  });

  it("já removida, estornada ou inexistente conta como cancelada", async () => {
    asaas.deletePayment.mockRejectedValue(new Error("falhou"));
    asaas.getPayment.mockResolvedValueOnce({ status: "REFUNDED" });
    await expect(cancelGatewayPayment("pay_1", "key")).resolves.toBe("canceled");
    asaas.getPayment.mockResolvedValueOnce({ status: "PENDING", deleted: true });
    await expect(cancelGatewayPayment("pay_1", "key")).resolves.toBe("canceled");
    asaas.getPayment.mockRejectedValueOnce(Object.assign(new Error("não existe"), { status: 404 }));
    await expect(cancelGatewayPayment("pay_1", "key")).resolves.toBe("canceled");
  });

  it("Asaas fora do ar ou cobrança ainda aberta: falha, para tentar de novo", async () => {
    asaas.deletePayment.mockRejectedValue(new Error("timeout"));
    asaas.getPayment.mockResolvedValueOnce({ status: "PENDING" });
    await expect(cancelGatewayPayment("pay_1", "key")).resolves.toBe("failed");
    asaas.getPayment.mockRejectedValueOnce(Object.assign(new Error("fora do ar"), { status: 503 }));
    await expect(cancelGatewayPayment("pay_1", "key")).resolves.toBe("failed");
  });
});

describe("expiração: vencida aqui sai do Asaas", () => {
  beforeEach(() => {
    asaas.deletePayment.mockReset();
    asaas.getPayment.mockReset();
    db.updates = [];
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("expira aqui e exclui no Asaas; já paga lá não expira; falha marca para tentar de novo", async () => {
    db.rows = [
      { id: "op_1", gateway_provider: "asaas", gateway_payment_id: "pay_ok" },
      { id: "op_2", gateway_provider: "asaas", gateway_payment_id: "pay_paid" },
      { id: "op_3", gateway_provider: "asaas", gateway_payment_id: "pay_down" },
      { id: "op_4", gateway_provider: "mock", gateway_payment_id: "DEMO1" },
    ];
    asaas.deletePayment.mockImplementation(async (id: string) => {
      if (id === "pay_ok") return { deleted: true, id };
      throw new Error("recusado");
    });
    asaas.getPayment.mockImplementation(async (id: string) => ({ status: id === "pay_paid" ? "CONFIRMED" : "PENDING" }));

    await expect(expireDueOnlinePayments("org_1")).resolves.toBe(3);
    expect(asaas.deletePayment).toHaveBeenCalledTimes(3);
    const expired = db.updates.find((u) => u.values.status === "expired");
    expect(expired?.ids).toEqual(["op_1", "op_3", "op_4"]);
    const pending = db.updates.find((u) => u.values.gateway_cancel_pending === true);
    expect(pending?.ids).toEqual(["op_3"]);
  });

  it("nada vencido: não chama o Asaas", async () => {
    db.rows = [];
    await expect(expireDueOnlinePayments("org_1")).resolves.toBe(0);
    expect(asaas.deletePayment).not.toHaveBeenCalled();
  });
});

describe("reconferir pagamento do webhook no Asaas", () => {
  beforeEach(() => {
    asaas.getPayment.mockReset();
    vi.stubEnv("ASAAS_API_KEY", "$aact_master");
  });

  it("aceita o objeto oficial do Asaas quando confirmado/recebido e recusa PENDING ou 404", async () => {
    const admin = createSupabaseAdminClient();

    asaas.getPayment.mockResolvedValueOnce({ id: "pay_1", status: "RECEIVED", netValue: 147.01, billingType: "PIX" });
    await expect(
      verifyGatewayPaymentForWebhook(admin, { id: "pay_1", status: "RECEIVED", netValue: 1, value: 150, billingType: "PIX" } as never),
    ).resolves.toMatchObject({ ok: true, payment: { id: "pay_1", netValue: 147.01 } });

    asaas.getPayment.mockResolvedValueOnce({ id: "pay_1", status: "PENDING" });
    await expect(
      verifyGatewayPaymentForWebhook(admin, { id: "pay_1", status: "RECEIVED", value: 150, billingType: "PIX" } as never),
    ).resolves.toEqual({ ok: false, status: "PENDING" });

    asaas.getPayment.mockRejectedValueOnce(new AsaasApiError("não existe", 404));
    await expect(
      verifyGatewayPaymentForWebhook(admin, { id: "pay_1", status: "RECEIVED", value: 150, billingType: "PIX" } as never),
    ).resolves.toEqual({ ok: false, status: "not_found" });
  });
});
