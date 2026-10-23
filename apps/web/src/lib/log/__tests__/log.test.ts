import { afterEach, describe, expect, it, vi } from "vitest";
import { logError, reportError, setErrorSink, type ErrorEntry } from "../index";
import { fingerprintOf, maskText, maskValue } from "../mask";

/** Registro de erros (doc technical/21): mascara, agrupamento e a porta unica. */

afterEach(() => {
  setErrorSink(undefined);
  vi.restoreAllMocks();
});

const quiet = () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
};

describe("máscara (LGPD)", () => {
  it("esconde CPF, CNPJ, telefone, e-mail, tokens e chaves", () => {
    const text = maskText(
      "cpf 123.456.789-09 e 12345678909, cnpj 12.345.678/0001-90, fone (11) 98765-4321 e 5511987654321, " +
        "email ana.souza@gmail.com, Bearer abc.def, jwt eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl, " +
        "chave $aact_prod_000Mz, password=segredo123, token: xyz",
    );
    for (const secret of ["123.456.789-09", "12345678909", "12.345.678/0001-90", "98765-4321", "5511987654321", "ana.souza@gmail", "abc.def", "eyJhbGciOi", "$aact_prod", "segredo123", "xyz"]) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain("[cpf]");
    expect(text).toContain("[cnpj]");
    expect(text).toContain("a***@[email]");
  });

  it("caminhos de pacotes na pilha não viram e-mail", () => {
    const frame = "at x (/node_modules/.pnpm/next@16.2.4_@babel+core@7.28.0_@types+react@19.2.4/node_modules/next/dist/a.js:1:2)";
    expect(maskText(frame)).toBe(frame);
  });

  it("chaves sensíveis em objetos viram [oculto]; ids e números comuns ficam", () => {
    const masked = maskValue({ password: "x", apiKey: "y", user: { cpf: "1", name: "Ana" }, chargeId: "c-1", amountCents: 15000 });
    expect(masked).toEqual({ password: "[oculto]", apiKey: "[oculto]", user: { cpf: "[oculto]", name: "Ana" }, chargeId: "c-1", amountCents: 15000 });
  });
});

describe("agrupamento", () => {
  it("mesmo erro com ids e números diferentes tem a mesma impressão digital", () => {
    const a = fingerprintOf("billing", "cobrança 0035bac4-728d-4176-9f0f-7f3b7cf2eb54 não encontrada (10)");
    const b = fingerprintOf("billing", "cobrança 9f0f7f3b-728d-4176-0035-bac47cf2eb54 não encontrada (99)");
    expect(a).toBe(b);
    expect(fingerprintOf("finance", "cobrança x não encontrada")).not.toBe(a);
  });
});

describe("porta única", () => {
  it("logError lê '[evento] texto', junta o erro e manda ao destino", async () => {
    quiet();
    const entries: ErrorEntry[] = [];
    setErrorSink(async (entry) => {
      entries.push(entry);
    });
    logError("[cron:daily] Mensalidades falharam no espaço:", new Error("timeout"), { attempt: 2 });
    await vi.waitFor(() => expect(entries).toHaveLength(1));
    expect(entries[0]).toMatchObject({ event: "cron:daily", level: "error", message: "Mensalidades falharam no espaço: timeout", context: { details: { attempt: 2 } } });
    expect(entries[0].reference).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it("destino que falha ou demora não derruba quem registrou", async () => {
    quiet();
    setErrorSink(async () => {
      throw new Error("banco fora");
    });
    await expect(reportError("x", new Error("y"))).resolves.toMatch(/^[A-Z2-9]{8}$/);
  });
});
