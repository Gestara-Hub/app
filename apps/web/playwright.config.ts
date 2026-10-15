import { defineConfig, devices } from "@playwright/test";

// Porta do app nos testes. Padrao 3000 (reaproveita o `pnpm dev`). Com
// E2E_PORT=3100 (ou outra), o Playwright sobe um servidor proprio nessa porta,
// com pasta de build separada, e a 3000 fica livre para uso manual.
const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;

// Testes de ponta a ponta no navegador. Usa o Chrome instalado na maquina
// (sem download de navegador) e reaproveita o `pnpm dev` se ja estiver no ar.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    channel: "chrome",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    command: PORT === 3000 ? "pnpm dev" : `NEXT_DIST_DIR=.next-e2e npx next dev -p ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
