import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { jar, redirectedTo } from "@/test/next-mocks";
import { cleanupAdmins, createAdminUser, signInAdmin, type TestAdmin } from "@/test/admin-session";
import { authAdmin, ownerSql, panelSql, TEST_PASSWORD, uniqueEmail } from "@/test/local";

vi.mock("next/headers", async () => (await import("@/test/next-mocks")).headersMock());
vi.mock("next/navigation", async () => (await import("@/test/next-mocks")).navigationMock());
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * Espacos e Saude no Supabase local (doc technical/26, fases 2 e 4): lista e
 * filtros, ficha, o que o painel NAO enxerga, anotacoes, exportacao sem dado
 * pessoal, erros (filtros, codigo, conhecido), rotinas e avisos do parceiro.
 */
const owner = ownerSql();
const panel = panelSql();
const admins: TestAdmin[] = [];
const authUsers: string[] = [];
const tag = crypto.randomUUID().slice(0, 6);
const org: Record<string, string> = {};
const dayOffset = (days: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + days * 86_400_000));

async function createOrg(key: string, name: string, extra: Record<string, unknown> = {}) {
  const [row] = await owner<{ id: string }[]>`
    insert into public.organizations (name, model, class_segment, subscription, status, gateway_status, created_at)
    values (${`${name} ${tag}`}, 'classes', ${(extra.area as string) ?? "martial_arts"}, ${owner.json((extra.subscription ?? { tier: "free" }) as never)},
            ${(extra.status as string) ?? "active"}, ${(extra.gateway as string) ?? null}, ${(extra.createdAt as Date) ?? new Date()})
    returning id`;
  org[key] = row.id;
  return row.id;
}

beforeAll(async () => {
  await createOrg("livre", "Academia Livre");
  await createOrg("pro", "Estúdio Pro", { area: "pilates_yoga", subscription: { tier: "pro", interval: "monthly", renewsOn: dayOffset(10), priceCents: 7990 }, gateway: "approved" });
  await createOrg("carencia", "Dojo Carência", { subscription: { tier: "pro", interval: "monthly", renewsOn: dayOffset(-2) } });
  await createOrg("revertido", "Box Revertido", { subscription: { tier: "free", revertedFrom: { tier: "pro", on: dayOffset(-20) } } });
  await createOrg("troca", "Casa Troca", { subscription: { tier: "pro", interval: "monthly", renewsOn: dayOffset(5), scheduledChange: { tier: "free", effectiveOn: dayOffset(5) } } });
  await createOrg("cortesia", "Clube Cortesia", { subscription: { tier: "pro", interval: "monthly", courtesyUntil: dayOffset(20) } });
  await createOrg("inativo", "Oficina Inativa", { status: "inactive" });
  await createOrg("velho", "Escola Antiga", { createdAt: new Date(Date.now() - 90 * 86_400_000) });

  // Dono com login (acesso recente) no espaco pro; aluno e erro no livre.
  const email = uniqueEmail("dono");
  const { data } = await authAdmin().auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
  authUsers.push(data.user!.id);
  await owner`insert into public.users (id, auth_user_id, organization_id, name, email, profile) values (${crypto.randomUUID()}, ${data.user!.id}, ${org.pro}, 'Rita Dona do Pro', ${email}, 'owner')`;
  await authAdmin().auth.signInWithPassword?.({ email, password: TEST_PASSWORD }).catch(() => undefined);
  await owner`update auth.users set last_sign_in_at = now() where id = ${data.user!.id}`;
  await owner`insert into public.clients (id, organization_id, name, phone, status) values (${crypto.randomUUID()}, ${org.livre}, 'Aluno Sigiloso Um', '11999990001', 'active'), (${crypto.randomUUID()}, ${org.livre}, 'Aluno Sigiloso Dois', '11999990002', 'active'), (${crypto.randomUUID()}, ${org.livre}, 'Aluno Inativo', '11999990003', 'inactive')`;
  await owner`insert into public.subscription_events (organization_id, kind, tier_before, tier_after, interval_after, amount_cents, actor, source)
              values (${org.pro}, 'activated', 'free', 'pro', 'monthly', 7990, ${owner.json({ name: "Rita Dona do Pro" })}, null)`;
  // Erros: um do espaco livre (com codigo), um sem espaco, um antigo.
  await owner`insert into public.error_logs (organization_id, fingerprint, source, event, message, count, last_reference) values (${org.livre}, ${`fp-livre-${tag}`}, 'server', 'turmas.markAttendance', 'Falha ao marcar presença', 3, ${`ZZ${tag.toUpperCase()}1`})`;
  await owner`insert into public.error_logs (organization_id, fingerprint, source, level, event, message, count, last_reference) values (null, ${`fp-cron-${tag}`}, 'cron', 'warn', 'cron.daily', 'Rotina lenta', 1, ${`ZZ${tag.toUpperCase()}2`})`;
  await owner`insert into public.error_logs (organization_id, fingerprint, source, event, message, last_seen, last_reference) values (${org.pro}, ${`fp-antigo-${tag}`}, 'browser', 'browser.render', 'Erro antigo', now() - interval '10 days', ${`ZZ${tag.toUpperCase()}3`})`;
  await owner`insert into public.job_runs (job, started_at, finished_at, status, organizations, failures) values (${`teste_${tag}`}, now() - interval '2 minutes', now() - interval '1 minute', 'ok', 12, 0)`;
  await owner`insert into public.webhook_events (provider, event_id, event, organization_id, status, outcome) values ('asaas', ${`evt-${tag}-1`}, ${`PAYMENT_TESTE_${tag}`}, ${org.pro}, 'processed', 'ok'), ('asaas', ${`evt-${tag}-2`}, ${`PAYMENT_TESTE_${tag}`}, ${org.pro}, 'failed', 'erro')`;
});

