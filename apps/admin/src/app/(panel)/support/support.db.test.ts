import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { jar, redirectedTo } from "@/test/next-mocks";
import { cleanupAdmins, createAdminUser, signInAdmin, type TestAdmin } from "@/test/admin-session";
import { ownerSql, panelSql } from "@/test/local";

vi.mock("next/headers", async () => (await import("@/test/next-mocks")).headersMock());
vi.mock("next/navigation", async () => (await import("@/test/next-mocks")).navigationMock());
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * Suporte do painel de ponta a ponta no Supabase local (doc technical/26, fase 1):
 * fila (ordem, filtros, busca, contagem), resposta (grava, muda a situacao, avisa
 * por e-mail e audita), nota interna, encerrar, urgente, respostas prontas,
 * permissoes por papel e o resumo diario.
 */
const owner = ownerSql();
const panel = panelSql();
const admins: TestAdmin[] = [];
let orgA = "";
let orgB = "";
const created: Record<string, string> = {};

const realFetch = globalThis.fetch;
const mails: { to: string; subject: string; text: string }[] = [];

function stubMailerSend() {
  mails.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).startsWith("https://api.mailersend.com/")) return realFetch(input, init);
      const body = JSON.parse(String(init?.body));
      mails.push({ to: body.to[0].email, subject: body.subject, text: body.text });
      return new Response("{}", { status: 202 });
    }),
  );
}

async function openThread(org: string, name: string, email: string, subject: string, message: string): Promise<string> {
  const [row] = await owner<{ id: string }[]>`
    select public.support_open_thread(${org}, ${"user-" + name}, ${name}, ${email}, null, ${subject}, ${message}, '/clients', null, 'free') as id`;
  return row.id;
}

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

beforeAll(async () => {
  const [a] = await owner<{ id: string }[]>`insert into public.organizations (name, model) values ('Academia Alfa do Teste', 'classes') returning id`;
  const [b] = await owner<{ id: string }[]>`insert into public.organizations (name, model) values ('Estúdio Beta do Teste', 'classes') returning id`;
  orgA = a.id;
  orgB = b.id;
  // Quatro conversas: urgente mais nova, normal antiga, aguardando cliente, encerrada.
  created.antiga = await openThread(orgA, "Ana Alfa", "ana@alfa.teste", "Como pauso um aluno", "Preciso pausar um aluno");
  created.urgente = await openThread(orgB, "Bia Beta", "bia@beta.teste", "Pix não caiu", "Pagamento não caiu");
  created.aguardando = await openThread(orgA, "Caio Alfa", "caio@alfa.teste", "Dúvida de plano", "Quero saber do plano");
  created.encerrada = await openThread(orgB, "Duda Beta", "duda@beta.teste", "Certificado", "Como emito certificado");
  await owner`update platform.support_threads set status = 'waiting_us', last_customer_message_at = now() - interval '5 days' where id = ${created.antiga}`;
  await owner`update platform.support_threads set status = 'waiting_us', urgent = true, last_customer_message_at = now() - interval '1 hour' where id = ${created.urgente}`;
  await owner`update platform.support_threads set status = 'waiting_customer' where id = ${created.aguardando}`;
  await owner`update platform.support_threads set status = 'resolved', resolved_at = now() where id = ${created.encerrada}`;
});

afterAll(async () => {
  await owner`delete from platform.support_threads where organization_id = any(${[orgA, orgB]})`;
  await owner`delete from platform.support_macros where title like 'Teste %'`;
  await owner`delete from public.organizations where id = any(${[orgA, orgB]})`;
  await cleanupAdmins(admins);
  await owner.end();
  await panel.end();
});

