import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, authAdmin, ownerSql, panelSql, purgeAudit, TEST_PASSWORD, uniqueEmail } from "@/test/local";

/**
 * Isolamento do painel no banco (doc technical/26, secoes 3 e 4): o schema
 * `platform` e dos administradores; os papeis da API nao o enxergam; o painel
 * le o `public` so onde ha politica e nao escreve nele; a auditoria so
 * acrescenta; administrador e usuario de espaco nunca dividem e-mail.
 */
const owner = ownerSql();
const panel = panelSql();
const createdAuthUsers: string[] = [];
const createdOrgs: string[] = [];
const createdAdmins: string[] = [];

async function expectDenied(promise: PromiseLike<unknown>) {
  await expect(promise).rejects.toMatchObject({ code: expect.stringMatching(/^(42501|42P01|23505|P0001)$/) });
}

afterAll(async () => {
  await purgeAudit(owner, createdAdmins);
  await owner`delete from platform.admins where id = any(${createdAdmins}::uuid[])`;
  await owner`delete from public.organizations where id = any(${createdOrgs})`;
  for (const id of createdAuthUsers) await authAdmin().auth.admin.deleteUser(id);
  await owner`delete from platform.rate_limits where key like 'teste:%'`;
  await owner.end();
  await panel.end();
});

describe("papeis da API nao enxergam o schema platform", () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    it(`${role} nao le nem escreve em platform`, async () => {
      for (const statement of ["select * from platform.admins", "select * from platform.audit_logs", "insert into platform.audit_logs (action) values ('x')"]) {
        await expectDenied(
          owner.begin(async (tx) => {
            await tx.unsafe(`set local role ${role}`);
            await tx.unsafe(statement);
          }),
        );
      }
    });
  }

  it("o schema nao esta exposto na API do Supabase", async () => {
    const response = await anonClient().schema("platform" as never).from("admins").select("*");
    expect(response.error).not.toBeNull();
    expect(response.data ?? []).toEqual([]);
  });
});

describe("o papel do painel (platform_app)", () => {
  it("le organizations, mas nenhuma outra tabela do public", async () => {
    await expect(panel`select count(*)::int from public.organizations`).resolves.toBeTruthy();
    for (const table of ["users", "clients", "charges", "legal_consents", "audit_logs"]) {
      await expectDenied(panel.unsafe(`select 1 from public.${table} limit 1`));
    }
  });

  it("nao escreve nada no public", async () => {
    await expectDenied(panel`insert into public.organizations (name, model) values ('x', 'classes')`);
    await expectDenied(panel`update public.organizations set name = 'x'`);
    await expectDenied(panel`delete from public.organizations`);
  });

  it("nao cria objetos nem em platform nem em public", async () => {
    await expectDenied(panel.unsafe("create table platform.intruso (id int)"));
    await expectDenied(panel.unsafe("create table public.intruso (id int)"));
  });
});

describe("auditoria so acrescenta", () => {
  it("o painel grava e le, mas nao edita nem apaga", async () => {
    const [row] = await panel`insert into platform.audit_logs (action, admin_name) values ('teste.db', 'teste') returning id`;
    await expect(panel`select id from platform.audit_logs where id = ${row.id}`).resolves.toHaveLength(1);
    await expectDenied(panel`update platform.audit_logs set action = 'outra' where id = ${row.id}`);
    await expectDenied(panel`delete from platform.audit_logs where id = ${row.id}`);
  });

  it("nem o dono do banco edita ou apaga (gatilho)", async () => {
    const [row] = await owner`insert into platform.audit_logs (action) values ('teste.db') returning id`;
    await expect(owner`update platform.audit_logs set action = 'outra' where id = ${row.id}`).rejects.toMatchObject({
      message: expect.stringContaining("só acrescenta"),
    });
    await expect(owner`delete from platform.audit_logs where id = ${row.id}`).rejects.toMatchObject({
      message: expect.stringContaining("só acrescenta"),
    });
  });
});

