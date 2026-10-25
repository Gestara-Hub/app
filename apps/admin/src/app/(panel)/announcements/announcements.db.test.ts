import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { jar } from "@/test/next-mocks";
import { cleanupAdmins, createAdminUser, signInAdmin, type TestAdmin } from "@/test/admin-session";
import { ownerSql } from "@/test/local";

vi.mock("next/headers", async () => (await import("@/test/next-mocks")).headersMock());
vi.mock("next/navigation", async () => (await import("@/test/next-mocks")).navigationMock());
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * Comunicados (doc technical/26, fase 5): quem recebe (todos, plano, area,
 * espacos), vigencia, dispensa por pessoa, permissao por papel e auditoria.
 */
const owner = ownerSql();
const admins: TestAdmin[] = [];
const org: Record<string, string> = {};
const titles = new Set<string>();
const form = (values: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) for (const v of Array.isArray(value) ? value : [value]) data.append(key, v);
  return data;
};
const forOrg = async (key: string, user = "pessoa-1") =>
  (await owner<{ title: string }[]>`select title from public.announcements_for(${org[key]}, ${user})`).map((r) => r.title).filter((t) => titles.has(t));

beforeAll(async () => {
  const make = async (key: string, tier: string, area: string) => {
    const [row] = await owner<{ id: string }[]>`
      insert into public.organizations (name, model, class_segment, subscription) values (${`Comunicado ${key}`}, 'classes', ${area}, ${owner.json({ tier } as never)}) returning id`;
    org[key] = row.id;
  };
  await make("livre-danca", "free", "dance");
  await make("pro-lutas", "pro", "martial_arts");
});

afterAll(async () => {
  await owner`delete from platform.announcements where title = any(${[...titles]})`;
  await owner`delete from public.organizations where id = any(${Object.values(org)})`;
  await cleanupAdmins(admins);
  await owner.end();
});

beforeEach(() => {
  vi.resetModules();
  jar.clear();
});

async function asOwner() {
  const admin = await createAdminUser("platform_owner", "Dono Comunicados");
  admins.push(admin);
  await signInAdmin(admin);
  return await import("./actions");
}

async function publish(actions: Awaited<ReturnType<typeof asOwner>>, values: Record<string, string | string[]>) {
  titles.add(String(values.title));
  const base = { body: "Mensagem de teste", severity: "info", audience: "all", spaces: "", startsAt: "", endsAt: "" };
  // O sucesso redireciona (mock lanca); um erro volta como valor.
  return actions.saveAnnouncementAction({}, form({ ...base, ...values })).catch((e: unknown) => ({ redirect: String(e) }));
}

describe("comunicados", () => {
  it("publica para todos e cada espaço enxerga; dispensa vale só para a pessoa", async () => {
    const actions = await asOwner();
    await publish(actions, { title: "Aviso geral" });
    expect(await forOrg("livre-danca")).toContain("Aviso geral");
    expect(await forOrg("pro-lutas")).toContain("Aviso geral");
    const [{ id }] = await owner<{ id: string }[]>`select id from platform.announcements where title = 'Aviso geral'`;
    await owner`select public.announcement_dismiss(${org["livre-danca"]}, 'pessoa-1', ${id})`;
    expect(await forOrg("livre-danca", "pessoa-1")).not.toContain("Aviso geral");
    expect(await forOrg("livre-danca", "pessoa-2")).toContain("Aviso geral");
  });

  it("filtra por plano e por área", async () => {
    const actions = await asOwner();
    await publish(actions, { title: "So Pro", audience: "tier", tiers: ["pro"] });
    await publish(actions, { title: "So danca", audience: "area", areas: ["dance"] });
    const free = await forOrg("livre-danca");
    const pro = await forOrg("pro-lutas");
    expect(free).toContain("So danca");
    expect(free).not.toContain("So Pro");
    expect(pro).toContain("So Pro");
    expect(pro).not.toContain("So danca");
  });

  it("filtra por espaços escolhidos e conta quantos recebem", async () => {
    const actions = await asOwner();
    await publish(actions, { title: "So um espaco", audience: "spaces", spaces: org["pro-lutas"] });
    expect(await forOrg("pro-lutas")).toContain("So um espaco");
    expect(await forOrg("livre-danca")).not.toContain("So um espaco");
    const preview = await actions.previewAudienceAction({}, form({ title: "x y z", body: "abc", severity: "info", audience: "spaces", spaces: org["pro-lutas"], startsAt: "", endsAt: "" }));
    expect(preview.preview).toBe("1 espaço receberá este comunicado.");
  });

  it("respeita agendamento, fim e arquivo", async () => {
    const actions = await asOwner();
    await publish(actions, { title: "Futuro", startsAt: "2099-01-01T10:00" });
    await publish(actions, { title: "Passado", startsAt: "2020-01-01T10:00", endsAt: "2020-01-02T10:00" });
    await publish(actions, { title: "Arquivado" });
    const visible = await forOrg("livre-danca");
    expect(visible).not.toContain("Futuro");
    expect(visible).not.toContain("Passado");
    const [{ id }] = await owner<{ id: string }[]>`select id from platform.announcements where title = 'Arquivado'`;
    await actions.archiveAnnouncementAction(form({ id, archive: "1" }));
    expect(await forOrg("livre-danca")).not.toContain("Arquivado");
    await actions.archiveAnnouncementAction(form({ id, archive: "0" }));
    expect(await forOrg("livre-danca")).toContain("Arquivado");
  });

  it("recusa dados inválidos e registra a auditoria", async () => {
    const actions = await asOwner();
    expect(await publish(actions, { title: "ab" })).toMatchObject({ error: expect.stringContaining("título") });
    expect(await publish(actions, { title: "Sem plano", audience: "tier" })).toMatchObject({ error: "Escolha ao menos um plano." });
    expect(await publish(actions, { title: "Fim antes", startsAt: "2030-01-02T10:00", endsAt: "2030-01-01T10:00" })).toMatchObject({ error: "O fim precisa ser depois do início." });
    await publish(actions, { title: "Auditado" });
    const rows = await owner`select 1 from platform.audit_logs where action = 'announcement.create' and target->>'title' = 'Auditado'`;
    expect(rows).toHaveLength(1);
    await owner`delete from platform.audit_logs where action like 'announcement.%' and target->>'title' = any(${[...titles]})`.catch(() => undefined);
  });

  it("quem não gerencia comunicados não entra", async () => {
    const viewer = await createAdminUser("platform_viewer", "Leitor Comunicados");
    admins.push(viewer);
    await signInAdmin(viewer);
    const actions = await import("./actions");
    await expect(actions.saveAnnouncementAction({}, form({ title: "Indevido", body: "abc", severity: "info", audience: "all", spaces: "", startsAt: "", endsAt: "" }))).rejects.toBeDefined();
    expect(await owner`select 1 from platform.announcements where title = 'Indevido'`).toHaveLength(0);
  });
});

