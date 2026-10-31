import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminClient, createTestTenant, sessionClient, signInAs, type TestTenant } from "@/test/db";
import { currentSessionId, markSessionVerified } from "@/lib/security/second-factor";
import { EMAIL_CODE_TTL_MS, TRUSTED_DEVICE_COOKIE, TRUSTED_DEVICE_TTL_MS, hashEmailCode } from "@/lib/security/two-factor-rules";
import { getClientForTenant } from "@/lib/supabase/tenant-client";
import { requireTenant } from "@/services/server/tenant";
import {
  consumeTrustedDevice,
  disableTwoFactor,
  issueEmailCode,
  issueRecoveryCodes,
  listTrustedDevices,
  recoveryCodesLeft,
  rememberDevice,
  setEmailTwoFactor,
  verifyEmailCode,
} from "@/services/server/twoFactor";
import { needsSecondFactor } from "../sign-in-session";
import {
  disableTwoFactorAction,
  enableEmailTwoFactorAction,
  getTwoFactorStatusAction,
  listTrustedDevicesAction,
  removeTwoFactorMethodAction,
} from "../two-factor-actions";

/**
 * Verificacao em duas etapas, entrega 2 (doc 17): codigo por e-mail, a
 * barreira (`secondFactorState`) e o dispositivo lembrado, no Supabase local.
 */

const jar = vi.hoisted(() => ({ cookies: new Map<string, string>(), user: null as Record<string, unknown> | null }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.cookies.has(name) ? { name, value: jar.cookies.get(name) } : undefined),
    set: (name: string, value: string) => void jar.cookies.set(name, value),
    delete: (name: string) => void jar.cookies.delete(name),
  }),
  headers: async () =>
    new Headers({ "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0.0.0 Safari/537.36" }),
}));

// O usuario do app (cookie da sessao) e o dono do espaco do teste.
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
  jar.user = {
    id: row!.id,
    organizationId: tenant.organizationId,
    name: row!.name,
    email: tenant.owner.email,
    profile: "owner",
    status: "active",
  };
});

afterEach(async () => {
  await tenant.remove();
});

/** Grava um codigo conhecido (so o hash, como o servidor), no lugar do que foi "enviado". */
async function knownCode(purpose: "login" | "enable" | "disable", code = "123456") {
  await admin
    .from("two_factor_email_codes")
    .update({ status: "revoked" })
    .eq("auth_user_id", authUserId)
    .eq("purpose", purpose)
    .eq("status", "pending");
  await admin
    .from("two_factor_email_codes")
    .insert({
      auth_user_id: authUserId,
      purpose,
      code_hash: hashEmailCode(authUserId, code),
      expires_at: new Date(Date.now() + EMAIL_CODE_TTL_MS).toISOString(),
    })
    .throwOnError();
  return code;
}

async function readsData(): Promise<boolean> {
  try {
    const client = await getClientForTenant();
    const { data } = await client.from("organizations").select("id").eq("id", tenant.organizationId);
    await requireTenant();
    return (data ?? []).length === 1;
  } catch {
    return false;
  }
}

