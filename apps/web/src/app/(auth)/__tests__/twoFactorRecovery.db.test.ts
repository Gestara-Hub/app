import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminClient, createTestTenant, sessionClient, signInAs, type TestTenant } from "@/test/db";
import { currentSessionId, markSessionVerified } from "@/lib/security/second-factor";
import { EMAIL_CODE_TTL_MS, hashEmailCode, normalizeRecoveryCode } from "@/lib/security/two-factor-rules";
import { getClientForTenant } from "@/lib/supabase/tenant-client";
import { consumeRecoveryCode, issueRecoveryCodes, recoveryCodesLeft, setEmailTwoFactor } from "@/services/server/twoFactor";
import { finishSignIn } from "../sign-in-session";
import {
  disableTwoFactorAction,
  enableEmailTwoFactorAction,
  getTwoFactorStatusAction,
  regenerateRecoveryCodesAction,
} from "../two-factor-actions";

/**
 * Codigos de recuperacao da verificacao em duas etapas (doc technical/17): 8
 * codigos de uso unico, gerados ao ligar, usados para entrar, desligar ou
 * trocar por novos, no Supabase local.
 */

const jar = vi.hoisted(() => ({ cookies: new Map<string, string>(), user: null as Record<string, unknown> | null }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.cookies.has(name) ? { name, value: jar.cookies.get(name) } : undefined),
    set: (name: string, value: string) => void jar.cookies.set(name, value),
    delete: (name: string) => void jar.cookies.delete(name),
  }),
  headers: async () => new Headers({ "user-agent": "Mozilla/5.0 Chrome/141.0.0.0 Safari/537.36" }),
}));
vi.mock("@/features/auth/get-current-user", () => ({ getCurrentUser: async () => jar.user }));

let tenant: TestTenant;
let authUserId: string;
const admin = adminClient();

beforeEach(async () => {
  tenant = await createTestTenant();
  const { data } = await sessionClient().auth.getUser();
  authUserId = data.user!.id;
  const { data: row } = await admin.from("users").select("id, name").eq("auth_user_id", authUserId).single();
  jar.cookies.clear();
  jar.user = { id: row!.id, organizationId: tenant.organizationId, name: row!.name, email: tenant.owner.email, profile: "owner", status: "active" };
});

afterEach(async () => {
  await tenant.remove();
});

async function knownCode(purpose: "enable" | "disable" | "recovery", code = "123456") {
  await admin.from("two_factor_email_codes").update({ status: "revoked" }).eq("auth_user_id", authUserId).eq("purpose", purpose).eq("status", "pending");
  await admin
    .from("two_factor_email_codes")
    .insert({ auth_user_id: authUserId, purpose, code_hash: hashEmailCode(authUserId, code), expires_at: new Date(Date.now() + EMAIL_CODE_TTL_MS).toISOString() })
    .throwOnError();
  return code;
}

async function readsData(): Promise<boolean> {
  try {
    const client = await getClientForTenant();
    const { data } = await client.from("organizations").select("id").eq("id", tenant.organizationId);
    return (data ?? []).length === 1;
  } catch {
    return false;
  }
}

