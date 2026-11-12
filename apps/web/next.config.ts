import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import type { NextConfig } from "next";
import { isAsaasSandboxUrl } from "./src/lib/payments-test-mode";
import { contentSecurityPolicy } from "./src/lib/security/content-security-policy";

/**
 * IPs deste computador na rede local (10/11/2026): o celular abre o `pnpm dev`
 * por `http://<ip>:3200` e o Next so aceita origens listadas. Lido a cada
 * subida do servidor, entao trocar de Wi-Fi ou de IP nao bloqueia mais.
 */
function localNetworkIps(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal)
    .map((net) => net!.address);
}

/**
 * Versao do app (doc technical/27): a de `package.json`, marcada por
 * `pnpm release:prepare` (data, ex.: 2026.11.10), e o commit do build (Vercel,
 * ou o git local). Vao para a tela de Novidades e para o registro de erros.
 */
function appVersion(): string {
  try {
    return (JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version?: string }).version ?? "dev";
  } catch {
    return "dev";
  }
}

function appCommit(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  if (fromVercel) return fromVercel;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  // Servidor dos testes do navegador em outra porta usa outra pasta de build,
  // para nao brigar com o `pnpm dev` aberto na 3000 (ver playwright.config).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Pacotes de workspace consumidos como fonte TS (sem build separado).
  transpilePackages: ["@gestarahub/contracts", "@gestarahub/core"],
  // PDF dos documentos: o @react-pdf roda no Node, fora do bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
  // A logo de reserva (public/documents) e lida do disco pelas rotas de documento.
  outputFileTracingIncludes: {
    "/api/documents/**": ["./public/documents/**"],
    "/p/**": ["./public/documents/**"],
  },
  // Botoes de simular pagamento so com o Asaas de testes (lib/payments-test-mode).
  env: {
    NEXT_PUBLIC_PAYMENTS_TEST_MODE: isAsaasSandboxUrl(process.env.ASAAS_API_URL) ? "1" : "0",
    NEXT_PUBLIC_APP_VERSION: appVersion(),
    NEXT_PUBLIC_APP_COMMIT: appCommit(),
  },
  // Esconde o indicador flutuante do Next em dev.
  devIndicators: false,
  allowedDevOrigins: [
    ...localNetworkIps(),
    "*.trycloudflare.com",
    "pontiac-permission-silicon-namespace.trycloudflare.com",
    "*.loca.lt",
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          // So em producao: no `pnpm dev` (http) o navegador nao deve guardar
          // "sempre https" para o localhost, senao links locais abrem em https e falham.
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            // Camera so do proprio site: leitor de ingressos do evento (doc product/29 T6, 12/11/2026).
            value: "camera=(self), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy({
              isDev: process.env.NODE_ENV === "development",
              supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
              posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST,
            }),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
