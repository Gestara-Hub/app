import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ASAAS_GET_RETRY_DELAYS_MS, createTransfer, getPayment } from "../client";

/**
 * Novas tentativas no Asaas (19/11/2026): so consulta (GET) repete, em falha
 * de rede, limite ou Asaas fora. Criar, alterar e excluir nunca repetem (cobrar
 * ou sacar em dobro).
 */

const fetchMock = vi.fn();
const originalDelays = [...ASAAS_GET_RETRY_DELAYS_MS];

beforeEach(() => {
  vi.stubEnv("ASAAS_API_KEY", "chave-de-teste");
  vi.stubGlobal("fetch", fetchMock);
  ASAAS_GET_RETRY_DELAYS_MS.fill(0);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  ASAAS_GET_RETRY_DELAYS_MS.splice(0, ASAAS_GET_RETRY_DELAYS_MS.length, ...originalDelays);
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("novas tentativas no Asaas", () => {
  it("consulta com Asaas fora tenta de novo e devolve o dado", async () => {
    fetchMock.mockResolvedValueOnce(json(503, { errors: [] })).mockResolvedValueOnce(json(200, { id: "pay_1" }));

    await expect(getPayment("pay_1")).resolves.toMatchObject({ id: "pay_1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("consulta com falha de rede tenta de novo", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(json(200, { id: "pay_1" }));

    await expect(getPayment("pay_1")).resolves.toMatchObject({ id: "pay_1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("consulta recusada (4xx) não tenta de novo", async () => {
    fetchMock.mockResolvedValue(json(404, { errors: [{ code: "not_found", description: "Não encontrada." }] }));

    await expect(getPayment("pay_x")).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("saque (POST) nunca tenta de novo, mesmo com o Asaas fora", async () => {
    fetchMock.mockResolvedValue(json(503, { errors: [] }));

    await expect(
      createTransfer({ value: 10, operationType: "PIX", pixAddressKey: "a@b.com", pixAddressKeyType: "EMAIL" }, "chave-sub"),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("cadastro do pagador no Asaas", () => {
  it("sem mudança: não atualiza; com mudança: atualiza", async () => {
    const { customerChanged } = await import("../client");
    const existing = { id: "cus_1", name: "Ana Souza", cpfCnpj: "11144477735", mobilePhone: "92988887777", notificationDisabled: true };
    expect(customerChanged(existing, { name: "Ana Souza", cpfCnpj: "111.444.777-35", mobilePhone: "(92) 98888-7777", notificationDisabled: true })).toBe(false);
    expect(customerChanged(existing, { name: "Ana Souza Lima" })).toBe(true);
    expect(customerChanged(existing, { email: "ana@exemplo.test" })).toBe(true);
    expect(customerChanged({ ...existing, notificationDisabled: false }, { notificationDisabled: true })).toBe(true);
  });
});
