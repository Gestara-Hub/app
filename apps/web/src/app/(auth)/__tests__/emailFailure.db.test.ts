import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient } from "@/test/db";

/**
 * E-mail que nao sai nao pode virar "enviado": o MailerSend recusa (ex.: limite
 * da conta sandbox, MS42225) e nada fica valendo nem pendente.
 */

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "localhost:3000" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => undefined }),
}));
vi.mock("@/lib/security/rate-limit", () => ({
  getClientIp: async () => "127.0.0.1",
  checkRateLimit: async () => true,
  resetRateLimit: async () => undefined,
}));

const { requestSignupLink } = await import("../signup-actions");

const realFetch = globalThis.fetch;
let mailerSendRefuses = true;
const email = `falha-envio-${Date.now()}@gestarahub.test`;

beforeAll(() => {
  vi.stubEnv("MAILERSEND_API_KEY", "teste");
  // Comportamento de producao: em desenvolvimento a recusa cai no terminal e
  // conta como enviada (devDeliveryFallback, commit 600f2b07), o que este teste
  // nao cobre. Sem E2E_NOW, que tambem liga o modo de desenvolvimento.
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("E2E_NOW", undefined);
  // So o MailerSend e simulado; o Supabase local segue de verdade.
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("mailersend.com")) {
      return mailerSendRefuses
        ? new Response(JSON.stringify({ message: "You have reached sandbox account unique recipients limit. #MS42225" }), {
            status: 422,
          })
        : new Response(null, { status: 202 });
    }
    return realFetch(input, init);
  }) as typeof fetch;
});

afterEach(() => {
  mailerSendRefuses = true;
});

afterAll(async () => {
  globalThis.fetch = realFetch;
  vi.unstubAllEnvs();
  await adminClient().from("signup_tokens").delete().ilike("email", email);
});

async function pendingLinks(): Promise<number> {
  const { data } = await adminClient().from("signup_tokens").select("id").ilike("email", email).eq("status", "pending");
  return data?.length ?? 0;
}

describe("cadastro com o MailerSend recusando", () => {
  it("responde erro, não deixa link pendente e a nova tentativa não diz 'já enviado'", async () => {
    const first = await requestSignupLink({ name: "Teste Falha", email, forceResend: false });
    expect(first.status).toBe("error");
    expect(await pendingLinks()).toBe(0);

    const second = await requestSignupLink({ name: "Teste Falha", email, forceResend: false });
    expect(second.status).toBe("error");
  });

  it("reenvio que falha mantém o link anterior valendo", async () => {
    mailerSendRefuses = false;
    expect((await requestSignupLink({ name: "Teste Falha", email, forceResend: false })).status).toBe("sent");
    expect(await pendingLinks()).toBe(1);

    mailerSendRefuses = true;
    expect((await requestSignupLink({ name: "Teste Falha", email, forceResend: true })).status).toBe("error");
    expect(await pendingLinks()).toBe(1);

    mailerSendRefuses = false;
    expect((await requestSignupLink({ name: "Teste Falha", email, forceResend: true })).status).toBe("sent");
    expect(await pendingLinks()).toBe(1);
  });
});
