import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { jar, redirectedTo } from "@/test/next-mocks";
import { cleanupAdmins, createAdminUser, signInAdmin, type TestAdmin } from "@/test/admin-session";
import { authAdmin, ownerSql, purgeAudit, TEST_PASSWORD, uniqueEmail } from "@/test/local";

vi.mock("next/headers", async () => (await import("@/test/next-mocks")).headersMock());
vi.mock("next/navigation", async () => (await import("@/test/next-mocks")).navigationMock());
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * Equipe do painel (doc technical/26, fase 6): convite com link de uso unico,
 * aceite com senha, trancas (si mesmo, ultimo proprietario), desativar
 * (derruba o acesso) e reiniciar o 2FA. So o proprietario gerencia.
 */
const owner = ownerSql();
const admins: TestAdmin[] = [];
const invitedEmails: string[] = [];
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

afterAll(async () => {
  const rows = await owner<{ id: string; auth_user_id: string }[]>`select id, auth_user_id from platform.admins where email = any(${invitedEmails})`;
  await purgeAudit(owner, rows.map((r) => r.id), "action like 'admin.%' or action like 'auth.%'");
  await owner`delete from platform.admins where email = any(${invitedEmails})`;
  for (const row of rows) await authAdmin().auth.admin.deleteUser(row.auth_user_id);
  await cleanupAdmins(admins);
  await owner.end();
});

beforeEach(() => {
  vi.resetModules();
  jar.clear();
});

async function asOwner() {
  const admin = await createAdminUser("platform_owner", "Dono Equipe");
  admins.push(admin);
  await signInAdmin(admin);
  return { admin, actions: await import("./actions") };
}

async function invite(actions: Awaited<ReturnType<typeof asOwner>>["actions"], role = "platform_support") {
  const email = uniqueEmail("convidado");
  invitedEmails.push(email);
  const state = await actions.inviteAction({}, form({ name: "Pessoa Convidada", email, role }));
  const [row] = await owner<{ id: string; status: string; role: string }[]>`select id, status, role from platform.admins where email = ${email}`;
  return { email, state, row };
}

describe("convite", () => {
  it("cria como convidado, devolve o link sem e-mail configurado e aceita com senha uma vez só", async () => {
    const { actions } = await asOwner();
    const { email, state, row } = await invite(actions);
    expect(state.ok).toBe(true);
    expect(row).toMatchObject({ status: "invited", role: "platform_support" });
    expect(state.link).toContain("/accept?token_hash=");
    const token = new URL(state.link!).searchParams.get("token_hash")!;

    // Convidado ainda nao entra pelo login normal.
    jar.clear();
    const { signInAction } = await import("@/app/actions/auth");
    expect(await signInAction({}, form({ email, password: TEST_PASSWORD }))).toEqual({ error: "E-mail ou senha incorretos." });

    const { acceptInviteAction } = await import("../../(auth)/accept/actions");
    expect(await acceptInviteAction({}, form({ token, password: "curta", confirm: "curta" }))).toEqual({ error: "A senha precisa ter 12 ou mais caracteres." });
    expect(await acceptInviteAction({}, form({ token, password: "Senha-nova-12345", confirm: "outra-senha-12" }))).toEqual({ error: "As senhas não conferem." });
    expect(await redirectedTo(() => acceptInviteAction({}, form({ token, password: "Senha-nova-12345", confirm: "Senha-nova-12345" })))).toBe("/mfa");
    const [after] = await owner<{ status: string }[]>`select status from platform.admins where email = ${email}`;
    expect(after.status).toBe("active");

    // O mesmo link nao vale de novo.
    jar.clear();
    expect(await acceptInviteAction({}, form({ token, password: "Outra-senha-12345", confirm: "Outra-senha-12345" }))).toMatchObject({ error: expect.stringContaining("venceu") });
    const audit = await owner`select 1 from platform.audit_logs where action in ('admin.invited', 'admin.invite_accepted') and (target->>'email' = ${email} or admin_name = 'Pessoa Convidada')`;
    expect(audit.length).toBeGreaterThanOrEqual(2);
  });

  it("recusa e-mail repetido e quem não é proprietário", async () => {
    const { admin, actions } = await asOwner();
    expect(await actions.inviteAction({}, form({ name: "Repetido", email: admin.email, role: "platform_viewer" }))).toEqual({ error: "Já existe um administrador com este e-mail." });
    const support = await createAdminUser("platform_support", "Suporte Equipe");
    admins.push(support);
    await signInAdmin(support);
    const other = await import("./actions");
    await expect(other.inviteAction({}, form({ name: "Indevido", email: uniqueEmail("x"), role: "platform_viewer" }))).rejects.toBeDefined();
  });
});

