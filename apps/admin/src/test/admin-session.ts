import { jar, redirectedTo } from "./next-mocks";
import { authAdmin, panelSql, TEST_PASSWORD, uniqueEmail } from "./local";
import { totpNow } from "./totp";

/**
 * Entra no painel de verdade (senha + segundo fator, como uma pessoa) para os
 * testes das telas e actions. Quem usa precisa dos `vi.mock` de next/headers,
 * next/navigation e react (ver auth.db.test.ts) no topo do proprio arquivo.
 */
export interface TestAdmin {
  adminId: string;
  authUserId: string;
  email: string;
  name: string;
}

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

export async function createAdminUser(role: string, name = "Admin Teste"): Promise<TestAdmin> {
  const panel = panelSql();
  try {
    const email = uniqueEmail("painel");
    const { data } = await authAdmin().auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      app_metadata: { platform: true },
    });
    const [row] = await panel`
      insert into platform.admins (auth_user_id, name, email, role) values (${data.user!.id}, ${name}, ${email}, ${role}) returning id`;
    return { adminId: row.id as string, authUserId: data.user!.id, email, name };
  } finally {
    await panel.end();
  }
}

/** Faz o login completo e deixa a "sessao" no pote de cookies. Devolve o segredo do app (para entrar de novo). */
export async function signInAdmin(admin: TestAdmin): Promise<string> {
  jar.clear();
  const { signInAction, verifyMfaAction } = await import("@/app/actions/auth");
  const { createAuthClient } = await import("@/lib/server/supabase");
  await redirectedTo(() => signInAction({}, form({ email: admin.email, password: TEST_PASSWORD })));
  const supabase = await createAuthClient();
  const enroll = await supabase.auth.mfa.enroll({ factorType: "totp" });
  await redirectedTo(() =>
    verifyMfaAction({}, form({ factorId: enroll.data!.id, code: totpNow(enroll.data!.totp.secret) })),
  );
  return enroll.data!.totp.secret;
}

/** Apaga o administrador de teste, a auditoria dele e a conta de login. */
export async function cleanupAdmins(admins: TestAdmin[]): Promise<void> {
  if (admins.length === 0) return;
  const { ownerSql, purgeAudit } = await import("./local");
  const owner = ownerSql();
  try {
    await purgeAudit(owner, admins.map((a) => a.adminId));
    await owner`delete from platform.admins where id = any(${admins.map((a) => a.adminId)}::uuid[])`;
  } finally {
    await owner.end();
  }
  for (const admin of admins) await authAdmin().auth.admin.deleteUser(admin.authUserId);
}
