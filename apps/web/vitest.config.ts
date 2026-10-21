import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testes da camada de services (regras de negocio sobre o store mock), em Node.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Os *.db.test.ts rodam contra o Supabase local (vitest.db.config.ts).
    exclude: ["src/**/*.db.test.ts", "node_modules/**"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