/** Codigo TOTP (RFC 6238: SHA-1, 30 s, 6 digitos) a partir da chave base32. */
function totp(secret: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

async function freshLogin(): Promise<SupabaseClient> {
  return signInAs(tenant.owner);
}

describe("verificação por e-mail: a barreira", () => {
  it("sem verificação ligada, a senha basta", async () => {
    expect(await needsSecondFactor(sessionClient())).toBe(false);
    expect(await readsData()).toBe(true);
  });

  it("com o e-mail ligado, a senha sozinha não lê dados; depois do código, lê", async () => {
    await setEmailTwoFactor(admin, authUserId, true);
    const supabase = await freshLogin();
    expect(await needsSecondFactor(supabase)).toBe(true);
    expect(await readsData()).toBe(false);

    const issued = await issueEmailCode(admin, authUserId, "login");
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(await verifyEmailCode(admin, authUserId, "login", issued.code)).toBe("ok");
    const sessionId = await currentSessionId(supabase);
    expect(sessionId).toBeTruthy();
    await markSessionVerified(admin, authUserId, sessionId!, "email");

    expect(await needsSecondFactor(supabase)).toBe(false);
    expect(await readsData()).toBe(true);

    // Outra sessao do mesmo usuario continua barrada.
    await freshLogin();
    expect(await readsData()).toBe(false);
  });
});

describe("código por e-mail: regras", () => {
  it("5 erros revogam; vencido e usado não valem; código novo revoga o anterior", async () => {
    const now = new Date();
    const first = await issueEmailCode(admin, authUserId, "login", now);
    if (!first.ok) throw new Error("codigo nao criado");
    const wrong = first.code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) expect(await verifyEmailCode(admin, authUserId, "login", wrong, now)).toBe("invalid");
    expect(await verifyEmailCode(admin, authUserId, "login", wrong, now)).toBe("locked");
    expect(await verifyEmailCode(admin, authUserId, "login", first.code, now)).toBe("expired");

    // Vencido (11 minutos depois).
    const later = new Date(now.getTime() + 61_000);
    const second = await issueEmailCode(admin, authUserId, "login", later);
    if (!second.ok) throw new Error("codigo nao criado");
    expect(await verifyEmailCode(admin, authUserId, "login", second.code, new Date(later.getTime() + 11 * 60_000))).toBe(
      "expired",
    );

    // Usado uma vez so.
    const third = await issueEmailCode(admin, authUserId, "login", new Date(later.getTime() + 61_000));
    if (!third.ok) throw new Error("codigo nao criado");
    expect(await verifyEmailCode(admin, authUserId, "login", third.code)).toBe("ok");
    expect(await verifyEmailCode(admin, authUserId, "login", third.code)).toBe("expired");

    // Codigo novo: o anterior deixa de valer.
    const base = new Date(later.getTime() + 122_000);
    const old = await issueEmailCode(admin, authUserId, "enable", base);
    const fresh = await issueEmailCode(admin, authUserId, "enable", new Date(base.getTime() + 61_000));
    if (!old.ok || !fresh.ok) throw new Error("codigo nao criado");
    if (old.code !== fresh.code) {
      expect(await verifyEmailCode(admin, authUserId, "enable", old.code)).toBe("invalid");
    }
    expect(await verifyEmailCode(admin, authUserId, "enable", fresh.code)).toBe("ok");
    // O proposito separa: codigo de ligar nao entra no login.
    expect(await verifyEmailCode(admin, authUserId, "login", fresh.code)).toBe("expired");
  });

  it("reenviar: espera de 60 s e no máximo 5 envios em 15 minutos", async () => {
    const start = new Date();
    expect((await issueEmailCode(admin, authUserId, "login", start)).ok).toBe(true);
    const tooSoon = await issueEmailCode(admin, authUserId, "login", new Date(start.getTime() + 10_000));
    expect(tooSoon).toEqual({ ok: false, reason: "wait", resendInSeconds: 50 });
    for (let i = 1; i < 5; i++) {
      expect((await issueEmailCode(admin, authUserId, "login", new Date(start.getTime() + i * 61_000))).ok).toBe(true);
    }
    expect(await issueEmailCode(admin, authUserId, "login", new Date(start.getTime() + 5 * 61_000))).toEqual({
      ok: false,
      reason: "limit",
    });
  });
});

