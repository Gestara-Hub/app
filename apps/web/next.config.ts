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
};

export default nextConfig;