describe("códigos de recuperação", () => {
  it("ligar gera 8 códigos uma vez só, e o estado mostra quantos restam", async () => {
    const enabled = await enableEmailTwoFactorAction({ code: await knownCode("enable", "654321") });
    expect(enabled.ok).toBe(true);
    const codes = enabled.ok ? enabled.recoveryCodes : undefined;
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const code of codes!) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(await getTwoFactorStatusAction()).toMatchObject({ ok: true, enabled: true, recoveryLeft: 8 });
    // No banco só ficam hashes, nunca o código.
    const { data: rows } = await admin.from("two_factor_recovery_codes").select("code_hash").eq("auth_user_id", authUserId);
    expect(JSON.stringify(rows)).not.toContain(normalizeRecoveryCode(codes![0]));
  });

  it("cada código vale uma vez; aceita minúsculo e sem hífen; errado não vale", async () => {
    const codes = (await issueRecoveryCodes(admin, authUserId))!;
    expect(await consumeRecoveryCode(admin, authUserId, "ABCD-EFGH")).toBe(false);
    expect(await consumeRecoveryCode(admin, authUserId, codes[0].toLowerCase().replace("-", ""))).toBe(true);
    expect(await consumeRecoveryCode(admin, authUserId, codes[0])).toBe(false);
    expect(await recoveryCodesLeft(admin, authUserId)).toBe(7);
    expect(await consumeRecoveryCode(admin, authUserId, "curto")).toBe(false);
  });

  it("um código de recuperação prova o segundo fator da sessão (a senha sozinha não lê dados)", async () => {
    await setEmailTwoFactor(admin, authUserId, true);
    const codes = (await issueRecoveryCodes(admin, authUserId))!;
    const supabase = await signInAs(tenant.owner);
    expect(await readsData()).toBe(false);
    expect(await consumeRecoveryCode(admin, authUserId, codes[1])).toBe(true);
    const sessionId = await currentSessionId(supabase);
    expect(await markSessionVerified(admin, authUserId, sessionId!, "recovery")).toBe(true);
    expect(await readsData()).toBe(true);
  });

  it("desligar com um código de recuperação (quem perdeu o app) apaga o resto dos códigos", async () => {
    await setEmailTwoFactor(admin, authUserId, true);
    const codes = (await issueRecoveryCodes(admin, authUserId))!;
    // Sem o segundo fator nesta sessao (so a senha), nao muda nada.
    expect(await disableTwoFactorAction({ code: codes[2], method: "recovery" })).toMatchObject({ ok: false });
    // Quem perdeu o app entra com um codigo de recuperacao (a sessao passa a contar como verificada).
    await markSessionVerified(admin, authUserId, (await currentSessionId(sessionClient()))!, "recovery");
    expect(await disableTwoFactorAction({ code: "AAAA-AAAA", method: "recovery" })).toMatchObject({ ok: false });
    expect(await disableTwoFactorAction({ code: codes[2], method: "recovery" })).toEqual({ ok: true });
    expect(await getTwoFactorStatusAction()).toMatchObject({ enabled: false, recoveryLeft: 0 });
    expect(await recoveryCodesLeft(admin, authUserId)).toBe(0);
  });

  it("gerar novos pede um código atual e troca todos os antigos", async () => {
    await setEmailTwoFactor(admin, authUserId, true);
    // Quem muda a seguranca ja esta verificado nesta sessao (senao a barreira nem deixa gravar a auditoria).
    await markSessionVerified(admin, authUserId, (await currentSessionId(sessionClient()))!, "email");
    const old = (await issueRecoveryCodes(admin, authUserId))!;
    expect(await regenerateRecoveryCodesAction({ code: "000000", method: "email" })).toMatchObject({ ok: false });
    const result = await regenerateRecoveryCodesAction({ code: await knownCode("recovery"), method: "email" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recoveryCodes).toHaveLength(8);
    expect(await consumeRecoveryCode(admin, authUserId, old[0])).toBe(false);
    expect(await consumeRecoveryCode(admin, authUserId, result.recoveryCodes[0])).toBe(true);
    const { data: audit } = await admin.from("audit_logs").select("summary").eq("organization_id", tenant.organizationId);
    expect(audit?.map((a) => a.summary).join(" ")).toContain("gerou novos códigos de recuperação");
  });
});

describe("espaço inativado pelo painel", () => {
  it("o login diz que o espaço está inativo, em vez de voltar mudo à tela de entrada", async () => {
    await admin.from("organizations").update({ status: "inactive" }).eq("id", tenant.organizationId);
    expect(await finishSignIn(admin, authUserId)).toEqual({ ok: false, message: "Este espaço está inativo. Fale com o suporte do GestaraHub para reativar." });
    await admin.from("organizations").update({ status: "active" }).eq("id", tenant.organizationId);
    expect(await finishSignIn(admin, authUserId)).toMatchObject({ ok: true });
  });
});
