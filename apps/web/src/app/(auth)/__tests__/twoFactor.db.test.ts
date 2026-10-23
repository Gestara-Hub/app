import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestTenant, type TestTenant } from "@/test/db";
import { needsSecondFactor } from "../sign-in-session";

/** Verificacao em duas etapas com aplicativo (doc 17): o MFA do Supabase local. */

let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

function freshClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
  const value = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, "0");
}

describe("verificação em duas etapas com aplicativo", () => {
  it("sem o app, a senha basta; com o app ligado, a senha pede o código", async () => {
    const first = freshClient();
    await first.auth.signInWithPassword({ email: tenant.owner.email, password: tenant.owner.password });
    expect(await needsSecondFactor(first)).toBe(false);

    // Liga: cadastra o fator e confirma com o primeiro codigo.
    const { data: enrolled, error: enrollError } = await first.auth.mfa.enroll({ factorType: "totp", issuer: "GestaraHub" });
    expect(enrollError).toBeNull();
    const { error: confirmError } = await first.auth.mfa.challengeAndVerify({
      factorId: enrolled!.id,
      code: totp(enrolled!.totp.secret),
    });
    expect(confirmError).toBeNull();

    // Novo login: a senha deixa a sessao esperando o codigo.
    const second = freshClient();
    await second.auth.signInWithPassword({ email: tenant.owner.email, password: tenant.owner.password });
    expect(await needsSecondFactor(second)).toBe(true);

    const { error: wrongError } = await second.auth.mfa.challengeAndVerify({ factorId: enrolled!.id, code: "000000" });
    expect(wrongError).not.toBeNull();
    expect(await needsSecondFactor(second)).toBe(true);

    const { error: rightError } = await second.auth.mfa.challengeAndVerify({
      factorId: enrolled!.id,
      code: totp(enrolled!.totp.secret),
    });
    expect(rightError).toBeNull();
    expect(await needsSecondFactor(second)).toBe(false);

    // Desligar (com a sessao ja verificada): o proximo login volta a pedir so a senha.
    const { error: unenrollError } = await second.auth.mfa.unenroll({ factorId: enrolled!.id });
    expect(unenrollError).toBeNull();
    const third = freshClient();
    await third.auth.signInWithPassword({ email: tenant.owner.email, password: tenant.owner.password });
    expect(await needsSecondFactor(third)).toBe(false);
  });
});