describe("lista de comunicados: total, página, busca, importância e público", () => {
  const mark = `PgCom${Date.now().toString(36)}`;
  beforeAll(async () => {
    // 27 no ar (os 4 últimos urgentes, 3 para um plano), 1 arquivado e 1 agendado.
    for (let i = 1; i <= 29; i++) {
      const title = `${mark} ${String(i).padStart(2, "0")}`;
      titles.add(title);
      const severity = i > 23 && i <= 27 ? "urgent" : i > 20 && i <= 23 ? "warning" : "info";
      const audience = i <= 3 ? "tier" : "all";
      await owner`
        insert into platform.announcements (title, body, severity, audience, audience_filter, starts_at, archived_at, created_at, created_by_name)
        values (${title}, 'Corpo de teste', ${severity}, ${audience}, ${owner.json((audience === "tier" ? { tiers: ["pro"] } : {}) as never)},
                ${i === 29 ? new Date("2099-01-01") : new Date("2020-01-01")}, ${i === 28 ? new Date() : null}, now() + make_interval(mins => ${i}::int), 'Teste')`;
    }
  });

  it("pagina com total, do mais recente ao mais antigo, e limita a página", async () => {
    const { listAnnouncementsPage } = await import("@/lib/server/announcements");
    const first = await listAnnouncementsPage({ q: mark });
    expect(first.total).toBe(29);
    expect(first.rows).toHaveLength(25);
    expect(first.rows[0].title).toBe(`${mark} 29`);
    const second = await listAnnouncementsPage({ q: mark, page: 2 });
    expect(second.rows.map((r) => r.title)).toEqual([`${mark} 04`, `${mark} 03`, `${mark} 02`, `${mark} 01`]);
    expect((await listAnnouncementsPage({ q: mark, page: 50 })).page).toBe(2);
  });

  it("filtra por situação, importância, público e título, e conta por situação sobre o conjunto filtrado", async () => {
    const { listAnnouncementsPage } = await import("@/lib/server/announcements");
    const all = await listAnnouncementsPage({ q: mark });
    expect(all.counts).toMatchObject({ all: 29, active: 27, scheduled: 1, archived: 1, ended: 0 });
    const active = await listAnnouncementsPage({ q: mark, state: "active" });
    expect(active.total).toBe(27);
    expect(active.page).toBe(1);
    expect((await listAnnouncementsPage({ q: mark, state: "active", page: 2 })).rows).toHaveLength(2);
    const urgent = await listAnnouncementsPage({ q: mark, severity: "urgent" });
    expect(urgent.total).toBe(4);
    expect(urgent.counts.active).toBe(4);
    expect((await listAnnouncementsPage({ q: mark, severity: "warning" })).total).toBe(3);
    expect((await listAnnouncementsPage({ q: mark, audience: "tier" })).total).toBe(3);
    expect((await listAnnouncementsPage({ q: mark, audience: "tier", severity: "urgent" })).total).toBe(0);
    expect((await listAnnouncementsPage({ q: `${mark} 07` })).total).toBe(1);
    expect((await listAnnouncementsPage({ q: `${mark} %` })).total).toBe(0);
  });

  it("os totais gerais e a lista antiga seguem funcionando", async () => {
    const { announcementTotals, listAnnouncements } = await import("@/lib/server/announcements");
    const totals = await announcementTotals();
    expect(totals.active).toBeGreaterThanOrEqual(27);
    expect(totals.scheduled).toBeGreaterThanOrEqual(1);
    expect((await listAnnouncements()).length).toBeGreaterThan(0);
  });
});
