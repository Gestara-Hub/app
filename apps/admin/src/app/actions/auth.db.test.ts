import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { jar, redirectedTo } from "@/test/next-mocks";
import { authAdmin, ownerSql, panelSql, purgeAudit, TEST_PASSWORD, uniqueEmail } from "@/test/local";
import { totpNow } from "@/test/totp";
import { SESSION_STARTED_COOKIE, signSessionStart } from "@/lib/session-token";

vi.mock("next/headers", async () => (await import("@/test/next-mocks")).headersMock());
vi.mock("next/navigation", async () => (await import("@/test/next-mocks")).navigationMock());
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

/**
 * As actions de entrada do painel de verdade, no Supabase local: senha,
 * marcador de plataforma, linha ativa de administrador, segundo fator, tempo de
 * sessao, limite de tentativas e auditoria. So o Next (cookies e redirect) e simulado.
 */
const owner = ownerSql();
const panel = panelSql();
const authUsers: string[] = [];
const orgs: string[] = [];
const admins: string[] = [];

let signInAction: typeof import("./auth").signInAction;
let verifyMfaAction: typeof import("./auth").verifyMfaAction;
let signOutAction: typeof import("./auth").signOutAction;
let getAdminContext: typeof import("@/lib/server/context").getAdminContext;

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

async function createAdmin(role = "platform_owner") {
  const email = uniqueEmail("painel");
  const { data } = await authAdmin().auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    app_metadata: { platform: true },
  });
  authUsers.push(data.user!.id);
  const [row] = await panel`
    insert into platform.admins (auth_user_id, name, email, role) values (${data.user!.id}, 'Admin Teste', ${email}, ${role}) returning id`;
  admins.push(row.id);
  return { email, authUserId: data.user!.id, adminId: row.id as string };
}

async function auditActions(email: string): Promise<string[]> {
  const rows = await owner<{ action: string }[]>`
    select action from platform.audit_logs
    where target->>'email' = ${email} or admin_id in (select id from platform.admins where email = ${email})
    order by created_at`;
  return rows.map((r) => r.action);
}

beforeEach(async () => {
  jar.clear();
  vi.resetModules();
  ({ signInAction, verifyMfaAction, signOutAction } = await import("./auth"));
  ({ getAdminContext } = await import("@/lib/server/context"));
  await owner`delete from platform.rate_limits`;
});

afterAll(async () => {
  await purgeAudit(owner, admins);
  await owner`delete from platform.admins where id = any(${admins}::uuid[])`;
  await owner`delete from public.organizations where id = any(${orgs})`;
  for (const id of authUsers) await authAdmin().auth.admin.deleteUser(id);
  await owner.end();
  await panel.end();
});

describe("entrada no painel", () => {
  it("senha errada: mensagem genérica e registro", async () => {
    const { email } = await createAdmin();
    const result = await signInAction({}, form({ email, password: "senha-errada" }));
    expect(result.error).toBe("E-mail ou senha incorretos.");
    expect(jar.has(SESSION_STARTED_COOKIE)).toBe(false);
    expect(await auditActions(email)).toContain("auth.login_failed");
  });

  it("conta de usuário de espaço, mesmo com a senha certa, não entra e fica sem sessão", async () => {
    const email = uniqueEmail("cliente");
    const { data } = await authAdmin().auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
    authUsers.push(data.user!.id);
    const [org] = await owner`insert into public.organizations (name, model) values ('Espaço', 'classes') returning id`;
    orgs.push(org.id);
    await owner`insert into public.users (id, auth_user_id, organization_id, name, email, profile) values (${data.user!.id}, ${data.user!.id}, ${org.id}, 'Dono', ${email}, 'owner')`;

    const result = await signInAction({}, form({ email, password: TEST_PASSWORD }));
    expect(result.error).toBe("E-mail ou senha incorretos.");
    expect(jar.has(SESSION_STARTED_COOKIE)).toBe(false);
    expect([...jar.keys()].filter((name) => name.startsWith("gestara-admin") && !name.includes("started"))).toEqual([]);
    expect((await getAdminContext()).stage).toBe("anonymous");
    expect(await auditActions(email)).toContain("auth.login_denied");
  });

  it("conta com o marcador mas sem linha em platform.admins também é recusada", async () => {
    const email = uniqueEmail("sem-linha");
    const { data } = await authAdmin().auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true, app_metadata: { platform: true } });
    authUsers.push(data.user!.id);
    const result = await signInAction({}, form({ email, password: TEST_PASSWORD }));
    expect(result.error).toBe("E-mail ou senha incorretos.");
    expect((await getAdminContext()).stage).toBe("anonymous");
  });

  it("administrador desativado não entra", async () => {
    const { email, adminId } = await createAdmin();
    await owner`update platform.admins set status = 'disabled' where id = ${adminId}`;
    const result = await signInAction({}, form({ email, password: TEST_PASSWORD }));
    expect(result.error).toBe("E-mail ou senha incorretos.");
  });

  it("bloqueia a sexta tentativa no mesmo minuto", async () => {
    const { email } = await createAdmin();
    for (let i = 0; i < 5; i++) await signInAction({}, form({ email, password: `errada-${i}` }));
    const sixth = await signInAction({}, form({ email, password: TEST_PASSWORD }));
    expect(sixth.error).toMatch(/Muitas tentativas/);
  });
});

