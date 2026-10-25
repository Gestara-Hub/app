import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { adminClient, createTestTenant, signInAs, signOut, type TestTenant } from "@/test/db";
import { dbError, setErrorScopeRunner, setErrorSink } from "@/lib/log";
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

  it("cada ocorrência guarda o seu código e o contexto da hora; o código antigo continua valendo", async () => {
    await signInAs(tenant.owner);
    const codes: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      const result = await runAction(async () => {
        await requireTenant();
        throw dbError("teste.consulta", { message: "permission denied", code: "42501", details: "sem acesso", hint: "confira a regra" });
      }, "teste.ocorrencias");
      codes.push(/Código do erro: ([A-Z2-9]{8})\./.exec(result.ok ? "" : result.error.message)![1]);
    }
    expect(new Set(codes).size).toBe(2);
    const [row] = await rows("teste.ocorrencias");
    const { data: occurrences } = await adminClient().from("error_occurrences").select("*").eq("error_id", row.id).order("occurred_at");
    expect(occurrences?.map((o) => o.reference)).toEqual(codes);
    // Perfil, plano e tempo da hora; o detalhe do banco vem da causa.
    expect(occurrences?.[0].context).toMatchObject({ profile: "owner", plan: "free", cause: { code: "42501", details: "sem acesso", hint: "confira a regra" } });
    expect(typeof occurrences?.[0].context.ms).toBe("number");
    expect(row.last_reference).toBe(codes[1]);
  });

  it("guarda só as 20 ocorrências mais recentes de cada erro", async () => {
    const record = (reference: string) =>
      adminClient().rpc("record_error", {
        p_organization_id: tenant.organizationId,
        p_fingerprint: "fp-teste-limite",
        p_source: "server",
        p_level: "error",
        p_event: "teste.limite",
        p_message: "falhou",
        p_stack: null,
        p_context: {},
        p_reference: reference,
        p_user_id: null,
      });
    for (let i = 1; i <= 23; i += 1) await record(`LIM${String(i).padStart(5, "0")}`);
    const [row] = await rows("teste.limite");
    expect(row.count).toBe(23);
    const { data } = await adminClient().from("error_occurrences").select("reference").eq("error_id", row.id).order("occurred_at");
    expect(data).toHaveLength(20);
    expect(data?.[0].reference).toBe("LIM00004");
    expect(data?.at(-1)?.reference).toBe("LIM00023");
  });

  it("a ocorrência que uma conversa de suporte aponta nunca é apagada pelo limite de 20", async () => {
    const record = (reference: string) =>
      adminClient().rpc("record_error", {
        p_organization_id: tenant.organizationId,
        p_fingerprint: "fp-teste-fixa",
        p_source: "server",
        p_level: "error",
        p_event: "teste.fixa",
        p_message: "falhou",
        p_stack: null,
        p_context: {},
        p_reference: reference,
        p_user_id: tenant.owner.id,
      });
    await record("FIX00001");
    // A conversa some junto com o espaço de teste (ON DELETE CASCADE).
    await adminClient().rpc("support_open_thread", {
      p_org: tenant.organizationId, p_user: tenant.owner.id, p_name: "Pessoa", p_email: "p@teste.com", p_phone: null,
      p_subject: "Falhou", p_first_message: "Deu erro", p_origin: null, p_error_ref: "FIX00001", p_tier: "free", p_kind: "bug",
    });
    for (let i = 2; i <= 25; i += 1) await record(`FIX${String(i).padStart(5, "0")}`);
    const [row] = await rows("teste.fixa");
    const { data } = await adminClient().from("error_occurrences").select("reference").eq("error_id", row.id);
    const refs = (data ?? []).map((o) => o.reference);
    // A do relato fica, e as 20 mais novas também.
    expect(refs).toContain("FIX00001");
    expect(refs).toContain("FIX00025");
    expect(refs).toContain("FIX00006");
    expect(refs).not.toContain("FIX00002");
    expect(refs).toHaveLength(21);
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
