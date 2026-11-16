import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient } from "@/test/db";

/**
 * E-mail que nao sai nao pode virar "enviado": o Amazon SES recusa (ex.:
 * destinatario nao verificado em Sandbox) e nada fica valendo nem pendente.
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
let sesRefuses = true;
const email = `falha-envio-${Date.now()}@gestarahub.test`;

beforeAll(() => {
  vi.stubEnv("AWS_ACCESS_KEY_ID", "teste");
  vi.stubEnv("AWS_SECRET_ACCESS_KEY", "segredo");
  vi.stubEnv("AWS_SES_REGION", "us-east-2");
  // Comportamento de producao: em desenvolvimento a recusa cai no terminal e
  // conta como enviada (devDeliveryFallback, commit 600f2b07), o que este teste
  // nao cobre. Sem E2E_NOW, que tambem liga o modo de desenvolvimento.
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("E2E_NOW", undefined);
  // So o Amazon SES e simulado; o Supabase local segue de verdade.
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("amazonaws.com/v2/email/outbound-emails")) {
      return sesRefuses
        ? new Response(JSON.stringify({ message: "Email address is not verified." }), {
            status: 400,
            headers: { "x-amzn-errortype": "MessageRejectedException" },
          })
        : new Response(JSON.stringify({ MessageId: "ses-test-id" }), { status: 200 });
    }
    return realFetch(input, init);
  }) as typeof fetch;
});

afterEach(() => {
  sesRefuses = true;
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

describe("cadastro com o Amazon SES recusando", () => {
  it("responde erro, não deixa link pendente e a nova tentativa não diz 'já enviado'", async () => {
    const first = await requestSignupLink({ name: "Teste Falha", email, forceResend: false });
    expect(first.status).toBe("error");
    expect(await pendingLinks()).toBe(0);

    const second = await requestSignupLink({ name: "Teste Falha", email, forceResend: false });
    expect(second.status).toBe("error");
  });

  it("reenvio que falha mantém o link anterior valendo", async () => {
    sesRefuses = false;
    expect((await requestSignupLink({ name: "Teste Falha", email, forceResend: false })).status).toBe("sent");
    expect(await pendingLinks()).toBe(1);

    sesRefuses = true;
    expect((await requestSignupLink({ name: "Teste Falha", email, forceResend: true })).status).toBe("error");
    expect(await pendingLinks()).toBe(1);

    sesRefuses = false;
    expect((await requestSignupLink({ name: "Teste Falha", email, forceResend: true })).status).toBe("sent");
    expect(await pendingLinks()).toBe(1);
  });
});