describe("dispositivo lembrado", () => {
  it("entra sem código; vencido, esquecido ou de outro usuário não vale", async () => {
    await setEmailTwoFactor(admin, authUserId, true);
    const device = await rememberDevice(admin, authUserId, "Mozilla/5.0 (iPhone) Safari/604.1");
    expect(device).not.toBeNull();

    // Login com o cookie do dispositivo: passa e a sessao le dados.
    jar.cookies.set(TRUSTED_DEVICE_COOKIE, device!.token);
    const supabase = await freshLogin();
    expect(await needsSecondFactor(supabase)).toBe(false);
    expect(await readsData()).toBe(true);

    // De outro usuario.
    const other = await tenant.addUser("manager");
    const { data: otherAuth } = await admin.from("users").select("auth_user_id").eq("id", other.id).single();
    expect(await consumeTrustedDevice(admin, String(otherAuth!.auth_user_id), device!.token)).toBe(false);

    // Vencido.
    expect(
      await consumeTrustedDevice(admin, authUserId, device!.token, new Date(Date.now() + TRUSTED_DEVICE_TTL_MS + 60_000)),
    ).toBe(false);

    // Esquecido na janela Seguranca.
    const listed = await listTrustedDevicesAction();
    expect(listed.ok && listed.devices.map((d) => [d.label, d.current])).toEqual([["Safari no iPhone", true]]);
    await admin.from("trusted_devices").update({ revoked_at: new Date().toISOString() }).eq("auth_user_id", authUserId);
    expect(await consumeTrustedDevice(admin, authUserId, device!.token)).toBe(false);
    const again = await freshLogin();
    expect(await needsSecondFactor(again)).toBe(true);
  });

  it("app ligado + dispositivo lembrado: entra sem o código do app", async () => {
    const first = sessionClient();
    const { data: enrolled } = await first.auth.mfa.enroll({ factorType: "totp", issuer: "GestaraHub" });
    await first.auth.mfa.challengeAndVerify({ factorId: enrolled!.id, code: totp(enrolled!.totp.secret) });

    const withoutDevice = await freshLogin();
    expect(await needsSecondFactor(withoutDevice)).toBe(true);
    expect(await readsData()).toBe(false);

    const device = await rememberDevice(admin, authUserId, null);
    jar.cookies.set(TRUSTED_DEVICE_COOKIE, device!.token);
    const withDevice = await freshLogin();
    expect(await needsSecondFactor(withDevice)).toBe(false);
    expect(await readsData()).toBe(true);
  });
});

describe("ligar e desligar pela janela Segurança", () => {
  it("liga pelo e-mail (a sessão atual segue lendo), desliga e revoga os dispositivos", async () => {
    expect(await getTwoFactorStatusAction()).toMatchObject({ ok: true, enabled: false, app: false, email: false });

    expect(await enableEmailTwoFactorAction({ code: await knownCode("enable", "654321") })).toMatchObject({ ok: true });
    expect(await getTwoFactorStatusAction()).toMatchObject({ ok: true, enabled: true, email: true });
    expect(await readsData()).toBe(true);

    const device = await rememberDevice(admin, authUserId, null);
    jar.cookies.set(TRUSTED_DEVICE_COOKIE, device!.token);

    expect(await disableTwoFactorAction({ code: "999999", method: "email" })).toMatchObject({ ok: false });
    expect(await disableTwoFactorAction({ code: await knownCode("disable"), method: "email" })).toEqual({ ok: true });
    expect(await getTwoFactorStatusAction()).toMatchObject({ ok: true, enabled: false });
    expect(await consumeTrustedDevice(admin, authUserId, device!.token)).toBe(false);
    expect(jar.cookies.has(TRUSTED_DEVICE_COOKIE)).toBe(false);
    const { count } = await admin
      .from("two_factor_sessions")
      .select("session_id", { count: "exact", head: true })
      .eq("auth_user_id", authUserId);
    expect(count).toBe(0);

    // Auditoria: ligou e desligou, como evento de seguranca.
    const { data: audit } = await admin
      .from("audit_logs")
      .select("summary, security")
      .eq("organization_id", tenant.organizationId)
      .order("timestamp");
    expect(audit?.map((row) => row.summary)).toEqual([
      "Teste owner ligou a verificação em duas etapas por e-mail",
      "Teste owner desligou a verificação em duas etapas",
    ]);
    expect(audit?.every((row) => row.security)).toBe(true);
  });

  it("desligar com o app remove o fator e o e-mail", async () => {
    const supabase = sessionClient();
    const { data: enrolled } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "GestaraHub" });
    await supabase.auth.mfa.challengeAndVerify({ factorId: enrolled!.id, code: totp(enrolled!.totp.secret) });
    await setEmailTwoFactor(admin, authUserId, true);
    expect(await getTwoFactorStatusAction()).toMatchObject({ app: true, email: true });

    // Codigo do app na proxima janela de 30 s: o atual ja foi usado no cadastro.
    expect(
      await disableTwoFactorAction({ code: totp(enrolled!.totp.secret, Date.now() + 30_000), method: "app" }),
    ).toEqual({ ok: true });
    const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: authUserId });
    expect(factors?.factors ?? []).toHaveLength(0);
    expect(await getTwoFactorStatusAction()).toMatchObject({ enabled: false, app: false, email: false });
    await disableTwoFactor(admin, authUserId);
  });
});