describe("administrador e usuario de espaco nunca dividem e-mail", () => {
  let adminAuthId: string;
  const adminEmail = uniqueEmail("admin");

  beforeAll(async () => {
    const { data, error } = await authAdmin().auth.admin.createUser({
      email: adminEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
      app_metadata: { platform: true },
    });
    if (error || !data.user) throw new Error(error?.message);
    adminAuthId = data.user.id;
    createdAuthUsers.push(adminAuthId);
    const [row] = await panel`
      insert into platform.admins (auth_user_id, name, email, role) values (${adminAuthId}, 'Admin de teste', ${adminEmail}, 'platform_owner')
      returning id`;
    createdAdmins.push(row.id);
  });

  it("o painel nao cadastra administrador com e-mail de usuario de espaco", async () => {
    const [org] = await owner`insert into public.organizations (name, model) values ('Espaço de teste', 'classes') returning id`;
    createdOrgs.push(org.id);
    const tenantEmail = uniqueEmail("cliente");
    await owner`insert into public.users (id, organization_id, name, email, profile) values (${crypto.randomUUID()}, ${org.id}, 'Cliente', ${tenantEmail}, 'owner')`;
    const { data } = await authAdmin().auth.admin.createUser({ email: uniqueEmail("outro"), password: TEST_PASSWORD, email_confirm: true });
    createdAuthUsers.push(data.user!.id);
    await expect(
      panel`insert into platform.admins (auth_user_id, name, email, role) values (${data.user!.id}, 'X', ${tenantEmail.toUpperCase()}, 'platform_viewer')`,
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("o espaco nao cadastra usuario com e-mail de administrador", async () => {
    const [org] = await owner`insert into public.organizations (name, model) values ('Outro espaço', 'classes') returning id`;
    createdOrgs.push(org.id);
    await expect(
      owner`insert into public.users (id, organization_id, name, email, profile) values (${crypto.randomUUID()}, ${org.id}, 'Intruso', ${adminEmail.toUpperCase()}, 'owner')`,
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("o marcador de plataforma so o servidor grava: o proprio usuario nao consegue se promover", async () => {
    const client = anonClient();
    const { error } = await client.auth.signInWithPassword({ email: adminEmail, password: TEST_PASSWORD });
    expect(error).toBeNull();
    const { data } = await client.auth.getUser();
    expect(data.user?.app_metadata?.platform).toBe(true);

    // Um usuario comum tenta se marcar: so `user_metadata` muda.
    const commonEmail = uniqueEmail("comum");
    const created = await authAdmin().auth.admin.createUser({ email: commonEmail, password: TEST_PASSWORD, email_confirm: true });
    createdAuthUsers.push(created.data.user!.id);
    const common = anonClient();
    await common.auth.signInWithPassword({ email: commonEmail, password: TEST_PASSWORD });
    await common.auth.updateUser({ data: { platform: true } });
    const { data: after } = await common.auth.getUser();
    expect(after.user?.app_metadata?.platform).toBeUndefined();
  });

  it("a sessao do administrador, no app dos clientes, nao enxerga nenhum espaco", async () => {
    const client = anonClient();
    await client.auth.signInWithPassword({ email: adminEmail, password: TEST_PASSWORD });
    const { data } = await client.from("users").select("id");
    expect(data ?? []).toEqual([]);
    const orgs = await client.from("organizations").select("id");
    expect(orgs.data ?? []).toEqual([]);
  });
});

describe("limite de tentativas do login", () => {
  it("deixa passar ate o limite, bloqueia depois e libera ao zerar", async () => {
    const key = `teste:${crypto.randomUUID()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const [row] = await panel<{ ok: boolean }[]>`select platform.check_rate_limit(${key}, 3, 60) as ok`;
      results.push(row.ok);
    }
    expect(results).toEqual([true, true, true, false]);
    await panel`select platform.reset_rate_limit(${key})`;
    const [again] = await panel<{ ok: boolean }[]>`select platform.check_rate_limit(${key}, 3, 60) as ok`;
    expect(again.ok).toBe(true);
  });
});
