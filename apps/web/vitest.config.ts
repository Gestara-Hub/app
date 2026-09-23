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
    setupFiles: ["./src/test/setup.ts"],
  },
});
