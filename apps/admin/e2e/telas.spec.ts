import { mkdirSync } from "node:fs";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ownerSql } from "./db";
import { collectErrors, expectNoHorizontalScroll, makeAdmin, makeSpace, signedInContext, type E2eAdmin } from "./helpers";

/**
 * Passada de telas do proprietário: cada tela abre sem erro (HTTP, console, página),
 * tem título, não rola para o lado e é fotografada em desktop e celular
 * (test-results/telas). Os dados vêm de um espaço, uma conversa e um erro de teste.
 */
const SHOTS = "test-results/telas";
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "celular", width: 390, height: 844 },
] as const;

let admin: E2eAdmin;
let context: BrowserContext;
let page: Page;
const ids: { space?: string; thread?: string; error?: string; announcement?: string } = {};

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  // A primeira visita compila a rota no servidor de desenvolvimento.
  test.setTimeout(240_000);
  mkdirSync(SHOTS, { recursive: true });
  admin = await makeAdmin("platform_owner", "E2E Proprietário");
  ids.space = await makeSpace("Academia das Telas");
  const owner = ownerSql();
  try {
    const [thread] = await owner<{ id: string }[]>`
      select public.support_open_thread(${ids.space}, 'user-e2e', 'Ana Teste', 'ana@e2e.gestarahub.local', null, 'Como pauso um aluno', 'Preciso pausar um aluno', '/clients', null, 'free') as id`;
    ids.thread = thread.id;
    const [error] = await owner<{ id: string }[]>`
      insert into public.error_logs (organization_id, fingerprint, source, event, message, count, last_reference)
      values (${ids.space}, ${`e2e-${Date.now()}`}, 'server', 'turmas.markAttendance', 'Falha ao marcar presença', 2, 'E2ETEST1') returning id`;
    ids.error = error.id;
  } finally {
    await owner.end();
  }
  ({ context, page } = await signedInContext(browser, admin));
});

test.afterAll(async () => {
  await context?.close();
});

const SPACE_TABS = ["resumo", "assinatura", "saude", "recebimentos", "suporte", "auditoria", "dados"];

function routes(): { path: string; title?: RegExp }[] {
  return [
    { path: "/", title: /Olá/ },
    { path: "/support", title: /Suporte/ },
    { path: "/support/help", title: /ajuda/i },
    { path: "/support/macros", title: /Respostas prontas/ },
    { path: `/support/${ids.thread}` },
    { path: "/spaces", title: /Espaços/ },
    ...SPACE_TABS.map((tab) => ({ path: `/spaces/${ids.space}?tab=${tab}` })),
    { path: "/plans", title: /Planos/ },
    { path: "/revenue", title: /Receita/ },
    { path: "/health", title: /Saúde/ },
    { path: "/health?tab=rotinas" },
    { path: "/health?tab=avisos" },
    { path: "/health?tab=integracoes" },
    { path: `/health/errors/${ids.error}` },
    { path: "/announcements", title: /Comunicados/ },
    { path: "/announcements/new" },
    { path: "/team", title: /Equipe/ },
    { path: "/privacy", title: /LGPD/ },
    { path: "/audit", title: /Auditoria/ },
  ];
}

for (const viewport of VIEWPORTS) {
  test(`todas as telas abrem limpas em ${viewport.name}`, async () => {
    test.setTimeout(600_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const errors = collectErrors(page);
    const problems: string[] = [];
    for (const route of routes()) {
      const before = errors.length;
      const response = await page.goto(route.path, { waitUntil: "load" });
      const status = response?.status() ?? 0;
      if (status >= 400) problems.push(`${route.path}: HTTP ${status}`);
      if (new URL(page.url()).pathname !== new URL(route.path, "http://x").pathname) problems.push(`${route.path}: redirecionou para ${page.url()}`);
      const heading = page.locator("h1").first();
      if (!(await heading.isVisible().catch(() => false))) problems.push(`${route.path}: sem título (h1)`);
      else if (route.title && !route.title.test((await heading.innerText()).trim())) problems.push(`${route.path}: título "${(await heading.innerText()).trim()}" não bate com ${route.title}`);
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 1) problems.push(`${route.path}@${viewport.name}: rolagem horizontal de ${overflow}px`);
      if (errors.length > before) problems.push(`${route.path}: ${errors.slice(before).join(" | ")}`);
      const slug = route.path.replace(ids.space ?? "", "espaco").replace(ids.thread ?? "", "conversa").replace(ids.error ?? "", "erro").replace(/\W+/g, "_");
      await page.screenshot({ path: `${SHOTS}/${slug}-${viewport.name}.png`, fullPage: true });
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}

test("menu do celular abre e fecha", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir ou fechar o menu" }).click();
  await expect(page.getByRole("link", { name: "Espaços" })).toBeVisible();
  await expectNoHorizontalScroll(page, "menu aberto no celular");
  await page.keyboard.press("Escape");
});
