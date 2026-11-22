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
    env: withoutRealSenders(loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "")),
    // Um arquivo por vez: os testes criam e apagam espacos no mesmo banco.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
}));

/**
 * Sem envio de verdade nos testes (22/11/2026): com as chaves do SES do
 * .env.local, um teste que ativava o plano mandou e-mail real para um
 * endereco @gestarahub.test, e o SES registrou devolucao (pesa na reputacao
 * da conta). Sem as chaves, o envio cai no modo de desenvolvimento.
 */
function withoutRealSenders(env: Record<string, string>): Record<string, string> {
  const blocked = new Set(["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]);
  return Object.fromEntries(Object.entries(env).filter(([key]) => !blocked.has(key)));
}
