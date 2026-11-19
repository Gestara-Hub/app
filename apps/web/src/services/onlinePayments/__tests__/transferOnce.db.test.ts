import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsaasApiError } from "@/lib/asaas";
import { adminClient, createTestTenant, signInAs, type TestTenant } from "@/test/db";

/**
 * Saque em dobro (19/11/2026): o mesmo pedido (clique duplo, nova tentativa)
 * so vira um saque; o mesmo valor para a mesma chave espera alguns segundos;
 * recusado pelo Asaas, libera tentar de novo com outro pedido.
 */

const createTransfer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/asaas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/asaas")>()),
  createTransfer,
}));

const { requestSubaccountTransferAction } = await import("../balanceActions");

const admin = adminClient();
let tenant: TestTenant;

function transfer(requestId: string, amountCents = 10_000) {
  return requestSubaccountTransferAction({
    organizationId: tenant.organizationId,
    amountCents,
    pixKey: "dono@exemplo.test",
    requestId,
  });
}

beforeEach(async () => {
  vi.stubEnv("ASAAS_API_KEY", "chave-de-teste");
  createTransfer.mockReset();
  createTransfer.mockResolvedValue({ id: "tra_1", status: "PENDING" });
  tenant = await createTestTenant();
  await admin.from("organizations").update({ gateway_api_key: "chave-da-subconta" }).eq("id", tenant.organizationId).throwOnError();
  await signInAs(await tenant.addUser("owner"));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await tenant.remove();
});

describe("saque sem repetir", () => {
  it("o mesmo pedido duas vezes (clique duplo) vira um saque só", async () => {
    const id = randomUUID();
    const [first, second] = await Promise.all([transfer(id), transfer(id)]);

    expect([first.success, second.success].sort()).toEqual([false, true]);
    expect(createTransfer).toHaveBeenCalledTimes(1);
  });

  it("mesmo valor e chave com outro pedido, logo depois: recusa", async () => {
    expect((await transfer(randomUUID())).success).toBe(true);
    const again = await transfer(randomUUID());

    expect(again).toMatchObject({ success: false, error: expect.stringContaining("Um saque igual") });
    expect(createTransfer).toHaveBeenCalledTimes(1);
  });

  it("recusado pelo Asaas: outro pedido com o mesmo valor pode tentar de novo", async () => {
    createTransfer.mockRejectedValueOnce(new AsaasApiError("Saldo insuficiente.", 400));
    expect((await transfer(randomUUID())).success).toBe(false);

    expect((await transfer(randomUUID())).success).toBe(true);
    expect(createTransfer).toHaveBeenCalledTimes(2);
  });

  it("valor diferente não é bloqueado", async () => {
    expect((await transfer(randomUUID(), 10_000)).success).toBe(true);
    expect((await transfer(randomUUID(), 5_000)).success).toBe(true);
  });
});