describe("remover um método e manter o outro", () => {
  /** App e e-mail ligados, com a sessao atual no AAL2 (app), codigos e um dispositivo lembrado. */
  async function bothOn() {
    const supabase = sessionClient();
    const { data: enrolled } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "GestaraHub" });
    await supabase.auth.mfa.challengeAndVerify({ factorId: enrolled!.id, code: totp(enrolled!.totp.secret) });
    await setEmailTwoFactor(admin, authUserId, true);
    await issueRecoveryCodes(admin, authUserId);
    await rememberDevice(admin, authUserId, null);
    return { supabase, secret: enrolled!.totp.secret };
  }

  async function auditSummaries() {
    const { data } = await admin.from("audit_logs").select("summary").eq("organization_id", tenant.organizationId).order("timestamp");
    return (data ?? []).map((row) => row.summary);
  }

  it("remover o e-mail pede o código do aplicativo, que continua; códigos e dispositivos ficam", async () => {
    const { supabase, secret } = await bothOn();
    const sessionId = (await currentSessionId(supabase))!;
    await markSessionVerified(admin, authUserId, sessionId, "email");

    expect(await removeTwoFactorMethodAction({ method: "email", code: "999999" })).toMatchObject({ ok: false });
    expect(
      await removeTwoFactorMethodAction({ method: "email", code: totp(secret, Date.now() + 30_000) }),
    ).toEqual({ ok: true });

    expect(await getTwoFactorStatusAction()).toMatchObject({ enabled: true, app: true, email: false, recoveryLeft: 8 });
    expect(await listTrustedDevices(admin, authUserId, undefined, new Date())).toHaveLength(1);
    // Sessoes verificadas pelo e-mail pedem o codigo de novo; esta segue pelo app.
    const { count } = await admin
      .from("two_factor_sessions")
      .select("session_id", { count: "exact", head: true })
      .eq("auth_user_id", authUserId)
      .eq("method", "email");
    expect(count).toBe(0);
    expect(await readsData()).toBe(true);
    expect(await auditSummaries()).toContain("Teste owner removeu o código por e-mail da verificação em duas etapas");
    await disableTwoFactor(admin, authUserId);
  });

  it("remover o aplicativo pede o código do e-mail, que continua; esta sessão segue lendo", async () => {
    const { supabase } = await bothOn();

    expect(await removeTwoFactorMethodAction({ method: "app", code: await knownCode("disable") })).toEqual({ ok: true });

    const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: authUserId });
    expect(factors?.factors ?? []).toHaveLength(0);
    expect(await getTwoFactorStatusAction()).toMatchObject({ enabled: true, app: false, email: true, recoveryLeft: 8 });
    const sessionId = (await currentSessionId(supabase))!;
    const { data: proof } = await admin.from("two_factor_sessions").select("method").eq("session_id", sessionId).single();
    expect(proof?.method).toBe("email");
    expect(await readsData()).toBe(true);
    // Um login novo pede o codigo do e-mail.
    expect(await needsSecondFactor(await freshLogin())).toBe(true);
    expect(await auditSummaries()).toContain("Teste owner removeu o aplicativo da verificação em duas etapas");
    await disableTwoFactor(admin, authUserId);
  });

  it("com um método só, remover não desliga: fica no Desligar", async () => {
    await setEmailTwoFactor(admin, authUserId, true);

    expect(await removeTwoFactorMethodAction({ method: "email", code: "123456" })).toEqual({
      ok: false,
      message: "Com um método só, use Desligar.",
    });
    expect(await getTwoFactorStatusAction()).toMatchObject({ enabled: true, email: true });
    expect(await recoveryCodesLeft(admin, authUserId)).toBe(0);
    await disableTwoFactor(admin, authUserId);
  });
});