describe("senha, segundo fator e painel aberto", () => {
  it("só abre depois do código; sair encerra tudo", async () => {
    const { email } = await createAdmin();

    // Passo 1: senha certa leva ao segundo fator, mas o painel ainda não abre.
    expect(await redirectedTo(() => signInAction({}, form({ email, password: TEST_PASSWORD })))).toBe("/mfa");
    const afterPassword = await getAdminContext();
    expect(afterPassword.stage).toBe("needs_mfa");
    expect(jar.has(SESSION_STARTED_COOKIE)).toBe(true);

    // Cadastra o aplicativo (como a página /mfa faz) e confirma com o código.
    const { createAuthClient } = await import("@/lib/server/supabase");
    const supabase = await createAuthClient();
    const enroll = await supabase.auth.mfa.enroll({ factorType: "totp" });
    const wrong = await verifyMfaAction({}, form({ factorId: enroll.data!.id, code: "000000" }));
    expect(wrong.error).toMatch(/Código incorreto/);
    expect((await getAdminContext()).stage).toBe("needs_mfa");

    expect(await redirectedTo(() => verifyMfaAction({}, form({ factorId: enroll.data!.id, code: totpNow(enroll.data!.totp.secret), next: "/audit" })))).toBe("/audit");
    const ctx = await getAdminContext();
    expect(ctx.stage).toBe("ok");
    if (ctx.stage === "ok") expect(ctx.admin.role).toBe("platform_owner");
    expect(await auditActions(email)).toEqual(expect.arrayContaining(["auth.mfa_failed", "auth.mfa_enrolled", "auth.login"]));
    const [{ last_login_at }] = await owner`select last_login_at from platform.admins where email = ${email}`;
    expect(last_login_at).not.toBeNull();

    // Sair: nada fica de pé.
    expect(await redirectedTo(() => signOutAction())).toBe("/login");
    expect((await getAdminContext()).stage).toBe("anonymous");
    expect(jar.has(SESSION_STARTED_COOKIE)).toBe(false);
    expect(await auditActions(email)).toContain("auth.logout");
  });

  it("depois de 8 horas a sessão deixa de valer, mesmo com o código feito", async () => {
    const { email, authUserId } = await createAdmin();
    await redirectedTo(() => signInAction({}, form({ email, password: TEST_PASSWORD })));
    const { createAuthClient } = await import("@/lib/server/supabase");
    const supabase = await createAuthClient();
    const enroll = await supabase.auth.mfa.enroll({ factorType: "totp" });
    await redirectedTo(() => verifyMfaAction({}, form({ factorId: enroll.data!.id, code: totpNow(enroll.data!.totp.secret) })));
    expect((await getAdminContext()).stage).toBe("ok");

    // Volta o relógio do início da sessão para 9 horas atrás (cookie assinado de verdade).
    jar.set(SESSION_STARTED_COOKIE, signSessionStart(process.env.ADMIN_SESSION_SECRET!, authUserId, Date.now() - 9 * 60 * 60 * 1000));
    expect(await getAdminContext()).toMatchObject({ stage: "anonymous", reason: "expired" });

    // E um cookie de tempo forjado (assinatura de outro segredo) também não vale.
    jar.set(SESSION_STARTED_COOKIE, signSessionStart("outro-segredo-qualquer-com-32-caracteres!!", authUserId, Date.now()));
    expect(await getAdminContext()).toMatchObject({ stage: "anonymous", reason: "invalid" });
  });

  it("sem o cookie de tempo (só a sessão do Supabase) o painel não abre", async () => {
    const { email } = await createAdmin();
    await redirectedTo(() => signInAction({}, form({ email, password: TEST_PASSWORD })));
    jar.delete(SESSION_STARTED_COOKIE);
    expect(await getAdminContext()).toMatchObject({ stage: "anonymous", hasSession: true });
  });
});