afterAll(async () => {
  await owner`delete from platform.known_errors where fingerprint like ${`fp-%-${tag}`}`;
  await owner`delete from public.error_logs where fingerprint like ${`fp-%-${tag}`}`;
  await owner`delete from public.job_runs where job = ${`teste_${tag}`}`;
  await owner`delete from public.webhook_events where event_id like ${`evt-${tag}-%`}`;
  await owner`delete from public.organizations where id = any(${Object.values(org)})`;
  await cleanupAdmins(admins);
  for (const id of authUsers) await authAdmin().auth.admin.deleteUser(id);
  await owner.end();
  await panel.end();
});

beforeEach(() => {
  vi.resetModules();
  jar.clear();
});

const names = async (filters: Partial<import("@/lib/server/spaces").SpaceFilters>) => {
  const { listSpaces } = await import("@/lib/server/spaces");
  const { rows } = await listSpaces({ q: tag, page: 1, ...filters });
  return rows.map((r) => r.name.replace(` ${tag}`, ""));
};

describe("lista de espaços", () => {
  it("busca por nome, código e e-mail do dono, e mostra os números", async () => {
    expect(await names({})).toHaveLength(8);
    expect(await names({ q: "Estúdio Pro" })).toEqual(["Estúdio Pro"]);
    expect(await names({ q: org.livre })).toEqual(["Academia Livre"]);
    expect(await names({ q: "rita dona" })).toEqual(["Estúdio Pro"]);
    const { listSpaces } = await import("@/lib/server/spaces");
    const livre = (await listSpaces({ q: "Academia Livre", page: 1 })).rows[0];
    expect(livre).toMatchObject({ studentsActive: 2, ownerName: null, errors24h: 1, status: "active" });
    const pro = (await listSpaces({ q: "Estúdio Pro", page: 1 })).rows[0];
    expect(pro.ownerName).toBe("Rita Dona do Pro");
    expect(pro.lastSignInAt).not.toBeNull();
  });

  it("filtra por plano, situação, área, criação e erros", async () => {
    expect(await names({ tier: "pro" })).toEqual(expect.arrayContaining(["Estúdio Pro", "Dojo Carência", "Casa Troca", "Clube Cortesia"]));
    expect(await names({ tier: "pro" })).not.toContain("Academia Livre");
    expect(await names({ situation: "grace" })).toEqual(["Dojo Carência"]);
    expect(await names({ situation: "reverted" })).toEqual(["Box Revertido"]);
    expect(await names({ situation: "scheduled" })).toEqual(["Casa Troca"]);
    expect(await names({ situation: "courtesy" })).toEqual(["Clube Cortesia"]);
    expect(await names({ situation: "inactive" })).toEqual(["Oficina Inativa"]);
    expect(await names({ situation: "paid" })).toHaveLength(4);
    expect(await names({ area: "pilates_yoga" })).toEqual(["Estúdio Pro"]);
    expect(await names({ createdWithin: 30 })).not.toContain("Escola Antiga");
    expect(await names({ situation: "errors_24h" })).toEqual(["Academia Livre"]);
    expect(await names({ situation: "no_online" })).not.toContain("Estúdio Pro");
    expect(await names({ situation: "no_access_30d" })).not.toContain("Estúdio Pro");
    expect(await names({ situation: "no_access_30d" })).toContain("Academia Livre");
  });

  it("ordena e pagina", async () => {
    expect((await names({ sort: "name" }))[0]).toBe("Academia Livre");
    expect((await names({ sort: "activity" }))[0]).toBe("Estúdio Pro");
    const { listSpaces, SPACES_PAGE_SIZE } = await import("@/lib/server/spaces");
    const all = await listSpaces({ page: 1 });
    expect(all.rows.length).toBeLessThanOrEqual(SPACES_PAGE_SIZE);
  });

  it("devolve o total filtrado e a página 2", async () => {
    const { listSpaces, SPACES_PAGE_SIZE } = await import("@/lib/server/spaces");
    const marker = `Paginado ${tag}`;
    const extra = await owner<{ id: string }[]>`
      insert into public.organizations (name, model, class_segment, subscription, status)
      select ${marker} || ' ' || lpad(g::text, 2, '0'), 'classes', 'martial_arts', ${owner.json({ tier: "free" } as never)}, 'active' from generate_series(1, 27) g
      returning id`;
    try {
      const first = await listSpaces({ q: marker, page: 1, sort: "name" });
      expect(first).toMatchObject({ total: 27, hasNext: true, page: 1 });
      expect(first.rows).toHaveLength(SPACES_PAGE_SIZE);
      const second = await listSpaces({ q: marker, page: 2, sort: "name" });
      expect(second).toMatchObject({ total: 27, hasNext: false, page: 2 });
      expect(second.rows).toHaveLength(2);
      const far = await listSpaces({ q: marker, page: 8, sort: "name" });
      expect(far).toMatchObject({ page: 2, total: 27 });
      const all = await listSpaces({ q: marker, page: 1 }, { all: true });
      expect(all.rows).toHaveLength(27);
      expect((await listSpaces({ q: `${marker} 05`, page: 1 })).total).toBe(1);
      expect((await listSpaces({ q: `nada-${tag}`, page: 3 }))).toMatchObject({ total: 0, page: 1, rows: [] });
    } finally {
      await owner`delete from public.organizations where id = any(${extra.map((r) => r.id)})`;
    }
  });

  it("caracteres do LIKE não viram curinga", async () => {
    expect(await names({ q: "%" })).toEqual([]);
  });
});

