import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestTenant, ownerSql, signInAs, type TestTenant } from "@/test/db";

/**
 * "Fale com a gente" de ponta a ponta no Supabase local (doc technical/26, fase 1):
 * o assistente (modelo simulado), os limites, o envio ao suporte, o aviso por
 * e-mail, a resposta do suporte, o nao lido e o isolamento entre espacos.
 */
const mail = vi.hoisted(() => ({ sendSupportNotice: vi.fn<(notice: unknown, to?: string) => Promise<boolean>>(async () => true) }));
vi.mock("@/lib/email/support-mail", () => mail);

const actions = await import("../supportActions");
const { unwrap } = await import("@/services/server/action");

let tenant: TestTenant;
let other: TestTenant;
const owner = await ownerSql();

const realFetch = globalThis.fetch;
const claudeCalls: { url: string; init: { body: string; headers: Record<string, string> } }[] = [];

/** Responde so ao modelo; o resto (Supabase) segue pela rede de verdade. */
function stubModel(respond: () => Response) {
  claudeCalls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.startsWith("https://api.anthropic.com/")) return realFetch(input, init);
      claudeCalls.push({ url, init: { body: String(init?.body), headers: init?.headers as Record<string, string> } });
      return respond();
    }),
  );
}

function modelReplies(text: string, usage = { input_tokens: 1200, output_tokens: 150 }) {
  stubModel(() => new Response(JSON.stringify({ content: [{ type: "text", text }], usage }), { status: 200 }));
}

beforeAll(async () => {
  other = await createTestTenant({ name: "Outro espaço de suporte" });
  tenant = await createTestTenant({ name: "Espaço de suporte" });
});

afterAll(async () => {
  await owner`delete from platform.support_threads where organization_id = any(${[tenant.organizationId, other.organizationId]})`;
  await owner`delete from platform.bot_usage where month = to_char(now(), 'YYYY-MM') and false`;
  await tenant.remove();
  await other.remove();
  await owner.end();
});

