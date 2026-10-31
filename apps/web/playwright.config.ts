import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Os fixtures criam espacos no Supabase local (doc 15, fatia 5): as chaves vem
// do .env.local (sem imprimir), como no `pnpm dev`.
const ENV_FILE = resolve(__dirname, ".env.local");
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim().replace(/^"|"$/g, "");
  }
}

// Porta do app nos testes: 3100, servidor proprio (pasta de build separada) com
// a mesma data fixa do navegador (E2E_NOW), porque as regras rodam no servidor.
// A 3000 fica livre para o `pnpm dev`.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;
const PROD_SERVER = process.env.E2E_SERVER === "prod";
// Meta vazia: o e2e conecta o WhatsApp oficial pelo telefone do espaco, sem a janela da
// Meta, e o envio "oficial" e o simulado (nunca a API de verdade, com numeros de teste).
const E2E_ENV =
  "E2E_NOW=2026-09-22T12:00:00-03:00 ASAAS_API_KEY= MAILERSEND_API_KEY= NEXT_PUBLIC_POSTHOG_KEY= NEXT_PUBLIC_META_APP_ID= NEXT_PUBLIC_META_CONFIG_ID= WHATSAPP_API_TOKEN= WHATSAPP_PHONE_NUMBER_ID=";

// Testes de ponta a ponta no navegador. Usa o Chrome instalado na maquina
// (sem download de navegador) e reaproveita o servidor da 3100 se ja estiver no ar.
export default defineConfig({
  testDir: "./e2e",
  // Apaga sobras de rodadas interrompidas antes de comecar (ids fixos nos cenarios).
  globalSetup: "./e2e/global-setup.ts",
  // Um teste por vez: os cenarios usam ids fixos (ex.: "m-jj") no mesmo banco.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // Cada tela le e grava no banco pelo servidor de desenvolvimento, que compila a
  // rota na primeira visita: 5 s nao bastam para a navegacao e o retorno.
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
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    // Chaves vazias: gateway simulado, sem e-mail e sem PostHog (Asaas, MailerSend e analise de verdade, nunca).
    // E2E_SERVER=prod: build de producao e `next start` (rodadas grandes: sem compilar
    // rota na primeira visita, menos falha instavel; doc 20). Padrao: `next dev`.
    command: PROD_SERVER
      ? `${E2E_ENV} NEXT_DIST_DIR=.next-e2e-prod sh -c "npx next build && npx next start -p ${PORT}"`
      : `${E2E_ENV} NEXT_DIST_DIR=.next-e2e npx next dev -p ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: true,
    // O build de producao leva alguns minutos na primeira vez.
    timeout: PROD_SERVER ? 600_000 : 120_000,
  },
});