describe("o que o painel não enxerga", () => {
  it("nenhum dado de aluno nas visões, e nada de segredo do gateway", async () => {
    const { getSpace } = await import("@/lib/server/spaces");
    const space = (await getSpace(org.livre))!;
    expect(JSON.stringify(space)).not.toContain("Sigiloso");
    expect(space).toMatchObject({ studentsActive: 2, studentsTotal: 3 });
    const denied = async (statement: string) => expect(panel.unsafe(statement)).rejects.toMatchObject({ code: "42501" });
    await denied("select gateway_api_key from public.organizations");
    await denied("select gateway_account_id from public.organizations");
    await denied("select gateway_wallet_id from public.organizations");
    await denied("select * from public.organizations limit 1");
    await denied("select name from public.clients limit 1");
    await denied("select email from public.users limit 1");
    await expect(panel`select id, name, subscription, gateway_status from public.organizations limit 1`).resolves.toBeTruthy();
  });

  it("ficha de espaço que não existe devolve nada", async () => {
    const { getSpace } = await import("@/lib/server/spaces");
    expect(await getSpace("nao-existe")).toBeNull();
  });

  it("histórico do plano", async () => {
    const { listPlanEvents } = await import("@/lib/server/spaces");
    const events = await listPlanEvents(org.pro);
    expect(events[0]).toMatchObject({ kind: "activated", tierBefore: "free", tierAfter: "pro", amountCents: 7990, actorName: "Rita Dona do Pro" });
  });
});

