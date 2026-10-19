import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Servidor dos testes do navegador em outra porta usa outra pasta de build,
  // para nao brigar com o `pnpm dev` aberto na 3000 (ver playwright.config).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Pacotes de workspace consumidos como fonte TS (sem build separado).
  transpilePackages: ["@gestarahub/contracts", "@gestarahub/core"],
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
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
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
        ],
      },
    ];
  },
};

export default nextConfig;