beforeEach(async () => {
  await signInAs(tenant.owner);
  mail.sendSupportNotice.mockClear();
  vi.stubEnv("ANTHROPIC_API_KEY", "chave-de-teste");
  await owner`delete from platform.support_threads where organization_id = any(${[tenant.organizationId, other.organizationId]})`;
  await owner`update platform.settings set value = '15000'::jsonb where key = 'support.bot_monthly_budget_cents'`;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("assistente", () => {
  it("responde pela ajuda, cita a fonte e não manda ao suporte quando resolveu", async () => {
    modelReplies("Edite o aluno e mude a situação da assinatura para Pausada. O sistema pergunta sobre a mensalidade do mês.");
    const view = await unwrap(actions.sendSupportMessageAction({ message: "Como pauso a assinatura de um aluno?", origin: "/clients" }));
    expect(view.status).toBe("bot");
    expect(view.needsHuman).toBe(false);
    expect(view.messages.map((m) => m.author)).toEqual(["customer", "bot"]);
    expect(view.messages[1].sources?.[0]).toMatchObject({ article: "Alunos e ficha do aluno" });
    expect(view.botAvailable).toBe(true);

    // O pedido ao modelo leva a regra e o trecho certo, sem dado da pessoa.
    const { init } = claudeCalls[0];
    const body = JSON.parse(init.body);
    expect(body.system).toContain("Pausar a assinatura");
    expect(init.headers["x-api-key"]).toBe("chave-de-teste");

    const done = await unwrap(actions.markSupportBotHelpedAction(view.threadId, true));
    expect(done.status).toBe("resolved");
    expect(done.botHelped).toBe(true);
  });

  it("masca dado pessoal antes de ir ao modelo", async () => {
    modelReplies("Confira em Cobranças.");
    await unwrap(actions.sendSupportMessageAction({ message: "Minha cobrança do CPF 529.982.247-25 e do e-mail ana@teste.com sumiu" }));
    const { init } = claudeCalls[0];
    expect(init.body).not.toContain("529.982");
    expect(init.body).not.toContain("ana@teste.com");
    expect(init.body).toContain("[CPF]");
  });

  it("CPF, e-mail e cartão nunca ficam guardados na conversa", async () => {
    modelReplies("Confira em Cobranças.");
    const view = await unwrap(actions.sendSupportMessageAction({ message: "Meu CPF 529.982.247-25, e-mail ana@teste.com, cartão 4111 1111 1111 1111" }));
    expect(view.messages[0].body).toBe("Meu CPF [CPF], e-mail [e-mail], cartão [número]");
    const rows = await owner<{ body: string }[]>`select body from platform.support_messages where thread_id = ${view.threadId}`;
    expect(JSON.stringify(rows)).not.toMatch(/529\.982|ana@teste|4111/);
  });

  it("o marcador do modelo pede o suporte, e o gasto entra no mês", async () => {
    modelReplies("Confira se o Pix foi gerado hoje.\n[[humano]]", { input_tokens: 2000, output_tokens: 300 });
    const view = await unwrap(actions.sendSupportMessageAction({ message: "O pagamento do aluno não caiu" }));
    expect(view.needsHuman).toBe(true);
    expect(view.messages[1].body).not.toContain("[[humano]]");
    expect(view.messages[1].sources).toBeUndefined();
    const [{ month_cost_cents }] = await owner<{ month_cost_cents: number }[]>`
      select cost_cents as month_cost_cents from platform.bot_usage where month = to_char(now(), 'YYYY-MM')`;
    expect(month_cost_cents).toBeGreaterThan(0);
  });

  it("sem chave do modelo, vai direto para o suporte", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const view = await unwrap(actions.sendSupportMessageAction({ message: "Preciso de ajuda com uma turma" }));
    expect(view.needsHuman).toBe(true);
    expect(view.botAvailable).toBe(false);
    expect(view.messages[1].body).toContain("indisponível");
  });

  it("falha do modelo vira convite ao suporte, sem gastar", async () => {
    stubModel(() => new Response("erro", { status: 500 }));
    const view = await unwrap(actions.sendSupportMessageAction({ message: "Como crio uma turma?" }));
    expect(view.needsHuman).toBe(true);
    expect(view.messages[1].body).toContain("Quer enviar sua dúvida para o suporte");
  });

  it("estourou o gasto do mês: não chama o modelo", async () => {
    await owner`update platform.settings set value = '0'::jsonb where key = 'support.bot_monthly_budget_cents'`;
    modelReplies("não deveria chamar");
    const view = await unwrap(actions.sendSupportMessageAction({ message: "Como crio uma turma?" }));
    expect(claudeCalls).toHaveLength(0);
    expect(view.needsHuman).toBe(true);
    expect(view.botAvailable).toBe(false);
  });
});

describe("suporte", () => {
  it("enviar ao suporte avisa por e-mail, marca urgente e a resposta chega com não lido", async () => {
    modelReplies("Não encontrei isso na ajuda.\n[[humano]]");
    const first = await unwrap(actions.sendSupportMessageAction({ message: "Não consigo entrar no sistema desde ontem", errorReference: "ABC123" }));
    const escalated = await unwrap(actions.escalateSupportThreadAction(first.threadId));
    expect(escalated.status).toBe("waiting_us");
    expect(escalated.messages.at(-1)).toMatchObject({ author: "system" });
    expect(mail.sendSupportNotice).toHaveBeenCalledTimes(1);
    expect(mail.sendSupportNotice.mock.calls[0][0]).toMatchObject({ kind: "new", urgent: true, spaceName: "Espaço de suporte" });

    // Escalar de novo nao repete o aviso.
    await unwrap(actions.escalateSupportThreadAction(first.threadId));
    expect(mail.sendSupportNotice).toHaveBeenCalledTimes(1);

    // O suporte responde pelo painel (direto no schema platform).
    await owner`
      insert into platform.support_messages (thread_id, author, staff_name, body) values (${first.threadId}, 'staff', 'Marcello', 'Já estamos olhando.')`;
    await owner`update platform.support_threads set status = 'waiting_customer', last_message_at = now() where id = ${first.threadId}`;
    expect(await unwrap(actions.supportUnreadCountAction())).toBe(1);
    const list = await unwrap(actions.listSupportThreadsAction());
    expect(list[0]).toMatchObject({ id: first.threadId, status: "waiting_customer", urgent: true, unread: 1 });

    const opened = await unwrap(actions.getSupportThreadAction(first.threadId));
    expect(opened.messages.at(-1)).toMatchObject({ author: "staff", staffName: "Marcello", body: "Já estamos olhando." });
    expect(await unwrap(actions.supportUnreadCountAction())).toBe(0);

    // A pessoa responde: volta para a fila do suporte e avisa.
    const replied = await unwrap(actions.sendSupportMessageAction({ threadId: first.threadId, message: "Obrigado, aguardo." }));
    expect(replied.status).toBe("waiting_us");
    expect(mail.sendSupportNotice).toHaveBeenCalledTimes(2);
    expect(mail.sendSupportNotice.mock.calls[1][0]).toMatchObject({ kind: "reply" });
  });

  it("notas internas nunca chegam ao cliente", async () => {
    modelReplies("Ok.");
    const view = await unwrap(actions.sendSupportMessageAction({ message: "Dúvida de teste" }));
    await owner`insert into platform.support_messages (thread_id, author, staff_name, body, internal) values (${view.threadId}, 'staff', 'Marcello', 'Cliente chato', true)`;
    const again = await unwrap(actions.getSupportThreadAction(view.threadId));
    expect(again.messages.map((m) => m.body)).not.toContain("Cliente chato");
    expect(await unwrap(actions.supportUnreadCountAction())).toBe(0);
  });

  it("outro espaço não vê nem mexe na conversa", async () => {
    modelReplies("Ok.");
    const view = await unwrap(actions.sendSupportMessageAction({ message: "Conversa do espaço A" }));
    await signInAs(other.owner);
    expect(await unwrap(actions.listSupportThreadsAction())).toEqual([]);
    await expect(unwrap(actions.getSupportThreadAction(view.threadId))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(unwrap(actions.sendSupportMessageAction({ threadId: view.threadId, message: "invasão" }))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(unwrap(actions.escalateSupportThreadAction(view.threadId))).rejects.toBeTruthy();
    // E nada mudou na conversa original.
    const [row] = await owner<{ status: string; count: number }[]>`
      select t.status, (select count(*)::int from platform.support_messages m where m.thread_id = t.id) as count
        from platform.support_threads t where t.id = ${view.threadId}`;
    expect(row).toMatchObject({ status: "bot", count: 2 });
  });

  it("mensagem vazia ou grande demais é recusada", async () => {
    await expect(unwrap(actions.sendSupportMessageAction({ message: "   " }))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(unwrap(actions.sendSupportMessageAction({ message: "x".repeat(2001) }))).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
