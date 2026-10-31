import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "../content-security-policy";

// CSP de 31/10/2026: a lista de origens e a diferenca entre `pnpm dev` e producao.

const directives = (policy: string) =>
  Object.fromEntries(
    policy.split("; ").map((part) => {
      const [name, ...values] = part.split(" ");
      return [name, values];
    }),
  ) as Record<string, string[]>;

describe("contentSecurityPolicy", () => {
  const prod = directives(
    contentSecurityPolicy({
      isDev: false,
      supabaseUrl: "https://projeto.supabase.co",
      posthogHost: "https://eu.i.posthog.com",
    }),
  );

  it("producao: sem eval, com https forçado e sem abrir dentro de outro site", () => {
    expect(prod["script-src"]).not.toContain("'unsafe-eval'");
    expect(prod["upgrade-insecure-requests"]).toEqual([]);
    expect(prod["frame-ancestors"]).toEqual(["'none'"]);
    expect(prod["object-src"]).toEqual(["'none'"]);
    expect(prod["form-action"]).toEqual(["'self'"]);
  });

  it("libera as origens de fora que o navegador usa", () => {
    expect(prod["connect-src"]).toEqual(
      expect.arrayContaining([
        "https://projeto.supabase.co",
        "wss://projeto.supabase.co",
        "https://eu.i.posthog.com",
        "https://viacep.com.br",
        "https://graph.facebook.com",
      ]),
    );
    expect(prod["script-src"]).toEqual(expect.arrayContaining(["https://connect.facebook.net", "https://eu.i.posthog.com"]));
    // Fontes so do proprio app (o personalizador com Google Fonts saiu em 31/10/2026).
    expect(prod["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(prod["font-src"]).toEqual(["'self'", "data:"]);
    expect(prod["frame-src"]).toEqual(["https://*.facebook.com"]);
  });

  it("pnpm dev: eval e recarga do codigo liberados, sem forçar https", () => {
    const dev = directives(contentSecurityPolicy({ isDev: true, supabaseUrl: "http://127.0.0.1:54321" }));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toEqual(expect.arrayContaining(["ws:", "http://127.0.0.1:54321", "ws://127.0.0.1:54321"]));
    expect(dev["upgrade-insecure-requests"]).toBeUndefined();
    // Sem host configurado, o PostHog padrao.
    expect(dev["connect-src"]).toContain("https://us.i.posthog.com");
  });

  it("endereco invalido nao entra na lista", () => {
    const policy = contentSecurityPolicy({ isDev: false, supabaseUrl: "nao-e-url" });
    expect(policy).not.toContain("nao-e-url");
  });
});
