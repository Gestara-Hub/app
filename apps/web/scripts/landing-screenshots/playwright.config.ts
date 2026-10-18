import { defineConfig } from "@playwright/test";

// Captura as telas reais do app usadas na landing (secao "Por dentro").
// Precisa do `pnpm dev` na porta 3000. Rodar a partir de apps/web:
//   npx playwright test --config=scripts/landing-screenshots/playwright.config.ts
export default defineConfig({
  testDir: ".",
  workers: 1,
  timeout: 180_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    channel: "chrome",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  },
});
