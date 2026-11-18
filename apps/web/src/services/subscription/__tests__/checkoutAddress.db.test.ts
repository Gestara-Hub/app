import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";

/**
 * Endereco no checkout do plano (doc technical/24 §7.1 B): obrigatorio, vai
 * para o cliente no Asaas (a nota fiscal precisa) e para o titular do cartao
 * (CEP, numero e telefone exigidos pelo Asaas). Espaco sem endereco guarda o
 * do checkout; com endereco, nao sobrescreve. Asaas simulado.
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
const admin = adminClient();

const address = {
  postalCode: "69050-010",
  street: "Rua das Flores",
  number: "100",
  complement: "Sala 2",
  neighborhood: "Centro",
  city: "Manaus",
  state: "AM",
};

function checkout(over: Partial<Parameters<typeof createAsaasSubscriptionCheckoutAction>[0]> = {}) {
  return createAsaasSubscriptionCheckoutAction({
    organizationId: tenant.organizationId,
    tier: "pro",
    interval: "monthly",
    billingType: "PIX",
    customer: { name: "Academia Teste", email: "financeiro@teste.test", cpfCnpj: "11144477735", phone: "92988887777", address },
    ...over,
  });
}

async function unitAddress() {
  const { data } = await admin.from("units").select("address").eq("id", tenant.unitId).single();
  return data?.address as Record<string, string> | null;
}

beforeEach(async () => {
  vi.clearAllMocks();
  tenant = await createTestTenant();
  asaas.createOrFindCustomer.mockResolvedValue({ id: "cus_teste" });
  asaas.createSubscription.mockResolvedValue({ id: "sub_teste" });
  asaas.getSubscriptionPayments.mockResolvedValue({ data: [{ id: "pay_teste", status: "PENDING" }] });
  asaas.getPixQrCode.mockResolvedValue({ encodedImage: "x", payload: "y", expirationDate: "2026-12-01" });
});

afterEach(async () => {
  await tenant.remove();
});

describe("endereço no checkout do plano", () => {
  it("sem endereço completo, não chega ao Asaas", async () => {
    const res = await checkout({
      customer: {
        name: "Academia Teste",
        email: "financeiro@teste.test",
        cpfCnpj: "11144477735",
        address: { ...address, number: " " },
      },
    });
    expect(res).toMatchObject({ success: false, error: "Informe rua, número e bairro do endereço de cobrança." });
    expect(asaas.createOrFindCustomer).not.toHaveBeenCalled();
  });

  it("o endereço vai para o cliente no Asaas (nota fiscal)", async () => {
    await checkout();
    expect(asaas.createOrFindCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        postalCode: "69050010",
        address: "Rua das Flores",
        addressNumber: "100",
        complement: "Sala 2",
        province: "Centro",
        externalReference: tenant.organizationId,
      }),
    );
  });

  it("no cartão, CEP, número e telefone vão para o titular", async () => {
    await checkout({
      billingType: "CREDIT_CARD",
      creditCard: { holderName: "TITULAR TESTE", number: "4111111111111111", expiryMonth: "12", expiryYear: "2030", ccv: "123" },
    });
    expect(asaas.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        creditCardHolderInfo: expect.objectContaining({ postalCode: "69050010", addressNumber: "100", phone: "92988887777" }),
      }),
    );
  });

  it("espaço sem endereço guarda o do checkout; com endereço, não sobrescreve", async () => {
    expect(await unitAddress()).toBeNull();
    await checkout();
    expect(await unitAddress()).toMatchObject({ postalCode: "69050010", street: "Rua das Flores", number: "100", city: "Manaus" });

    await admin.from("organizations").update({ subscription: null }).eq("id", tenant.organizationId);
    await checkout({
      customer: {
        name: "Titular Pessoa Física",
        email: "titular@teste.test",
        cpfCnpj: "11144477735",
        address: { ...address, street: "Outra Rua", postalCode: "69000000" },
      },
    });
    expect(await unitAddress()).toMatchObject({ street: "Rua das Flores", postalCode: "69050010" });
  });
});
