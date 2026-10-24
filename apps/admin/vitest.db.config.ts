import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Testes contra o Supabase local: o schema `platform`, o papel `platform_app` e o
 * isolamento entre o painel e o app dos clientes. Precisa do `pnpm admin:setup`.
 * Nenhuma chave e impressa.
 */
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    env: loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), ""),
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
}));
