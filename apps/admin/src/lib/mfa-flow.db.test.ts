import { afterAll, describe, expect, it } from "vitest";
import { anonClient, authAdmin, ownerSql, TEST_PASSWORD, uniqueEmail } from "@/test/local";
import { totpNow } from "@/test/totp";

/**
 * O caminho do segundo fator como as actions usam (cadastrar o app, confirmar,
 * sair e voltar pedindo o codigo): confirma o formato das respostas do
 * Supabase Auth e que a sessao so vira AAL2 depois do codigo certo.
 */
const owner = ownerSql();
const created: string[] = [];

afterAll(async () => {
  for (const id of created) await authAdmin().auth.admin.deleteUser(id);
  await owner.end();
});

describe("segundo fator do painel", () => {
  it("cadastra o app, confirma e depois exige o codigo a cada entrada", async () => {
    const email = uniqueEmail("mfa");
    const { data } = await authAdmin().auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      app_metadata: { platform: true },
    });
    created.push(data.user!.id);

    // Primeira entrada: so senha (AAL1) e nenhum fator verificado.
    const client = anonClient();
    await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
    let aal = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(aal.data?.currentLevel).toBe("aal1");
    expect(aal.data?.nextLevel).toBe("aal1");
    let factors = await client.auth.mfa.listFactors();
    expect(factors.data?.all.filter((f) => f.factor_type === "totp" && f.status === "verified")).toHaveLength(0);

    // Cadastra e confirma o aplicativo.
    const enroll = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "teste" });
    expect(enroll.data?.totp.qr_code).toMatch(/^data:image\/svg\+xml/);
    const secret = enroll.data!.totp.secret;
    const challenge = await client.auth.mfa.challenge({ factorId: enroll.data!.id });
    const wrong = await client.auth.mfa.verify({ factorId: enroll.data!.id, challengeId: challenge.data!.id, code: "000000" });
    expect(wrong.error).not.toBeNull();
    const challenge2 = await client.auth.mfa.challenge({ factorId: enroll.data!.id });
    const ok = await client.auth.mfa.verify({ factorId: enroll.data!.id, challengeId: challenge2.data!.id, code: totpNow(secret) });
    expect(ok.error).toBeNull();
    aal = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(aal.data?.currentLevel).toBe("aal2");

    // Sai e entra de novo: senha so da AAL1 e o painel exige o codigo.
    await client.auth.signOut();
    const again = anonClient();
    await again.auth.signInWithPassword({ email, password: TEST_PASSWORD });
    aal = await again.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(aal.data?.currentLevel).toBe("aal1");
    expect(aal.data?.nextLevel).toBe("aal2");
    factors = await again.auth.mfa.listFactors();
    const verified = factors.data!.all.find((f) => f.factor_type === "totp" && f.status === "verified")!;
    expect(verified).toBeTruthy();
    const c = await again.auth.mfa.challenge({ factorId: verified.id });
    const v = await again.auth.mfa.verify({ factorId: verified.id, challengeId: c.data!.id, code: totpNow(secret) });
    expect(v.error).toBeNull();
    aal = await again.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(aal.data?.currentLevel).toBe("aal2");
  });
});
