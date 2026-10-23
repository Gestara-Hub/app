import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { adminClient, createTestTenant, signInAs, signOut, type TestTenant } from "@/test/db";
import { setErrorScopeRunner, setErrorSink } from "@/lib/log";
import { recordErrorToDb, runWithErrorScope } from "@/lib/log/server-sink";
import { runAction } from "../action";
import { requireTenant } from "../tenant";
import { reportBrowserErrorAction } from "../browserErrors";
import { sendDailyErrorDigest } from "../errorDigest";

/**
 * Registro de erros no banco (doc technical/21; migracao 47): o que o
 * `instrumentation.ts` liga em producao, ligado aqui.
 */

let tenant: TestTenant;
const rows = async (event: string) =>
  (await adminClient().from("error_logs").select("*").eq("event", event)).data ?? [];

beforeAll(() => {
  setErrorSink(recordErrorToDb);
  setErrorScopeRunner(runWithErrorScope);
});
afterAll(() => {
  setErrorSink(undefined);
  setErrorScopeRunner(undefined);
});

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  signOut();
  await adminClient().from("error_logs").delete().like("event", "%teste.%");
  await tenant.remove();
});

describe("registro de erros", () => {
  it("ação com erro inesperado: código na mensagem e linha com o espaço e o usuário da sessão; o mesmo erro soma", async () => {
    await signInAs(tenant.owner);
    const fail = () =>
      runAction(async () => {
        await requireTenant();
        throw new Error(`falhou ao gravar a cobrança ${crypto.randomUUID()}`);
      }, "teste.acao");
    const first = await fail();
    expect(first.ok).toBe(false);
    const code = /Código do erro: ([A-Z2-9]{8})\./.exec(first.ok ? "" : first.error.message)?.[1];
    expect(code).toBeDefined();
    let [row] = await rows("teste.acao");
    expect(row).toMatchObject({ organization_id: tenant.organizationId, last_user_id: tenant.owner.id, last_reference: code, count: 1, source: "server" });

    await fail();
    const all = await rows("teste.acao");
    expect(all).toHaveLength(1);
    [row] = all;
    expect(row.count).toBe(2);
  });

  it("erro de regra (ApiError) não vai para o registro", async () => {
    await signInAs(tenant.owner);
    await runAction(async () => {
      throw { code: "VALIDATION", message: "Nome obrigatório." };
    }, "teste.regra");
    expect(await rows("teste.regra")).toEqual([]);
  });

  it("navegador: sem sessão não grava; com sessão grava no espaço da sessão, mascarado", async () => {
    signOut();
    await reportBrowserErrorAction({ event: "teste.tela", message: "quebrou" });
    expect(await rows("browser.teste.tela")).toEqual([]);

    await signInAs(tenant.owner);
    await reportBrowserErrorAction({
      event: "teste.tela",
      message: "quebrou para o CPF 123.456.789-09",
      context: { organizationId: "outro-espaco", token: "abc" },
      reference: "K7Q2M9XD",
    });
    const [row] = await rows("browser.teste.tela");
    expect(row).toMatchObject({ organization_id: tenant.organizationId, source: "browser", last_reference: "K7Q2M9XD" });
    expect(row.message).not.toContain("123.456.789-09");
    expect(row.context.token).toBe("[oculto]");
  });

  it("resumo diário: manda os novos uma vez; o que volta a acontecer entra de novo", async () => {
    // Sem chave do MailerSend: o resumo sai no console, nada e enviado de verdade.
    vi.stubEnv("MAILERSEND_API_KEY", "");
    vi.stubEnv("ERROR_DIGEST_EMAIL", "erros@gestarahub.test");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      await signInAs(tenant.owner);
      const fail = () => runAction(async () => { await requireTenant(); throw new Error("quebrou o resumo"); }, "teste.resumo");
      await fail();
      const first = await sendDailyErrorDigest();
      expect(first.sent).toBe(true);
      expect((await rows("teste.resumo"))[0].notified_at).not.toBeNull();

      const again = await sendDailyErrorDigest();
      const pendingTest = again.errors;
      await fail();
      const back = await sendDailyErrorDigest();
      expect(back.errors).toBeGreaterThan(pendingTest);
    } finally {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    }
  });
});
