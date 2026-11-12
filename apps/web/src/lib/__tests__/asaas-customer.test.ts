import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/log", () => ({ logError: vi.fn(), logWarn: vi.fn() }));

import { createOrFindCustomer } from "@/lib/asaas/client";

/**
 * Cliente do aluno no Asaas (12/11/2026): com o id do aluno, a busca pelo CPF
 * nao entra. Antes, um CPF digitado na pagina publica achava o cliente de outro
 * aluno e a fatura saia com o nome dessa outra pessoa.
 */
type Call = { method: string; url: string };
let calls: Call[] = [];

function respond(handler: (call: Call) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { method: string }) => {
      const call = { method: init.method, url };
      calls.push(call);
      return { ok: true, status: 200, json: async () => handler(call) };
    }),
  );
}

const CUSTOMER = { name: "Pessoa Nova", cpfCnpj: "00000000000", externalReference: "aluno-1" };

beforeEach(() => {
  calls = [];
  vi.stubEnv("ASAAS_API_KEY", "chave-de-teste");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("createOrFindCustomer", () => {
  it("aluno sem cliente: cria um novo, sem buscar o cliente de outro aluno pelo CPF", async () => {
    respond((call) => (call.method === "GET" ? { data: [] } : { id: "cus_novo", name: CUSTOMER.name }));
    const customer = await createOrFindCustomer(CUSTOMER, "chave-da-subconta");
    expect(customer.id).toBe("cus_novo");
    expect(calls.some((c) => c.url.includes("cpfCnpj="))).toBe(false);
    expect(calls.map((c) => c.method)).toEqual(["GET", "POST"]);
  });

  it("aluno com cliente: atualiza o mesmo cliente com o cadastro atual", async () => {
    respond((call) => (call.method === "GET" ? { data: [{ id: "cus_aluno", name: "Nome Antigo" }] } : { id: "cus_aluno", name: CUSTOMER.name }));
    const customer = await createOrFindCustomer(CUSTOMER, "chave-da-subconta");
    expect(customer).toMatchObject({ id: "cus_aluno", name: CUSTOMER.name });
    expect(calls.map((c) => c.method)).toEqual(["GET", "PUT"]);
  });

  it("sem o id do aluno: reaproveita o cliente achado pelo CPF", async () => {
    respond(() => ({ data: [{ id: "cus_cpf", name: "Titular" }] }));
    const customer = await createOrFindCustomer({ name: "Titular", cpfCnpj: "000.000.000-00" });
    expect(customer.id).toBe("cus_cpf");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("cpfCnpj=00000000000");
  });
});
