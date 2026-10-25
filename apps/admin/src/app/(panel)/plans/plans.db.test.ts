import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { jar, redirectedTo } from "@/test/next-mocks";
import { cleanupAdmins, createAdminUser, signInAdmin, type TestAdmin } from "@/test/admin-session";
import { ownerSql } from "@/test/local";

vi.mock("next/headers", async () => (await import("@/test/next-mocks")).headersMock());
vi.mock("next/navigation", async () => (await import("@/test/next-mocks")).navigationMock());
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * Planos pelo painel (doc technical/26, fase 3): cortesia, carencia e voltar ao
 * Gratis, com as regras do banco, o registro nos tres lugares (historico do plano,
 * Auditoria do espaco e auditoria do painel) e as permissoes por papel.
 */
const owner = ownerSql();
const admins: TestAdmin[] = [];
const org: Record<string, string> = {};
const day = (offset: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + offset * 86_400_000));
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

async function createOrg(key: string, subscription: Record<string, unknown>) {
  const [row] = await owner<{ id: string }[]>`
    insert into public.organizations (name, model, subscription) values (${`Plano ${key}`}, 'classes', ${owner.json(subscription as never)}) returning id`;
  org[key] = row.id;
}
const subscriptionOf = async (key: string) => (await owner<{ s: Record<string, unknown> }[]>`select subscription as s from public.organizations where id = ${org[key]}`)[0].s;

beforeAll(async () => {
  await createOrg("livre", { tier: "free" });
  await createOrg("atrasado", { tier: "pro", interval: "monthly", status: "active", renewsOn: day(-3), nextDueDate: day(-3), asaasSubscriptionId: "sub_teste", noticesSent: ["x"] });
  await createOrg("pago", { tier: "pro", interval: "monthly", status: "active", renewsOn: day(10), asaasSubscriptionId: "sub_teste2" });
  await createOrg("em-dia", { tier: "pro", interval: "monthly", status: "active", renewsOn: day(10) });
});

afterAll(async () => {
  await owner`delete from platform.plan_grants where organization_id = any(${Object.values(org)})`;
  await owner`delete from public.organizations where id = any(${Object.values(org)})`;
  await cleanupAdmins(admins);
  await owner.end();
});

beforeEach(() => {
  vi.resetModules();
  jar.clear();
});

describe("cortesia", () => {
  it("concede, registra nos três lugares e o espaço fica com fim marcado", async () => {
    const finance = await createAdminUser("platform_finance", "Financeiro Cortesia");
    admins.push(finance);
    await signInAdmin(finance);
    const { grantCourtesyAction } = await import("../spaces/[id]/plan-actions");
    const result = await grantCourtesyAction({}, form({ spaceId: org.livre, tier: "pro", days: "30", reason: "Piloto com a academia parceira" }));
    expect(result).toEqual({ ok: true, message: `Cortesia concedida até ${day(30).split("-").reverse().join("/")}.` });

    expect(await subscriptionOf("livre")).toMatchObject({
      tier: "pro",
      status: "active",
      courtesyUntil: day(30),
      scheduledChange: { tier: "free", effectiveOn: day(31) },
    });
    // 1) historico do plano (o dono ve)
    const [event] = await owner`select kind, tier_after, source, actor, audit_log_id from public.subscription_events where organization_id = ${org.livre}`;
    expect(event).toMatchObject({ kind: "courtesy_granted", tier_after: "pro", source: "platform" });
    expect(event.actor).toMatchObject({ name: "Suporte do GestaraHub" });
    // 2) Auditoria do espaco (so o dono ve)
    const [tenantAudit] = await owner`select summary, security, source from public.audit_logs where id = ${event.audit_log_id}`;
    expect(tenantAudit).toMatchObject({ security: true, source: "platform" });
    expect(tenantAudit.summary).toContain("Suporte do GestaraHub deu cortesia do Plano Profissional até");
    // 3) auditoria do painel (quem e por que)
    const [panelAudit] = await owner`select action, reason, admin_name, organization_id from platform.audit_logs where admin_id = ${finance.adminId} and action = 'plan.courtesy_grant'`;
    expect(panelAudit).toMatchObject({ action: "plan.courtesy_grant", reason: "Piloto com a academia parceira", admin_name: "Financeiro Cortesia", organization_id: org.livre });
    const [grant] = await owner`select kind, tier, days, ends_on::text as ends_on from platform.plan_grants where organization_id = ${org.livre}`;
    expect(grant).toMatchObject({ kind: "courtesy", tier: "pro", days: 30, ends_on: day(30) });
  });

  it("pedir de novo soma a partir do fim da cortesia atual", async () => {
    const admin = await createAdminUser("platform_owner");
    admins.push(admin);
    await signInAdmin(admin);
    const { grantCourtesyAction } = await import("../spaces/[id]/plan-actions");
    await grantCourtesyAction({}, form({ spaceId: org.livre, tier: "pro", days: "10", reason: "Estender a cortesia do piloto" }));
    expect((await subscriptionOf("livre")).courtesyUntil).toBe(day(40));
  });

  it("recusa dias fora da faixa, motivo curto, plano inválido, espaço pago e espaço inexistente", async () => {
    const admin = await createAdminUser("platform_owner");
    admins.push(admin);
    await signInAdmin(admin);
    const { grantCourtesyAction } = await import("../spaces/[id]/plan-actions");
    const attempt = (over: Record<string, string>) => grantCourtesyAction({}, form({ spaceId: org.livre, tier: "pro", days: "10", reason: "Motivo válido aqui", ...over }));
    expect((await attempt({ days: "0" })).error).toBe("De 1 a 365 dias.");
    expect((await attempt({ days: "366" })).error).toBe("De 1 a 365 dias.");
    expect((await attempt({ reason: "ok" })).error).toMatch(/motivo/i);
    expect((await attempt({ tier: "free" })).error).toBe("Escolha o plano.");
    expect((await attempt({ spaceId: "nao-existe" })).error).toBe("Espaço não encontrado.");
    expect((await attempt({ spaceId: org.pago })).error).toMatch(/assinatura paga/);
    expect((await subscriptionOf("pago")).courtesyUntil).toBeUndefined();
  });

  it("encerrar antes do fim volta ao Grátis, registra e marca a concessão como encerrada", async () => {
    const admin = await createAdminUser("platform_owner");
    admins.push(admin);
    await signInAdmin(admin);
    const { revokeCourtesyAction } = await import("../spaces/[id]/plan-actions");
    expect((await revokeCourtesyAction({}, form({ spaceId: org["em-dia"], reason: "Cliente pediu" }))).error).toMatch(/não está em cortesia/);
    expect((await revokeCourtesyAction({}, form({ spaceId: org.livre, reason: "Piloto acabou antes" }))).ok).toBe(true);
    expect(await subscriptionOf("livre")).toEqual(expect.objectContaining({ tier: "free" }));
    expect((await subscriptionOf("livre")).courtesyUntil).toBeUndefined();
    const [event] = await owner`select kind from public.subscription_events where organization_id = ${org.livre} order by created_at desc limit 1`;
    expect(event.kind).toBe("courtesy_revoked");
    const grants = await owner`select revoked_at, revoked_by_name from platform.plan_grants where organization_id = ${org.livre} and kind = 'courtesy'`;
    expect(grants.every((g) => g.revoked_at !== null)).toBe(true);
  });
});

