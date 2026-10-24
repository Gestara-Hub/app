import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { jar, redirectedTo } from "@/test/next-mocks";
import { cleanupAdmins, createAdminUser, signInAdmin, type TestAdmin } from "@/test/admin-session";
import { ownerSql, purgeAudit } from "@/test/local";

vi.mock("next/headers", async () => (await import("@/test/next-mocks")).headersMock());
vi.mock("next/navigation", async () => (await import("@/test/next-mocks")).navigationMock());
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * "Entrar como suporte" (doc technical/26, fase 8): visao somente leitura, com
 * motivo e 30 minutos, so totais (sem dado pessoal de aluno), registrada na
 * Auditoria do espaco e na do painel.
 */
const owner = ownerSql();
const admins: TestAdmin[] = [];
let orgId = "";
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

beforeAll(async () => {
  const [row] = await owner<{ id: string }[]>`insert into public.organizations (name, model, class_segment) values ('Visão de suporte Teste', 'classes', 'dance') returning id`;
  orgId = row.id;
  await owner`insert into public.clients (id, organization_id, name, phone, email, cpf, status) values ('cli-vs-1', ${orgId}, 'Aluno Secreto Silva', '11999990000', 'secreto@aluno.teste', '12345678909', 'active')`;
});

afterAll(async () => {
  await purgeAudit(owner, admins.map((a) => a.adminId), `organization_id = '${orgId}'`);
  await owner`delete from public.audit_logs where organization_id = ${orgId}`.catch(() => undefined);
  await owner`delete from public.clients where organization_id = ${orgId}`;
  await owner`delete from public.organizations where id = ${orgId}`;
  await cleanupAdmins(admins);
  await owner.end();
});

beforeEach(() => {
  vi.resetModules();
  jar.clear();
});

async function as(role: string, name: string) {
  const admin = await createAdminUser(role, name);
  admins.push(admin);
  await signInAdmin(admin);
  return admin;
}

describe("visão de suporte", () => {
  it("abre com motivo, mostra só totais e registra nos dois lugares", async () => {
    const admin = await as("platform_support", "Suporte Visão");
    const actions = await import("./actions");
    expect(await actions.startAccessAction({}, form({ spaceId: orgId, reason: "abc" }))).toEqual({ error: "Diga o motivo (pelo menos 5 letras)." });
    const url = await redirectedTo(() => actions.startAccessAction({}, form({ spaceId: orgId, reason: "Dono não consegue cobrar" })));
    expect(url).toMatch(/^\/support-view\/[0-9a-f-]{36}$/);
    const sessionId = url!.split("/").pop()!;

    const { loadSnapshot } = await import("@/lib/server/support-access");
    const snapshot = await loadSnapshot(sessionId, admin.adminId);
    expect(snapshot.space.name).toBe("Visão de suporte Teste");
    expect(snapshot.students).toEqual({ active: 1 });
    const text = JSON.stringify(snapshot);
    for (const secret of ["Aluno Secreto", "11999990000", "secreto@aluno.teste", "12345678909"]) expect(text).not.toContain(secret);

    expect(await owner`select 1 from platform.audit_logs where action = 'support_access.start' and organization_id = ${orgId}`).toHaveLength(1);
    expect(await owner`select 1 from public.audit_logs where organization_id = ${orgId} and source = 'platform' and summary like '%visão de suporte%'`).toHaveLength(1);
  });

  it("vale só para quem abriu, termina ao encerrar e ao expirar", async () => {
    const first = await as("platform_support", "Suporte Dono da Visão");
    const actions = await import("./actions");
    const url = await redirectedTo(() => actions.startAccessAction({}, form({ spaceId: orgId, reason: "Conferir configuração" })));
    const sessionId = url!.split("/").pop()!;
    const { loadSnapshot } = await import("@/lib/server/support-access");
    const other = await createAdminUser("platform_owner", "Outro Admin");
    admins.push(other);
    await expect(loadSnapshot(sessionId, other.adminId)).rejects.toThrow("terminou");

    // Expirada
    await owner`update platform.support_access_sessions set expires_at = now() - interval '1 minute' where id = ${sessionId}`;
    await expect(loadSnapshot(sessionId, first.adminId)).rejects.toThrow("terminou");

    // Encerrar registra
    const again = await redirectedTo(() => actions.startAccessAction({}, form({ spaceId: orgId, reason: "Segunda conferência" })));
    const secondId = again!.split("/").pop()!;
    await redirectedTo(() => actions.endAccessAction(form({ sessionId: secondId, spaceId: orgId })));
    await expect(loadSnapshot(secondId, first.adminId)).rejects.toThrow("terminou");
    expect(await owner`select 1 from platform.audit_logs where action = 'support_access.end' and organization_id = ${orgId}`).toHaveLength(1);
  });

  it("papel sem acesso (financeiro, leitura) não abre", async () => {
    await as("platform_finance", "Financeiro Visão");
    const actions = await import("./actions");
    await expect(actions.startAccessAction({}, form({ spaceId: orgId, reason: "Tentativa indevida" }))).rejects.toBeDefined();
  });
});