beforeEach(() => {
  vi.resetModules();
  jar.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("fila do suporte", () => {
  it("quem espera resposta vem primeiro: urgente antes, depois o mais antigo", async () => {
    const { listThreads } = await import("@/lib/server/support");
    const { rows } = await listThreads({ filter: "attention", page: 1 });
    const mine = rows.filter((r) => [created.antiga, created.urgente].includes(r.id));
    expect(mine.map((r) => r.id)).toEqual([created.urgente, created.antiga]);
    expect(mine[0]).toMatchObject({ urgent: true, organizationName: "Estúdio Beta do Teste", userName: "Bia Beta" });
  });

  it("filtra por situação e busca por espaço, pessoa e assunto", async () => {
    const { listThreads } = await import("@/lib/server/support");
    const ids = async (input: Parameters<typeof listThreads>[0]) => (await listThreads(input)).rows.map((r) => r.id);
    expect(await ids({ filter: "waiting_customer", page: 1 })).toContain(created.aguardando);
    expect(await ids({ filter: "waiting_customer", page: 1 })).not.toContain(created.antiga);
    expect(await ids({ filter: "resolved", page: 1 })).toContain(created.encerrada);
    expect(await ids({ filter: "all", q: "alfa do teste", page: 1 })).toEqual(expect.arrayContaining([created.antiga, created.aguardando]));
    expect(await ids({ filter: "all", q: "alfa do teste", page: 1 })).not.toContain(created.urgente);
    expect(await ids({ filter: "all", q: "bia@beta", page: 1 })).toEqual([created.urgente]);
    expect(await ids({ filter: "all", q: "Certificado", page: 1 })).toEqual([created.encerrada]);
    // Caracteres do LIKE nao viram curinga.
    expect(await ids({ filter: "all", q: "%", page: 1 })).toEqual([]);
  });

  it("conta o que precisa de atenção", async () => {
    const { threadCounts } = await import("@/lib/server/support");
    const counts = await threadCounts();
    expect(counts.attention).toBeGreaterThanOrEqual(2);
    expect(counts.urgent).toBeGreaterThanOrEqual(1);
    expect(counts.waitingCustomer).toBeGreaterThanOrEqual(1);
  });
});

describe("responder e administrar uma conversa", () => {
  it("responder grava, passa para 'aguardando o cliente', avisa por e-mail e audita", async () => {
    const admin = await createAdminUser("platform_owner", "Marcello Teste");
    admins.push(admin);
    vi.stubEnv("MAILERSEND_API_KEY", "chave-de-teste");
    stubMailerSend();
    await signInAdmin(admin);
    const { replyAction } = await import("./actions");

    const result = await replyAction({}, form({ threadId: created.antiga, body: "Edite o aluno e mude a situação para Pausada." }));
    expect(result).toEqual({ ok: true });

    const { getThread } = await import("@/lib/server/support");
    const thread = (await getThread(created.antiga))!;
    expect(thread.status).toBe("waiting_customer");
    expect(thread.messages.at(-1)).toMatchObject({ author: "staff", staffName: "Marcello Teste", internal: false });
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: "ana@alfa.teste" });
    expect(mails[0].subject).toContain("Como pauso um aluno");
    expect(mails[0].text).toContain("Edite o aluno e mude a situação para Pausada.");
    expect(mails[0].text).toContain("Fale com a gente");

    const [audit] = await owner`select action, organization_id, target from platform.audit_logs where action = 'support.reply' and admin_id = ${admin.adminId}`;
    expect(audit).toMatchObject({ action: "support.reply", organization_id: orgA });
    expect(audit.target).toMatchObject({ threadId: created.antiga, emailed: true });
    // O texto da resposta nao vai para a auditoria.
    expect(JSON.stringify(audit.target)).not.toContain("Pausada");
    const [first] = await owner`select first_reply_at from platform.support_threads where id = ${created.antiga}`;
    expect(first.first_reply_at).not.toBeNull();
  });

  it("recusa mensagem vazia ou grande demais e conversa que não existe", async () => {
    const admin = await createAdminUser("platform_owner");
    admins.push(admin);
    await signInAdmin(admin);
    const { replyAction } = await import("./actions");
    expect((await replyAction({}, form({ threadId: created.urgente, body: "   " }))).error).toBe("Escreva a mensagem.");
    expect((await replyAction({}, form({ threadId: created.urgente, body: "x".repeat(4001) }))).error).toMatch(/4000/);
    expect((await replyAction({}, form({ threadId: crypto.randomUUID(), body: "oi" }))).error).toBe("Conversa não encontrada.");
    expect((await replyAction({}, form({ threadId: "não-é-id", body: "oi" }))).error).toBeTruthy();
  });

  it("nota interna fica só no painel e não muda a situação", async () => {
    const admin = await createAdminUser("platform_support", "Atendente Teste");
    admins.push(admin);
    await signInAdmin(admin);
    const { noteAction } = await import("./actions");
    const before = (await (await import("@/lib/server/support")).getThread(created.urgente))!.status;
    expect(await noteAction({}, form({ threadId: created.urgente, body: "Cliente já mandou o comprovante." }))).toEqual({ ok: true });
    const thread = (await (await import("@/lib/server/support")).getThread(created.urgente))!;
    expect(thread.status).toBe(before);
    expect(thread.messages.at(-1)).toMatchObject({ internal: true, body: "Cliente já mandou o comprovante." });
    // A funcao do app dos clientes nao devolve notas internas.
    const rows = await owner`select body from public.support_thread_messages(${orgB}, ${"user-Bia Beta"}, ${created.urgente}, false)`;
    expect(rows.map((r) => r.body)).not.toContain("Cliente já mandou o comprovante.");
  });

  it("encerrar, reabrir e a marca de urgente, cada um com seu registro", async () => {
    const admin = await createAdminUser("platform_owner");
    admins.push(admin);
    await signInAdmin(admin);
    const { resolveAction, reopenAction, urgentAction } = await import("./actions");
    const { getThread } = await import("@/lib/server/support");

    await resolveAction(form({ threadId: created.urgente }));
    let thread = (await getThread(created.urgente))!;
    expect(thread).toMatchObject({ status: "resolved", urgent: false });

    await reopenAction(form({ threadId: created.urgente }));
    expect((await getThread(created.urgente))!.status).toBe("waiting_us");

    await urgentAction(form({ threadId: created.urgente, urgent: "1" }));
    expect((await getThread(created.urgente))!.urgent).toBe(true);
    await urgentAction(form({ threadId: created.urgente, urgent: "0" }));
    expect((await getThread(created.urgente))!.urgent).toBe(false);

    const actions = await owner<{ action: string }[]>`select action from platform.audit_logs where admin_id = ${admin.adminId} order by created_at`;
    expect(actions.map((a) => a.action)).toEqual(expect.arrayContaining(["support.resolve", "support.reopen", "support.mark_urgent", "support.unmark_urgent"]));
    thread = (await getThread(created.urgente))!;
    expect(thread.status).toBe("waiting_us");
  });

  it("respostas prontas: criar, editar e excluir", async () => {
    const admin = await createAdminUser("platform_owner");
    admins.push(admin);
    await signInAdmin(admin);
    const { saveMacroAction, deleteMacroAction } = await import("./actions");
    const { listMacros } = await import("@/lib/server/support");
    expect(await saveMacroAction({}, form({ title: "Teste Boas-vindas", body: "Oi! Como posso ajudar?" }))).toEqual({ ok: true });
    const macro = (await listMacros()).find((m) => m.title === "Teste Boas-vindas")!;
    expect(macro.body).toBe("Oi! Como posso ajudar?");
    await saveMacroAction({}, form({ id: macro.id, title: "Teste Boas-vindas", body: "Oi de novo!" }));
    expect((await listMacros()).find((m) => m.id === macro.id)!.body).toBe("Oi de novo!");
    expect((await saveMacroAction({}, form({ title: "x", body: "texto" }))).error).toMatch(/título/i);
    await deleteMacroAction(form({ id: macro.id }));
    expect((await listMacros()).some((m) => m.id === macro.id)).toBe(false);
  });
});

