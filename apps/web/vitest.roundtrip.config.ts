import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Testes de regra com a conferencia de ida e volta pelo banco
 * (src/test/roundtrip-setup.ts): `pnpm test:roundtrip`.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.db.test.ts", "node_modules/**"],
    setupFiles: ["./src/test/setup.ts", "./src/test/roundtrip-setup.ts"],
  },
});
