import { afterEach, describe, expect, it, vi } from "vitest";
import { isApiError } from "@gestarahub/contracts";
import { dbError, logError, reportError, setErrorSink, type ErrorEntry } from "../index";
import { fingerprintOf, maskStack, maskText, maskValue } from "../mask";

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
        "chave $aact_prod_000Mz, aws AKIA1234567890ABCDEF, password=segredo123, token: xyz",
    );
    for (const secret of ["123.456.789-09", "12345678909", "12.345.678/0001-90", "98765-4321", "5511987654321", "ana.souza@gmail", "abc.def", "eyJhbGciOi", "$aact_prod", "AKIA1234", "segredo123", "xyz"]) {
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

describe("detalhe do erro", () => {
  const capture = async (run: () => void) => {
    quiet();
    const entries: ErrorEntry[] = [];
    setErrorSink(async (entry) => {
      entries.push(entry);
    });
    run();
    await vi.waitFor(() => expect(entries).toHaveLength(1));
    return entries[0];
  };

  it("a pilha longa não é cortada em 2.000 caracteres", async () => {
    const error = new Error("falhou");
    error.stack = `Error: falhou\n${"    at quadro (/app/x.js:1:1)\n".repeat(150)}    at ultimoQuadro (/app/x.js:9:9)`;
    expect(error.stack.length).toBeGreaterThan(2000);
    const entry = await capture(() => void reportError("teste.pilha", error));
    expect(entry.stack).toContain("ultimoQuadro");
    expect(entry.stack!.length).toBeGreaterThan(2000);
  });

  it("pilha enorme ainda tem teto (8.000)", async () => {
    const error = new Error("falhou");
    error.stack = `Error: falhou\n${"    at quadro (/app/x.js:1:1)\n".repeat(1000)}`;
    const entry = await capture(() => void reportError("teste.teto", error));
    expect(entry.stack!.length).toBeLessThanOrEqual(8003);
  });

  it("dbError guarda o código, o detalhe e a dica do banco", async () => {
    const error = dbError("world: gravação", { message: "duplicate key value", code: "23505", details: "Key (id)=(1) already exists.", hint: "Use outro id" });
    expect(error.message).toBe("world: gravação: duplicate key value");
    const entry = await capture(() => void reportError("teste.db", error));
    expect(entry.context).toMatchObject({ cause: { code: "23505", details: "Key (id)=(1) already exists.", hint: "Use outro id" } });
  });

  it("dbError sem detalhe nem dica não inventa causa", () => {
    expect(dbError("x", { message: "falhou" }).cause).toBeUndefined();
  });

  it("dbError nunca tem `code` próprio: não pode passar por erro de regra", () => {
    const error = dbError("x", { message: "falhou", code: "42501" });
    expect("code" in error).toBe(false);
    expect(isApiError(error)).toBe(false);
  });

  it("a versão do app (commit) entra no contexto do erro de servidor", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "0123456789abcdef");
    try {
      const entry = await capture(() => void reportError("teste.versao", new Error("falhou")));
      expect(entry.context).toMatchObject({ release: "0123456" });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("máscara da pilha", () => {
  const FILE = "apps_web_src_lib_supabase_admin_ts_1olr2y2_abcdefghijklmnop._.js";

  it("nome de arquivo longo nos quadros fica; a regra de token longo só vale fora dos quadros", () => {
    expect(FILE.replace("._.js", "").length).toBeGreaterThanOrEqual(40);
    const stack = `Error: falhou com ${"A1b2".repeat(12)}\n    at fn (.next/server/chunks/${FILE}:24:62199)`;
    const masked = maskStack(stack);
    expect(masked).toContain(`chunks/${FILE}:24:62199`);
    expect(masked.split("\n")[0]).toBe("Error: falhou com [token]");
    // O maskText comum continua apagando (é o que protege mensagem e contexto).
    expect(maskText(`at fn (${FILE}:1:1)`)).toContain("[token]");
  });

  it("chave de formato conhecido ainda sai, mesmo dentro de um quadro", () => {
    const stack = "Error: x\n    at fn (/app/x.js:1:1) token=abcdef123456 eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.assinatura1234";
    const masked = maskStack(stack);
    expect(masked).not.toContain("abcdef123456");
    expect(masked).not.toContain("eyJhbGci");
  });

  it("CPF e e-mail em quadro de pilha continuam mascarados e o teto vale", () => {
    expect(maskStack("Error: x\n    at fn (/app/529.982.247-25.js:1:1)")).toContain("[cpf]");
    expect(maskStack("x".repeat(9000)).length).toBeLessThanOrEqual(8003);
  });
});

