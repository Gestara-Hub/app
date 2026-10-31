import type { NextConfig } from "next";
import { isAsaasSandboxUrl } from "./src/lib/payments-test-mode";
import { contentSecurityPolicy } from "./src/lib/security/content-security-policy";

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
  },
  // Esconde o indicador flutuante do Next em dev.
  devIndicators: false,
  allowedDevOrigins: ["192.168.1.2"],
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
            value: "camera=(), microphone=(), geolocation=()",
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
