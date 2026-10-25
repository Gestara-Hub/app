import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { jar } from "@/test/next-mocks";
import { cleanupAdmins, createAdminUser, type TestAdmin } from "@/test/admin-session";
import { ownerSql } from "@/test/local";

vi.mock("next/headers", async () => (await import("@/test/next-mocks")).headersMock());
vi.mock("next/navigation", async () => (await import("@/test/next-mocks")).navigationMock());
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/** Filtros e total da auditoria no Supabase local: busca, pessoa, espaço, período e página. */
const owner = ownerSql();
const tag = crypto.randomUUID().slice(0, 6);
const admins: TestAdmin[] = [];
let ana: TestAdmin;
let beto: TestAdmin;
let spaceId = "";

beforeAll(async () => {
  ana = await createAdminUser("platform_owner", `Ana ${tag}`);
  beto = await createAdminUser("platform_support", `Beto ${tag}`);
  admins.push(ana, beto);
  const [space] = await owner<{ id: string }[]>`insert into public.organizations (name, model, class_segment, subscription, status) values (${`Espaço Auditado ${tag}`}, 'classes', 'martial_arts', ${owner.json({ tier: "free" } as never)}, 'active') returning id`;
  spaceId = space.id;
  // 27 registros da Ana, um por minuto, e dois do Beto (um antigo, um num espaço).
  await owner`
    insert into platform.audit_logs (admin_id, admin_name, action, reason, created_at)
    select ${ana.adminId}, ${ana.name}, 'admin.invited', ${`lote ${tag}`}, now() - make_interval(secs => g * 60) from generate_series(1, 27) g`;
  await owner`insert into platform.audit_logs (admin_id, admin_name, action, reason, created_at) values (${beto.adminId}, ${beto.name}, 'support.reply', ${`antigo ${tag}`}, now() - interval '40 days')`;
  await owner`insert into platform.audit_logs (admin_id, admin_name, action, organization_id, reason, created_at) values (${beto.adminId}, ${beto.name}, 'space.note_add', ${spaceId}, ${`nota ${tag}`}, now() - interval '2 hours')`;
});

afterAll(async () => {
  await cleanupAdmins(admins);
  await owner`delete from public.organizations where id = ${spaceId}`;
  await owner.end();
});

beforeEach(() => {
  vi.resetModules();
  jar.clear();
});

const list = async (query: Partial<import("@/lib/server/audit-log").AuditQuery>) => {
  const { listAudit } = await import("@/lib/server/audit-log");
  return listAudit({ group: "all", q: tag, page: 1, ...query });
};

describe("auditoria: filtros e total", () => {
  it("devolve o total filtrado e pagina em 25", async () => {
    const first = await list({});
    expect(first.total).toBe(29);
    expect(first.rows).toHaveLength(25);
    const second = await list({ page: 2 });
    expect(second.rows).toHaveLength(4);
    expect(second.total).toBe(29);
  });

  it("página acima do total mostra a última que existe", async () => {
    const far = await list({ page: 9 });
    expect(far.page).toBe(2);
    expect(far.rows).toHaveLength(4);
    const none = await list({ q: `nada-${tag}`, page: 5 });
    expect(none).toMatchObject({ total: 0, page: 1, rows: [] });
  });

  it("busca por pessoa, motivo, espaço e rótulo da ação", async () => {
    expect((await list({ q: `Beto ${tag}` })).total).toBe(2);
    expect((await list({ q: `antigo ${tag}` })).total).toBe(1);
    expect((await list({ q: `Espaço Auditado ${tag}` })).total).toBe(1);
    // "convidou" acha admin.invited pelo rótulo; a pessoa limita a busca aos registros do teste.
    expect((await list({ q: "convidou", admin: ana.adminId })).total).toBe(27);
    expect((await list({ q: "respondeu uma conversa", admin: beto.adminId })).total).toBe(1);
    expect((await list({ q: "%" })).total).toBe(0);
  });

  it("filtra por pessoa, espaço e grupo", async () => {
    expect((await list({ admin: ana.adminId })).total).toBe(27);
    const bySpace = await list({ q: undefined, space: spaceId });
    expect(bySpace.total).toBe(1);
    expect(bySpace.rows[0]).toMatchObject({ organization_id: spaceId, organization_name: `Espaço Auditado ${tag}` });
    expect((await list({ admin: beto.adminId, group: "support" })).total).toBe(1);
    expect((await list({ admin: beto.adminId, group: "plan" })).total).toBe(0);
  });

  it("filtra por período em dias de Brasília", async () => {
    const { auditRange } = await import("@/lib/audit-filters");
    const month = auditRange({ period: "30" });
    expect((await list({ from: month.from, to: month.to })).total).toBe(28);
    const old = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() - 40 * 86_400_000));
    expect((await list({ from: old, to: old })).total).toBe(1);
    expect((await list({ to: old })).total).toBe(1);
    const { listAuditAdmins } = await import("@/lib/server/audit-log");
    expect((await listAuditAdmins()).map((a) => a.id)).toEqual(expect.arrayContaining([ana.adminId, beto.adminId]));
  });
});
