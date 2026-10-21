import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/** `pnpm demo:seed`: recria a demonstracao no Supabase local (scripts/demo). */
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["scripts/demo/*.seed.ts"],
    env: loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), ""),
  },
}));
