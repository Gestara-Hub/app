import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { adminClient, createTestTenant, signInAs, signOut, type TestTenant } from "@/test/db";
import { dbError, setErrorScopeRunner, setErrorSink } from "@/lib/log";
import { recordErrorToDb, runWithErrorScope } from "@/lib/log/server-sink";
import { runAction } from "../action";
import { requireTenant } from "../tenant";
import { reportBrowserErrorAction } from "../browserErrors";
import { attachBreadcrumbsAction } from "../breadcrumbs";
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

  it("diz se o erro nunca aconteceu em nenhum espaço (alerta na hora, doc technical/27)", async () => {
    const fingerprint = `fp-teste-novo-${Date.now()}`;
    const record = (organizationId: string | null, reference: string) =>
      adminClient().rpc("record_error", {
        p_organization_id: organizationId,
        p_fingerprint: fingerprint,
        p_source: "server",
        p_level: "error",
        p_event: "teste.novo",
        p_message: "falhou",
        p_stack: null,
        p_context: {},
        p_reference: reference,
        p_user_id: null,
      });
    expect((await record(tenant.organizationId, "NEW00001")).data).toBe(true);
    expect((await record(tenant.organizationId, "NEW00002")).data).toBe(false);
    // Outro espaço (aqui, sem espaço) com o mesmo erro: já não é novo no sistema.
    expect((await record(null, "NEW00003")).data).toBe(false);
    await adminClient().from("error_logs").delete().eq("fingerprint", fingerprint);
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

  it("o resultado da ação leva o nome dela, com sucesso ou erro", async () => {
    await signInAs(tenant.owner);
    expect(await runAction(async () => 1, "teste.nome")).toMatchObject({ ok: true, data: 1, event: "teste.nome" });
    expect(await runAction(async () => { throw new Error("falhou"); }, "teste.nome")).toMatchObject({ ok: false, event: "teste.nome" });
  });

  it("os passos do navegador completam a ocorrência: só a mesma pessoa, só uma vez, só o que é válido", async () => {
    await signInAs(tenant.owner);
    const result = await runAction(async () => {
      await requireTenant();
      throw new Error("falhou ao gravar a presença");
    }, "teste.passos");
    const code = /Código do erro: ([A-Z2-9]{8})\./.exec(result.ok ? "" : result.error.message)![1];
    const occurrence = async () => {
      const [row] = await rows("teste.passos");
      const { data } = await adminClient().from("error_occurrences").select("context").eq("error_id", row.id).eq("reference", code).single();
      return data?.context as { breadcrumbs?: { s: number; k: string; v: string }[] };
    };
    expect((await occurrence()).breadcrumbs).toBeUndefined();

    // Outra pessoa, de outro espaço, não completa a ocorrência dos outros.
    const stranger = await createTestTenant();
    try {
      await signInAs(stranger.owner);
      await attachBreadcrumbsAction({ reference: code, crumbs: [{ s: 3, k: "nav", v: "/intruso" }] });
      expect((await occurrence()).breadcrumbs).toBeUndefined();
    } finally {
      await stranger.remove();
    }

    await signInAs(tenant.owner);
    // Código inválido e passos inválidos não gravam nada.
    await attachBreadcrumbsAction({ reference: "curto", crumbs: [{ s: 3, k: "nav", v: "/x" }] });
    await attachBreadcrumbsAction({ reference: code, crumbs: [{ s: 3, k: "clique", v: "/x" } as never] });
    expect((await occurrence()).breadcrumbs).toBeUndefined();

    await attachBreadcrumbsAction({
      reference: code,
      crumbs: [
        { s: 12, k: "nav", v: "/classes/:id" },
        { s: 4, k: "action", v: "turmas.markAttendance" },
        { s: 0, k: "action_error", v: "turmas.save (K7Q2M9XD) 529.982.247-25" },
      ],
    });
    const saved = (await occurrence()).breadcrumbs!;
    expect(saved.map((c) => c.k)).toEqual(["nav", "action", "action_error"]);
    expect(saved[2].v).toBe("turmas.save (K7Q2M9XD) [cpf]");

    // Uma vez só: um segundo envio não troca o que já está.
    await attachBreadcrumbsAction({ reference: code, crumbs: [{ s: 1, k: "nav", v: "/outra" }] });
    expect((await occurrence()).breadcrumbs).toHaveLength(3);
  });

  it("erro do navegador leva os passos no próprio contexto", async () => {
    await signInAs(tenant.owner);
    await reportBrowserErrorAction({
      event: "teste.navegador",
      message: "Falha na tela",
      context: { path: "/classes", breadcrumbs: [{ s: 2, k: "nav", v: "/classes" }] },
    });
    const [row] = await rows("browser.teste.navegador");
    expect(row.context).toMatchObject({ path: "/classes", breadcrumbs: [{ s: 2, k: "nav", v: "/classes" }] });
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
    // Sem credenciais AWS SES: o resumo sai no console, nada e enviado de verdade.
    vi.stubEnv("AWS_ACCESS_KEY_ID", "");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "");
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
