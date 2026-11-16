import { defineConfig } from "@playwright/test";

// Testes de ponta a ponta do painel admin, no navegador, contra o Supabase local.
// Porta 3101 com pasta de build propria: o `pnpm dev:admin` (3001) fica livre e
// nao briga pelo mesmo `.next`. Um teste por vez: os cenarios criam administradores
// e espacos de teste no mesmo banco (limpos no fim). Rodar so quando pedido:
//   pnpm --filter @gestarahub/admin e2e
const PORT = Number(process.env.E2E_PORT ?? 3101);
const BASE_URL = `http://localhost:${PORT}`;
const PROD_SERVER = process.env.E2E_SERVER === "prod";
// Sem e-mail de verdade (chaves AWS vazias): o painel mostra o link do convite na tela.
const E2E_ENV = "AWS_ACCESS_KEY_ID= AWS_SECRET_ACCESS_KEY= ADMIN_NOTIFY_EMAIL=";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    channel: "chrome",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Cada tela é conferida em desktop e em celular dentro do próprio teste (setViewportSize).
  projects: [{ name: "painel", use: { viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: PROD_SERVER
      ? `${E2E_ENV} NEXT_DIST_DIR=.next-e2e-prod sh -c "npx next build && npx next start -p ${PORT}"`
      : `${E2E_ENV} NEXT_DIST_DIR=.next-e2e npx next dev -p ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: true,
    timeout: PROD_SERVER ? 600_000 : 120_000,
  },
});
