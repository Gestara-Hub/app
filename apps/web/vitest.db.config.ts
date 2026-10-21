import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Testes contra o Supabase local (doc 15, fatias 2 e 5): as server actions
 * rodam de verdade no banco, com RLS e um espaco criado por teste. Precisa do
 * `pnpm setup:local` antes. As chaves vem do .env.local e nao sao impressas.
 */
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    setupFiles: ["./src/test/db-setup.ts"],
    env: loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), ""),
    // Um arquivo por vez: os testes criam e apagam espacos no mesmo banco.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
}));
