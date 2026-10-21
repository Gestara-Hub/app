import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cancelar a cobranca online tambem no Asaas (21/10/2026): sem isso o aluno
 * ainda pagava o link ou o QR antigo. Ja paga no Asaas, o pagamento vale.
 */
const asaas = vi.hoisted(() => ({
  deletePayment: vi.fn(),
  getPayment: vi.fn(),
}));

vi.mock("@/lib/asaas", () => ({
  deletePayment: asaas.deletePayment,
  getPayment: asaas.getPayment,
  createWebhook: vi.fn(),
  getAccountFees: vi.fn(),
  getAccountInfo: vi.fn(),
  listWebhooks: vi.fn(),
  updateWebhook: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

const { cancelGatewayPayment } = await import("@/services/gatewayAccountBackend");

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