describe("trancas e acesso", () => {
  it("muda papel, não mexe em si nem no último proprietário, desativa e reativa", async () => {
    const { admin, actions } = await asOwner();
    const { row } = await invite(actions);
    // aceita direto pelo banco para ficar ativo sem repetir o fluxo
    await owner`update platform.admins set status = 'active' where id = ${row.id}`;

    expect(await actions.changeRoleAction({}, form({ id: row.id, role: "platform_finance" }))).toEqual({ ok: true, message: "Papel atualizado." });
    expect((await owner<{ role: string }[]>`select role from platform.admins where id = ${row.id}`)[0].role).toBe("platform_finance");
    expect(await actions.changeRoleAction({}, form({ id: admin.adminId, role: "platform_viewer" }))).toEqual({ error: "Você não pode mudar o seu próprio papel." });
    expect(await actions.setActiveAction({}, form({ id: admin.adminId, active: "0" }))).toEqual({ error: "Você não pode desativar o seu próprio acesso." });

    expect(await actions.setActiveAction({}, form({ id: row.id, active: "0" }))).toEqual({ ok: true, message: "Acesso desativado." });
    expect((await owner<{ status: string }[]>`select status from platform.admins where id = ${row.id}`)[0].status).toBe("disabled");
    expect(await actions.setActiveAction({}, form({ id: row.id, active: "1" }))).toEqual({ ok: true, message: "Acesso reativado." });
  });

  it("não deixa o painel sem proprietário ativo (tranca na regra, mesmo sem passar pela tela)", async () => {
    const { admin } = await asOwner();
    const { setActive, changeRole, TeamError } = await import("@/lib/server/team");
    const others = await owner<{ id: string }[]>`select id from platform.admins where role = 'platform_owner' and status = 'active' and id <> ${admin.adminId}`;
    await owner`update platform.admins set status = 'disabled' where id = any(${others.map((o) => o.id)}::uuid[])`;
    try {
      const fakeActor = "00000000-0000-4000-8000-000000000000";
      await expect(setActive(admin.adminId, false, fakeActor)).rejects.toBeInstanceOf(TeamError);
      await expect(changeRole(admin.adminId, "platform_viewer", fakeActor)).rejects.toBeInstanceOf(TeamError);
    } finally {
      await owner`update platform.admins set status = 'active' where id = any(${others.map((o) => o.id)}::uuid[])`;
    }
  });

  it("reinicia o segundo fator de outra pessoa", async () => {
    const { actions } = await asOwner();
    const target = await createAdminUser("platform_viewer", "Leitor 2FA");
    admins.push(target);
    await signInAdmin(target); // cadastra um fator
    const before = await authAdmin().auth.admin.mfa.listFactors({ userId: target.authUserId });
    expect(before.data?.factors.length).toBeGreaterThan(0);
    jar.clear();
    vi.resetModules();
    const { actions: fresh } = await asOwner();
    expect(await fresh.resetMfaAction({}, form({ id: target.adminId }))).toMatchObject({ ok: true });
    const after = await authAdmin().auth.admin.mfa.listFactors({ userId: target.authUserId });
    expect(after.data?.factors.length).toBe(0);
    void actions;
  });
});
