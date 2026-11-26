import { afterEach, describe, expect, it, vi } from "vitest";
import { platformSplitCents } from "@gestarahub/core/payment-fees";
import { effectivePlatformSplitCents } from "../platformSplit";

// Decisao 4 da noite de 31/10/2026: sem a carteira principal o Asaas nao separa
// a taxa do GestaraHub, entao ela nao entra no valor do aluno nem no liquido.

describe("effectivePlatformSplitCents", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("com o Asaas e a carteira principal, cobra a taxa do plano", () => {
    vi.stubEnv("ASAAS_API_KEY", "chave-de-teste");
    vi.stubEnv("ASAAS_MASTER_WALLET_ID", "carteira-de-teste");
    expect(effectivePlatformSplitCents("free", 15000)).toBe(platformSplitCents("free", 15000));
    expect(effectivePlatformSplitCents("pro", 15000)).toBe(platformSplitCents("pro", 15000));
  });

  it("com o Asaas e sem a carteira principal, a taxa e zero", () => {
    vi.stubEnv("ASAAS_API_KEY", "chave-de-teste");
    vi.stubEnv("ASAAS_MASTER_WALLET_ID", "");
    expect(effectivePlatformSplitCents("free", 15000)).toBe(0);
    expect(effectivePlatformSplitCents(undefined, 15000)).toBe(0);
  });

  it("sem o Asaas (demonstracao e e2e), o provedor de demonstracao simula a taxa", () => {
    vi.stubEnv("ASAAS_API_KEY", "");
    vi.stubEnv("ASAAS_MASTER_WALLET_ID", "");
    expect(effectivePlatformSplitCents("free", 15000)).toBe(platformSplitCents("free", 15000));
  });
});
