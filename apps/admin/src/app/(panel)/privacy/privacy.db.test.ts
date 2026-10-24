import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { jar } from "@/test/next-mocks";
import { cleanupAdmins, createAdminUser, signInAdmin, type TestAdmin } from "@/test/admin-session";
import { ownerSql, purgeAudit } from "@/test/local";

vi.mock("next/headers", async () => (await import("@/test/next-mocks")).headersMock());
vi.mock("next/navigation", async () => (await import("@/test/next-mocks")).navigationMock());
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * LGPD (doc technical/26, fase 6): pedidos do titular com prazo de 15 dias,
 * exportacao dos dados do espaco sem segredos, e inativar/reativar com registro
 * nos dois lugares. So o proprietario.
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
  const [row] = await owner<{ id: string }[]>`
    insert into public.organizations (name, model, gateway_api_key) values ('LGPD Teste', 'classes', 'chave-secreta-de-teste') returning id`;
  orgId = row.id;
});

afterAll(async () => {
  await owner`delete from platform.privacy_requests where requester_email like '%@lgpd.teste'`;
  await purgeAudit(owner, admins.map((a) => a.adminId), `organization_id = '${orgId}'`);
  await owner`delete from public.audit_logs where organization_id = ${orgId}`.catch(() => undefined);
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

describe("pedidos do titular", () => {
  it("registra com prazo de 15 dias, exige o que foi feito para concluir e não grava dados pessoais na auditoria", async () => {
    await as("platform_owner", "Dono LGPD");
    const actions = await import("../privacy/actions");
    const created = await actions.createRequestAction({}, form({ requesterName: "Titular Teste", requesterEmail: "titular@lgpd.teste", kind: "access", description: "Quero uma cópia dos meus dados.", spaceId: orgId }));
    expect(created.ok).toBe(true);
    const [req] = await owner<{ id: string; status: string; days: number }[]>`
      select id, status, round(extract(epoch from (due_at - received_at)) / 86400)::int as days from platform.privacy_requests where requester_email = 'titular@lgpd.teste'`;
    expect(req).toMatchObject({ status: "open", days: 15 });

    expect(await actions.updateRequestAction({}, form({ id: req.id, status: "done", resolution: "" }))).toEqual({ error: "Descreva o que foi feito para concluir ou recusar." });
    expect(await actions.updateRequestAction({}, form({ id: req.id, status: "done", resolution: "Arquivo enviado ao titular." }))).toMatchObject({ ok: true });
    const [after] = await owner<{ status: string; closed_at: Date | null }[]>`select status, closed_at from platform.privacy_requests where id = ${req.id}`;
    expect(after.status).toBe("done");
    expect(after.closed_at).not.toBeNull();

    const audit = await owner<{ target: Record<string, unknown> }[]>`select target from platform.audit_logs where action = 'privacy.create' and organization_id = ${orgId}`;
    expect(JSON.stringify(audit)).not.toContain("titular@lgpd.teste");
    expect(JSON.stringify(audit)).not.toContain("Titular Teste");
  });

  it("recusa espaço inexistente e quem não é proprietário", async () => {
    await as("platform_owner", "Dono LGPD 2");
    const actions = await import("../privacy/actions");
    expect(await actions.createRequestAction({}, form({ requesterName: "Alguém", requesterEmail: "alguem@lgpd.teste", kind: "other", description: "Pedido", spaceId: "00000000-0000-4000-8000-000000000000" }))).toEqual({
      error: "Espaço não encontrado. Confira o código.",
    });
    jar.clear();
    vi.resetModules();
    await as("platform_support", "Suporte LGPD");
    const other = await import("../privacy/actions");
    await expect(other.createRequestAction({}, form({ requesterName: "Alguém", requesterEmail: "alguem@lgpd.teste", kind: "other", description: "Pedido" }))).rejects.toBeDefined();
  });
});

describe("espaço", () => {
  it("exporta sem segredos e registra nos dois lugares", async () => {
    await as("platform_owner", "Dono Export");
    const { POST } = await import("../spaces/[id]/export/route");
    const call = (reason: string) => POST({ formData: async () => form({ reason }) } as unknown as Request, { params: Promise.resolve({ id: orgId }) });
    expect((await call("x")).status).toBe(400);
    const response = await call("Pedido de acesso do titular");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("chave-secreta-de-teste");
    const data = JSON.parse(text) as { organization: { id: string; gateway_api_key?: string }; users: unknown[] };
    expect(data.organization.id).toBe(orgId);
    expect(data.organization.gateway_api_key).toBeUndefined();
    expect(Array.isArray(data.users)).toBe(true);
    expect(await owner`select 1 from platform.audit_logs where action = 'space.data_export' and organization_id = ${orgId}`).toHaveLength(1);
    expect(await owner`select 1 from public.audit_logs where organization_id = ${orgId} and source = 'platform' and summary like '%exportou%'`).toHaveLength(1);
  });

  it("inativa e reativa com motivo, sem apagar nada", async () => {
    await as("platform_owner", "Dono Inativa");
    const actions = await import("../spaces/[id]/privacy-actions");
    expect(await actions.inactivateSpaceAction({}, form({ spaceId: orgId, reason: "abc" }))).toEqual({ error: "Diga o motivo (pelo menos 5 letras)." });
    expect(await actions.inactivateSpaceAction({}, form({ spaceId: orgId, reason: "Encerramento a pedido do dono" }))).toMatchObject({ ok: true });
    expect((await owner<{ status: string }[]>`select status from public.organizations where id = ${orgId}`)[0].status).toBe("inactive");
    expect(await actions.inactivateSpaceAction({}, form({ spaceId: orgId, reason: "Encerramento a pedido do dono" }))).toEqual({ error: "O espaço já está inativo." });
    expect(await actions.reactivateSpaceAction({}, form({ spaceId: orgId, reason: "O dono voltou a usar" }))).toMatchObject({ ok: true });
    expect((await owner<{ status: string }[]>`select status from public.organizations where id = ${orgId}`)[0].status).toBe("active");
    expect(await owner`select 1 from platform.audit_logs where organization_id = ${orgId} and action in ('space.inactivate', 'space.reactivate')`).toHaveLength(2);
  });

  it("suporte não exporta nem inativa", async () => {
    await as("platform_support", "Suporte Export");
    const actions = await import("../spaces/[id]/privacy-actions");
    await expect(actions.inactivateSpaceAction({}, form({ spaceId: orgId, reason: "Tentativa indevida" }))).rejects.toBeDefined();
    const { POST } = await import("../spaces/[id]/export/route");
    await expect(POST({ formData: async () => form({ reason: "Tentativa indevida" }) } as unknown as Request, { params: Promise.resolve({ id: orgId }) })).rejects.toBeDefined();
  });
});

describe("2FA de usuário de espaço", () => {
  it("reinicia o 2FA de uma pessoa: tira app e e-mail, limpa o que é nosso e registra nos dois lugares", async () => {
    const { authAdmin, anonClient, uniqueEmail, TEST_PASSWORD } = await import("@/test/local");
    const email = uniqueEmail("usuario2fa");
    const { data } = await authAdmin().auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true, app_metadata: { two_factor_email: true } });
    const authId = data.user!.id;
    await owner`insert into public.users (id, auth_user_id, organization_id, name, email, profile) values ('usr-2fa-1', ${authId}, ${orgId}, 'Pessoa Dois Fatores', ${email}, 'manager')`;
    await owner`insert into public.two_factor_recovery_codes (auth_user_id, code_hash) values (${authId}, 'h1'), (${authId}, 'h2')`;
    const client = anonClient();
    await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
    await client.auth.mfa.enroll({ factorType: "totp" });
    try {
      const admin = await as("platform_owner", "Dono 2FA Usuário");
      const { listSpaceUsers } = await import("@/lib/server/user-two-factor");
      const before = (await listSpaceUsers(orgId)).find((u) => u.userId === "usr-2fa-1")!;
      expect(before).toMatchObject({ email2fa: true, recoveryLeft: 2 });

      const actions = await import("../spaces/[id]/privacy-actions");
      expect(await actions.resetUserTwoFactorAction({}, form({ spaceId: orgId, userId: "", reason: "Perdeu o celular" }))).toEqual({ error: "Escolha a pessoa." });
      const result = await actions.resetUserTwoFactorAction({}, form({ spaceId: orgId, userId: "usr-2fa-1", reason: "Perdeu o celular, confirmado pelo suporte" }));
      expect(result).toMatchObject({ ok: true });

      const { data: user } = await authAdmin().auth.admin.getUserById(authId);
      expect(user.user?.app_metadata?.two_factor_email).toBe(false);
      expect((await authAdmin().auth.admin.mfa.listFactors({ userId: authId })).data?.factors).toHaveLength(0);
      expect((await owner`select 1 from public.two_factor_recovery_codes where auth_user_id = ${authId}`).length).toBe(0);
      expect(await owner`select 1 from platform.audit_logs where action = 'space.user_two_factor_reset' and organization_id = ${orgId} and admin_id = ${admin.adminId}`).toHaveLength(1);
      expect(await owner`select 1 from public.audit_logs where organization_id = ${orgId} and source = 'platform' and summary like '%reiniciou a verificação em duas etapas de Pessoa Dois Fatores%'`).toHaveLength(1);

      // Sem 2FA, nada a reiniciar.
      expect(await actions.resetUserTwoFactorAction({}, form({ spaceId: orgId, userId: "usr-2fa-1", reason: "Tentando de novo" }))).toEqual({ error: "Esta pessoa não usa a verificação em duas etapas." });
    } finally {
      await owner`delete from public.users where id = 'usr-2fa-1'`;
      await authAdmin().auth.admin.deleteUser(authId);
    }
  });

  it("suporte não reinicia o 2FA de usuário de espaço", async () => {
    await as("platform_support", "Suporte 2FA Usuário");
    const actions = await import("../spaces/[id]/privacy-actions");
    await expect(actions.resetUserTwoFactorAction({}, form({ spaceId: orgId, userId: "x", reason: "Tentativa indevida" }))).rejects.toBeDefined();
  });
});
