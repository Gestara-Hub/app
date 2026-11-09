import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

// O espaco da demonstracao e criado no Supabase local pelos fixtures do e2e: as
// chaves vem do .env.local (sem imprimir), e os cookies vao para a porta 3000.
const ENV_FILE = resolve(__dirname, "../../.env.local");
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim().replace(/^"|"$/g, "");
  }
}
process.env.E2E_PORT ??= "3000";

// Captura as telas reais do app usadas na landing (secao "Por dentro").
// Precisa do `pnpm dev` na porta 3000 e do Supabase local. Rodar a partir de apps/web:
//   npx playwright test --config=scripts/landing-screenshots/playwright.config.ts
export default defineConfig({
  testDir: ".",
  workers: 1,
  timeout: 180_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3200",
    channel: "chrome",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  },
});