describe("carência e voltar ao Grátis", () => {
  it("mais dias para pagar muda a renovação para hoje + N e limpa os avisos já enviados", async () => {
    const admin = await createAdminUser("platform_finance");
    admins.push(admin);
    await signInAdmin(admin);
    const { extendGraceAction } = await import("../spaces/[id]/plan-actions");
    expect((await extendGraceAction({}, form({ spaceId: org["em-dia"], days: "5", reason: "Pix fora do ar" }))).error).toMatch(/não está atrasada/);
    expect((await extendGraceAction({}, form({ spaceId: org.livre, days: "5", reason: "Pix fora do ar" }))).error).toMatch(/plano pago/);
    expect((await extendGraceAction({}, form({ spaceId: org.atrasado, days: "31", reason: "Pix fora do ar" }))).error).toBe("De 1 a 30 dias.");
    const ok = await extendGraceAction({}, form({ spaceId: org.atrasado, days: "7", reason: "Pix fora do ar" }));
    expect(ok.ok).toBe(true);
    const sub = await subscriptionOf("atrasado");
    expect(sub).toMatchObject({ tier: "pro", renewsOn: day(7), nextDueDate: day(7), asaasSubscriptionId: "sub_teste" });
    expect(sub.noticesSent).toBeUndefined();
    const [event] = await owner`select kind, details from public.subscription_events where organization_id = ${org.atrasado}`;
    expect(event).toMatchObject({ kind: "grace_extended" });
    expect(event.details).toMatchObject({ days: 7, to: day(7) });
  });

  it("voltar ao Grátis exige confirmar o parceiro quando há assinatura lá", async () => {
    const admin = await createAdminUser("platform_owner");
    admins.push(admin);
    await signInAdmin(admin);
    const { forceFreeAction } = await import("../spaces/[id]/plan-actions");
    expect((await forceFreeAction({}, form({ spaceId: org.pago, reason: "Abuso comprovado" }))).error).toMatch(/Cancele a assinatura no parceiro/);
    expect((await subscriptionOf("pago")).tier).toBe("pro");
    expect((await forceFreeAction({}, form({ spaceId: org.pago, partnerCanceled: "1", reason: "Abuso comprovado" }))).ok).toBe(true);
    expect((await subscriptionOf("pago")).tier).toBe("free");
    expect((await forceFreeAction({}, form({ spaceId: org.livre, reason: "Já está no Grátis" }))).error).toMatch(/já está no Grátis/);
    expect((await forceFreeAction({}, form({ spaceId: org["em-dia"], reason: "Sem parceiro envolvido" }))).ok).toBe(true);
  });
});