describe("anotações e exportação", () => {
  const form = (values: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    return data;
  };

  it("anota, fixa e exclui, com registro; leitura só olha", async () => {
    const support = await createAdminUser("platform_support", "Atendente Notas");
    const viewer = await createAdminUser("platform_viewer");
    admins.push(support, viewer);
    await signInAdmin(support);
    const actions = await import("./[id]/actions");
    expect(await actions.addNoteAction({}, form({ spaceId: org.pro, body: "Pediu desconto em outubro" }))).toEqual({ ok: true });
    const { listSpaceNotes } = await import("@/lib/server/spaces");
    const [note] = await listSpaceNotes(org.pro);
    expect(note).toMatchObject({ body: "Pediu desconto em outubro", adminName: "Atendente Notas", pinned: false });
    await actions.pinNoteAction(form({ id: note.id, spaceId: org.pro, pinned: "1" }));
    expect((await listSpaceNotes(org.pro))[0].pinned).toBe(true);
    expect((await actions.addNoteAction({}, form({ spaceId: org.pro, body: "  " }))).error).toBe("Escreva a anotação.");
    expect((await actions.addNoteAction({}, form({ spaceId: "nao-existe", body: "x" }))).error).toBe("Espaço não encontrado.");
    await actions.deleteNoteAction(form({ id: note.id }));
    expect(await listSpaceNotes(org.pro)).toEqual([]);
    const audit = await owner<{ action: string }[]>`select action from platform.audit_logs where admin_id = ${support.adminId} and organization_id = ${org.pro}`;
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["space.note_add", "space.note_pin", "space.note_delete"]));

    vi.resetModules();
    await signInAdmin(viewer);
    const again = await import("./[id]/actions");
    expect(await redirectedTo(() => again.addNoteAction({}, form({ spaceId: org.pro, body: "tentativa" })))).toBe("/?denied=1");
  });

  it("CSV sem dado pessoal, com registro, e recusa quem não entrou", async () => {
    const { GET } = await import("./export/route");
    const { NextRequest } = await import("next/server");
    const url = `http://localhost:3001/spaces/export?q=${tag}`;
    expect((await GET(new NextRequest(url))).status).toBe(403);

    const admin = await createAdminUser("platform_finance", "Financeiro CSV");
    admins.push(admin);
    await signInAdmin(admin);
    vi.resetModules();
    const route = await import("./export/route");
    const response = await route.GET(new NextRequest(`${url}&tier=pro`));
    expect(response.headers.get("content-type")).toContain("text/csv");
    const csv = await response.text();
    const lines = csv.replace("﻿", "").trim().split("\n");
    expect(lines[0]).toContain('"Espaço"');
    expect(lines).toHaveLength(5);
    expect(csv).toContain("Estúdio Pro");
    expect(csv).not.toContain("Rita Dona do Pro");
    expect(csv).not.toContain("@");
    expect(csv).not.toContain("Sigiloso");
    const [row] = await owner`select target from platform.audit_logs where action = 'space.export' and admin_id = ${admin.adminId}`;
    expect(row.target).toMatchObject({ rows: 4 });
  });
});