describe("papéis", () => {
  it("leitura (só números e saúde) não abre o suporte nem responde; suporte responde", async () => {
    const viewer = await createAdminUser("platform_viewer");
    const support = await createAdminUser("platform_support");
    admins.push(viewer, support);

    await signInAdmin(viewer);
    const { requireAdmin } = await import("@/lib/server/context");
    expect(await redirectedTo(() => requireAdmin("support:view"))).toBe("/?denied=1");
    const { replyAction } = await import("./actions");
    expect(await redirectedTo(() => replyAction({}, form({ threadId: created.urgente, body: "tentativa" })))).toBe("/?denied=1");
    const { getThread } = await import("@/lib/server/support");
    expect((await getThread(created.urgente))!.messages.some((m) => m.body === "tentativa")).toBe(false);

    vi.resetModules();
    await signInAdmin(support);
    const again = await import("./actions");
    expect(await again.replyAction({}, form({ threadId: created.urgente, body: "Já estamos vendo." }))).toEqual({ ok: true });
  });

  it("o financeiro não abre o Suporte", async () => {
    const finance = await createAdminUser("platform_finance");
    admins.push(finance);
    await signInAdmin(finance);
    const { requireAdmin } = await import("@/lib/server/context");
    expect(await redirectedTo(() => requireAdmin("support:view"))).toBe("/?denied=1");
  });
});

describe("resumo diário", () => {
  const cronUrl = "http://localhost:3001/api/cron/digest";

  it("recusa sem o segredo ou com segredo errado", async () => {
    const { GET } = await import("@/app/api/cron/digest/route");
    const { NextRequest } = await import("next/server");
    expect((await GET(new NextRequest(cronUrl))).status).toBe(401);
    expect((await GET(new NextRequest(cronUrl, { headers: { authorization: "Bearer errado" } }))).status).toBe(401);
  });

  it("com o segredo certo, envia o resumo a quem recebe os avisos", async () => {
    vi.stubEnv("MAILERSEND_API_KEY", "chave-de-teste");
    vi.stubEnv("ADMIN_NOTIFY_EMAIL", "suporte@gestarahub.teste");
    await owner`update platform.support_threads set status = 'waiting_us' where id = ${created.antiga}`;
    stubMailerSend();
    const { GET } = await import("@/app/api/cron/digest/route");
    const { NextRequest } = await import("next/server");
    const response = await GET(new NextRequest(cronUrl, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
    expect(await response.json()).toMatchObject({ ok: true, sent: true });
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("suporte@gestarahub.teste");
    expect(mails[0].subject).toContain("Suporte GestaraHub:");
    expect(mails[0].text).toContain("/support");
  });
});