describe("permissões e visão geral", () => {
  it("só dono e financeiro concedem; suporte e leitura veem mas não mexem", async () => {
    const support = await createAdminUser("platform_support");
    const viewer = await createAdminUser("platform_viewer");
    admins.push(support, viewer);
    await signInAdmin(support);
    const { grantCourtesyAction } = await import("../spaces/[id]/plan-actions");
    const denied = form({ spaceId: org.livre, tier: "pro", days: "5", reason: "Tentativa sem permissão" });
    expect(await redirectedTo(() => grantCourtesyAction({}, denied))).toBe("/?denied=1");
    const { requireAdmin } = await import("@/lib/server/context");
    expect(await redirectedTo(() => requireAdmin("plans:view"))).toBe("/?denied=1");

    vi.resetModules();
    await signInAdmin(viewer);
    const again = await import("@/lib/server/context");
    expect(await redirectedTo(() => again.requireAdmin("plans:view"))).toBeUndefined();
    const actions = await import("../spaces/[id]/plan-actions");
    expect(await redirectedTo(() => actions.grantCourtesyAction({}, denied))).toBe("/?denied=1");
    expect((await subscriptionOf("livre")).courtesyUntil).toBeUndefined();
  });

  it("a visão de planos lista as cortesias ativas e as renovações atrasadas", async () => {
    const admin = await createAdminUser("platform_owner");
    admins.push(admin);
    await signInAdmin(admin);
    const { grantCourtesyAction } = await import("../spaces/[id]/plan-actions");
    await grantCourtesyAction({}, form({ spaceId: org.livre, tier: "pro", days: "15", reason: "Cortesia para a visão geral" }));
    await createOrg("vencido", { tier: "pro", interval: "monthly", status: "active", renewsOn: day(-9) });
    const plans = await import("@/lib/server/plans");
    expect((await plans.listGrants({ activeOnly: true })).map((g) => g.organizationId)).toContain(org.livre);
    expect((await plans.overdueSpaces()).map((s) => s.id)).toEqual(expect.arrayContaining([org.vencido]));
    const counts = await plans.tierCounts();
    expect(counts.some((c) => c.tier === "pro" && c.courtesy >= 1)).toBe(true);
  });

  it("o painel não executa as funções de plano direto sem o papel certo (a API não enxerga)", async () => {
    await expect(
      owner.begin(async (tx) => {
        await tx.unsafe("set local role authenticated");
        await tx.unsafe(`select platform.grant_courtesy('${org.livre}', 'pro', 5, 'tentativa de intruso', null, 'x', null, null)`);
      }),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      owner.begin(async (tx) => {
        await tx.unsafe("set local role service_role");
        await tx.unsafe(`select platform.force_free('${org.livre}', true, 'tentativa de intruso', null, 'x', null, null)`);
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("concessões: filtros e paginação", () => {
  it("filtra por tipo, busca pelo nome do espaço e pagina com o total", async () => {
    const plans = await import("@/lib/server/plans");
    const [row] = await owner<{ id: string }[]>`insert into public.organizations (name, model, subscription) values ('Estúdio Concede Muito', 'classes', ${owner.json({ tier: "free" } as never)}) returning id`;
    org.muito = row.id;
    await owner`
      insert into platform.plan_grants (organization_id, kind, tier, starts_on, ends_on, days, reason, granted_by_name)
      select ${row.id}, case when i <= 20 then 'courtesy' else 'grace' end, 'pro', platform.brasilia_today(), platform.brasilia_today() + 5, 5, 'Concessão de teste ' || i, 'Teste'
        from generate_series(1, 27) i`;
    const all = await plans.listGrantsPage({ q: "Concede Muito", page: 1 });
    expect(all.total).toBe(27);
    expect(all.rows).toHaveLength(25);
    expect(all.hasNext).toBe(true);
    const second = await plans.listGrantsPage({ q: "Concede Muito", page: 2 });
    expect(second.rows).toHaveLength(2);
    expect(await plans.listGrantsPage({ q: "Concede Muito", page: 50 })).toMatchObject({ page: 2, total: 27 });
    expect(await plans.listGrantsPage({ q: "Concede Muito", kind: "grace", page: 1 })).toMatchObject({ total: 7 });
    expect(await plans.listGrantsPage({ q: "Concede Muito", kind: "courtesy", page: 1 })).toMatchObject({ total: 20 });
    expect((await plans.listGrantsPage({ q: "Concede Muito", kind: "forced_free", page: 1 })).total).toBe(0);
    // O "%" do texto não vira curinga.
    expect((await plans.listGrantsPage({ q: "%", page: 1 })).total).toBe(0);
  });
});
