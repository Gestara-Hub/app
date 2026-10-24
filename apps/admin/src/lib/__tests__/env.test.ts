import { afterEach, describe, expect, it, vi } from "vitest";

const BASE = {
  PLATFORM_DATABASE_URL: "postgresql://platform_app:senha@127.0.0.1:54322/postgres",
  ADMIN_SESSION_SECRET: "s".repeat(40),
};

async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "PLATFORM_DATABASE_URL", "ADMIN_SESSION_SECRET", "ADMIN_ENV_LABEL"]) {
    vi.stubEnv(key, env[key] ?? "");
  }
  return (await import("../server/env")).getEnv();
}

afterEach(() => vi.unstubAllEnvs());

describe("configuração do painel", () => {
  it("no local, usa o Supabase local por padrão e o ambiente 'local'", async () => {
    const env = await load(BASE);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
    expect(env.ADMIN_ENV_LABEL).toBe("local");
  });

  it("sem a conexão do painel ou com segredo curto, para com o nome da variável (nunca o valor)", async () => {
    await expect(load({ ADMIN_SESSION_SECRET: BASE.ADMIN_SESSION_SECRET })).rejects.toThrow(/PLATFORM_DATABASE_URL/);
    const error = await load({ ...BASE, ADMIN_SESSION_SECRET: "curto" }).catch((e: Error) => e);
    expect(String(error)).toMatch(/ADMIN_SESSION_SECRET/);
    expect(String(error)).not.toContain("curto");
  });

  it("recusa ambiente fora de local, staging e production", async () => {
    await expect(load({ ...BASE, ADMIN_ENV_LABEL: "dev" })).rejects.toThrow(/ADMIN_ENV_LABEL/);
  });
});
