import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsaasApiError } from "@/lib/asaas";
import { adminClient, createTestTenant, signInAs, type TestTenant } from "@/test/db";

/**
 * Cadastrar chave nova da conta de recebimento (27/11/2026, ultimo recurso):
 * so a chave da mesma conta (a carteira confere), e a chave volta a valer.
 */

const listWallets = vi.hoisted(() => vi.fn());
vi.mock("@/lib/asaas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/asaas")>()),
  listWallets,
}));

const { replaceSubaccountApiKeyAction } = await import("../subaccountKeyActions");

const admin = adminClient();
let tenant: TestTenant;
const NEW_KEY = "$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OnRlc3Rl";

async function org() {
  const { data } = await admin.from("organizations").select("gateway_api_key, settings").eq("id", tenant.organizationId).single();
  return data as { gateway_api_key: string; settings: { onlinePayments?: { apiKeyStatus?: { state: string } } } };
}

beforeEach(async () => {
  listWallets.mockReset();
  tenant = await createTestTenant();
  await admin
    .from("organizations")
    .update({
      gateway_api_key: "chave-antiga",
      gateway_wallet_id: "wal_espaco",
      settings: { onlinePayments: { enabled: true, apiKeyStatus: { state: "invalid", reason: "expired", updatedAt: "2026-11-27T10:00:00.000Z" } } },
    })
    .eq("id", tenant.organizationId)
    .throwOnError();
  await signInAs(await tenant.addUser("owner"));
});

afterEach(async () => {
  await tenant.remove();
});

describe("cadastrar chave nova da conta de recebimento", () => {
  it("chave da mesma conta: grava e volta a valer", async () => {
    listWallets.mockResolvedValue({ data: [{ id: "wal_espaco" }] });
    expect(await replaceSubaccountApiKeyAction(`  ${NEW_KEY}  `)).toEqual({ ok: true });
    expect(listWallets).toHaveBeenCalledWith(NEW_KEY);
    const row = await org();
    expect(row.gateway_api_key).toBe(NEW_KEY);
    expect(row.settings.onlinePayments?.apiKeyStatus?.state).toBe("valid");
  });

  it("chave de outra conta: recusa e não grava", async () => {
    listWallets.mockResolvedValue({ data: [{ id: "wal_outra" }] });
    expect(await replaceSubaccountApiKeyAction(NEW_KEY)).toMatchObject({ ok: false, message: expect.stringContaining("outra conta") });
    expect((await org()).gateway_api_key).toBe("chave-antiga");
  });

  it("chave recusada pelo Asaas ou fora do formato: recusa sem chamar de novo", async () => {
    listWallets.mockRejectedValue(new AsaasApiError("Unauthorized", 401));
    expect(await replaceSubaccountApiKeyAction(NEW_KEY)).toMatchObject({ ok: false, message: expect.stringContaining("não aceitou") });
    expect(await replaceSubaccountApiKeyAction("abc")).toMatchObject({ ok: false, message: expect.stringContaining("$aact_") });
    expect(listWallets).toHaveBeenCalledTimes(1);
    expect((await org()).settings.onlinePayments?.apiKeyStatus?.state).toBe("invalid");
  });

  it("sem cuidar do financeiro: recusa", async () => {
    await signInAs(await tenant.addUser("attendant"));
    await expect(replaceSubaccountApiKeyAction(NEW_KEY)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