describe("saúde", () => {
  it("lista erros com filtros, esconde os conhecidos e acha pelo código do cliente", async () => {
    const health = await import("@/lib/server/health");
    const mine = async (input: Partial<Parameters<typeof health.listErrors>[0]>) =>
      (await health.listErrors({ period: "24h", q: tag, page: 1, ...input })).rows.map((r) => r.fingerprint.replace(`-${tag}`, ""));
    // O texto do codigo e do fingerprint nao casa com `q`; busca pelo evento.
    const all = (await health.listErrors({ period: "30d", page: 1 })).rows.filter((r) => r.fingerprint.endsWith(tag));
    expect(all.map((r) => r.fingerprint.replace(`-${tag}`, "")).sort()).toEqual(["fp-antigo", "fp-cron", "fp-livre"]);
    const day = (await health.listErrors({ period: "24h", page: 1 })).rows.filter((r) => r.fingerprint.endsWith(tag));
    expect(day.map((r) => r.fingerprint.replace(`-${tag}`, "")).sort()).toEqual(["fp-cron", "fp-livre"]);
    expect((await health.listErrors({ period: "24h", source: "cron", page: 1 })).rows.some((r) => r.fingerprint === `fp-cron-${tag}`)).toBe(true);
    expect((await health.listErrors({ period: "24h", level: "warn", page: 1 })).rows.every((r) => r.level === "warn")).toBe(true);
    expect((await health.listErrors({ period: "24h", organizationId: org.livre, page: 1 })).rows.map((r) => r.fingerprint)).toEqual([`fp-livre-${tag}`]);
    // O texto não casa com evento nem mensagem, só com o nome do espaço (que leva a marca do teste).
    expect(await mine({})).toEqual(["fp-livre"]);

    const found = await health.findErrorByReference(`zz${tag}1`);
    expect(found).toMatchObject({ organizationId: org.livre, event: "turmas.markAttendance", count: 3 });
    expect(await health.findErrorByReference("NAOEXISTE")).toBeNull();
    const byCode = await health.listErrors({ period: "24h", q: `ZZ${tag.toUpperCase()}1`, page: 1 });
    expect(byCode.rows.map((r) => r.fingerprint)).toEqual([`fp-livre-${tag}`]);
  });

  it("detalhe do erro traz o contexto e as conversas com o código", async () => {
    const health = await import("@/lib/server/health");
    const code = `ZZ${tag.toUpperCase()}1`;
    const { id } = (await health.findErrorByReference(code))!;
    await owner`update public.error_logs set stack = 'Error: Falha ao marcar presença\n    at markAttendance', context = ${owner.json({ route: "/classes/x" })} where id = ${id}`;
    const [thread] = await owner<{ id: string }[]>`
      select public.support_open_thread(${org.livre}, 'user-detalhe', 'Pessoa', 'p@teste.com', null, 'Não consegui marcar a presença', 'Deu erro', '/classes/x', ${code}, 'free', 'bug') as id`;
    try {
      const detail = await health.getErrorDetail(id);
      expect(detail).toMatchObject({ event: "turmas.markAttendance", count: 3, context: { route: "/classes/x" } });
      expect(detail?.stack).toContain("markAttendance");
      expect(detail?.threads).toEqual([{ id: thread.id, subject: "Não consegui marcar a presença", status: "bot" }]);
    } finally {
      await owner`delete from platform.support_threads where id = ${thread.id}`;
    }
    expect(await health.getErrorDetail("00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(await health.getErrorDetail("não-é-id")).toBeNull();
  });

  it("marcar como conhecido esconde da lista, desmarcar volta, e fica registrado", async () => {
    const admin = await createAdminUser("platform_support", "Atendente Saúde");
    admins.push(admin);
    await signInAdmin(admin);
    const { markKnownAction, unmarkKnownAction } = await import("../health/actions");
    const health = await import("@/lib/server/health");
    const fp = `fp-livre-${tag}`;
    await markKnownAction(form({ fingerprint: fp }));
    const visible = async () => (await health.listErrors({ period: "24h", organizationId: org.livre, hideKnown: true, page: 1 })).rows.length;
    expect(await visible()).toBe(0);
    expect((await health.listErrors({ period: "24h", organizationId: org.livre, page: 1 })).rows[0].known).toBe(true);
    await unmarkKnownAction(form({ fingerprint: fp }));
    expect(await visible()).toBe(1);
    const audit = await owner<{ action: string }[]>`select action from platform.audit_logs where admin_id = ${admin.adminId}`;
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["health.error_known", "health.error_unknown"]));
    // Fingerprint curto demais e recusado em silencio.
    await markKnownAction(form({ fingerprint: "x" }));
    expect(await owner`select 1 from platform.known_errors where fingerprint = 'x'`).toHaveLength(0);
  });

  function form(values: Record<string, string>) {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    return data;
  }

  it("rotinas, avisos do parceiro e integrações", async () => {
    const health = await import("@/lib/server/health");
    const runs = await health.listJobRuns(50);
    expect(runs.find((r) => r.job === `teste_${tag}`)).toMatchObject({ status: "ok", organizations: 12, durationSeconds: 60 });
    expect((await health.lastRunPerJob()).some((j) => j.job === `teste_${tag}`)).toBe(true);

    const hooks = await health.listWebhooks({ organizationId: org.pro, page: 1 });
    expect(hooks.rows).toHaveLength(2);
    expect((await health.listWebhooks({ organizationId: org.pro, status: "failed", page: 1 })).rows).toHaveLength(1);
    expect((await health.webhookStats()).events).toContain(`PAYMENT_TESTE_${tag}`);
    const gateway = await health.gatewayOverview();
    expect(gateway.reduce((sum, g) => sum + g.count, 0)).toBeGreaterThanOrEqual(8);
    expect(gateway.find((g) => g.status === "approved")?.count).toBeGreaterThanOrEqual(1);
    expect((await health.errorTotals()).today).toBeGreaterThanOrEqual(2);
  });
});
