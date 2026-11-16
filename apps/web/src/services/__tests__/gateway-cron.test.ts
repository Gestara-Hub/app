import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Rotina de hora em hora de todos os espacos (doc 19, fase 0): Asaas em
 * paralelo, e o codigo que o Asaas diz ja pago recebe a baixa aqui (antes
 * ficava em aberto e voltava primeiro em toda rodada, travando a fila).
 */
const asaas = vi.hoisted(() => ({ deletePayment: vi.fn(), getPayment: vi.fn() }));
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
const settle = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/services/onlinePayments/asaasSettlement", () => ({ settleAsaasPayment: settle }));

const db = vi.hoisted(() => ({
  rows: [] as Array<Record<string, string>>,
  updates: [] as Array<{ values: Record<string, unknown>; ids: string[] }>,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table === "organizations") {
        const q = {
          select: () => q,
          in: async (_c: string, ids: string[]) => ({ data: ids.map((id) => ({ id, gateway_api_key: "$aact_sub" })) }),
        };
        return q;
      }
      const select = { eq: () => select, lte: () => select, order: () => select, limit: async () => ({ data: db.rows }) };
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

const { expireAllDueOnlinePayments, retryAllPendingGatewayCancels } = await import("@/services/onlinePayments/gateway");

beforeEach(() => {
  asaas.deletePayment.mockReset();
  asaas.getPayment.mockReset();
  settle.mockClear();
  db.updates = [];
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("expiração de todos os espaços", () => {
  it("expira os vencidos, marca a falha e dá baixa no que o Asaas diz pago", async () => {
    db.rows = [
      { id: "op_1", organization_id: "org_a", gateway_provider: "asaas", gateway_payment_id: "pay_ok" },
      { id: "op_2", organization_id: "org_a", gateway_provider: "asaas", gateway_payment_id: "pay_paid" },
      { id: "op_3", organization_id: "org_b", gateway_provider: "asaas", gateway_payment_id: "pay_down" },
      { id: "op_4", organization_id: "org_b", gateway_provider: "mock", gateway_payment_id: "DEMO1" },
    ];
    asaas.deletePayment.mockImplementation(async (id: string) => {
      if (id === "pay_ok") return { deleted: true, id };
      throw new Error("recusado");
    });
    asaas.getPayment.mockImplementation(async (id: string) => ({ id, status: id === "pay_paid" ? "RECEIVED" : "PENDING" }));

    await expect(expireAllDueOnlinePayments()).resolves.toBe(3);
    expect(db.updates.find((u) => u.values.status === "expired")?.ids.sort()).toEqual(["op_1", "op_3", "op_4"]);
    expect(db.updates.find((u) => u.values.gateway_cancel_pending === true)?.ids).toEqual(["op_3"]);
    // Pago no Asaas: baixa como disponivel (RECEIVED).
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith(expect.objectContaining({ id: "pay_paid", status: "RECEIVED" }), true);
  });

  it("nova tentativa de cancelamento grava os resolvidos de uma vez", async () => {
    db.rows = [
      { id: "op_1", organization_id: "org_a", gateway_payment_id: "pay_ok" },
      { id: "op_2", organization_id: "org_a", gateway_payment_id: "pay_down" },
    ];
    asaas.deletePayment.mockImplementation(async (id: string) => {
      if (id === "pay_ok") return { deleted: true, id };
      throw new Error("fora do ar");
    });
    asaas.getPayment.mockImplementation(async () => ({ status: "PENDING" }));

    await expect(retryAllPendingGatewayCancels()).resolves.toBe(1);
    const cleared = db.updates.filter((u) => u.values.gateway_cancel_pending === false);
    expect(cleared).toHaveLength(1);
    expect(cleared[0].ids).toEqual(["op_1"]);
  });
});
