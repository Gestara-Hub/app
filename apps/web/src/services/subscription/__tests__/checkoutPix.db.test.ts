import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsaasApiError } from "@/lib/asaas";
import { createTestTenant, type TestTenant } from "@/test/db";

/**
 * Pix do checkout do plano (19/11/2026): o Asaas gera a cobranca e o QR Code
 * logo depois da assinatura, entao a busca tenta de novo. Sem o Pix, a
 * assinatura recem-criada e cancelada (antes ficava no Asaas cobrando todo
 * mes) e o cliente ve uma mensagem simples, sem o texto do Asaas.
 */

const asaas = vi.hoisted(() => ({
  createOrFindCustomer: vi.fn(),
  createSubscription: vi.fn(),
  getSubscriptionPayments: vi.fn(),
  getPixQrCode: vi.fn(),
  cancelSubscription: vi.fn(),
}));

vi.mock("@/lib/asaas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/asaas")>()),
  ...asaas,
  getAsaasConfig: () => ({ apiUrl: "https://sandbox.asaas.com/api/v3", masterApiKey: "chave-de-teste" }),
}));

const { createAsaasSubscriptionCheckoutAction } = await import("../subscriptionCheckoutActions");

let tenant: TestTenant;

function checkout() {
  return createAsaasSubscriptionCheckoutAction({
    organizationId: tenant.organizationId,
    tier: "pro",
    interval: "monthly",
    billingType: "PIX",
    customer: {
      name: "Academia Teste",
      email: "financeiro@teste.test",
      cpfCnpj: "11144477735",
      phone: "92988887777",
      address: {
        postalCode: "69050-010",
        street: "Rua das Flores",
        number: "100",
        neighborhood: "Centro",
        city: "Manaus",
        state: "AM",
      },
    },
  });
}

const QR = { encodedImage: "x", payload: "y", expirationDate: "2026-12-01" };

beforeEach(async () => {
  vi.clearAllMocks();
  tenant = await createTestTenant();
  asaas.createOrFindCustomer.mockResolvedValue({ id: "cus_teste" });
  asaas.createSubscription.mockResolvedValue({ id: "sub_teste" });
  asaas.getSubscriptionPayments.mockResolvedValue({ data: [{ id: "pay_teste", status: "PENDING" }] });
  asaas.getPixQrCode.mockResolvedValue(QR);
  asaas.cancelSubscription.mockResolvedValue({});
});

afterEach(async () => {
  await tenant.remove();
});

describe("Pix do checkout do plano", () => {
  it("cobranca que demora a aparecer: tenta de novo e gera o Pix", async () => {
    asaas.getSubscriptionPayments.mockResolvedValueOnce({ data: [] });

    const res = await checkout();

    expect(res).toMatchObject({ success: true, subscriptionId: "sub_teste", paymentId: "pay_teste" });
    expect(asaas.getSubscriptionPayments).toHaveBeenCalledTimes(2);
    expect(asaas.cancelSubscription).not.toHaveBeenCalled();
  }, 15_000);

  it("sem Pix: cancela a assinatura criada e mostra mensagem simples", async () => {
    asaas.getPixQrCode.mockRejectedValue(
      new AsaasApiError("Você não possui uma chave Pix cadastrada para recebimentos de cobranças via Pix.", 400),
    );

    const res = await checkout();

    expect(res).toMatchObject({ success: false, error: "Não foi possível gerar o Pix agora. Tente de novo em instantes." });
    expect(asaas.cancelSubscription).toHaveBeenCalledWith("sub_teste");
  }, 15_000);

  it("chave do Asaas recusada: mensagem simples, sem o texto do Asaas", async () => {
    asaas.createOrFindCustomer.mockRejectedValue(new AsaasApiError("A chave de API fornecida é inválida", 401));

    const res = await checkout();

    expect(res).toMatchObject({ success: false, error: "Não foi possível gerar a assinatura agora. Tente de novo em instantes." });
    expect(asaas.createSubscription).not.toHaveBeenCalled();
  });

  it("dado recusado pelo Asaas: a mensagem dele chega ao cliente", async () => {
    asaas.createOrFindCustomer.mockRejectedValue(new AsaasApiError("O CPF/CNPJ informado é inválido.", 400));

    const res = await checkout();

    expect(res).toMatchObject({ success: false, error: "O CPF/CNPJ informado é inválido." });
  });
});
