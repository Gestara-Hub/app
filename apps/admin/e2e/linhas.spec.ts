import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ownerSql } from "./db";
import { cleanupAll, collectErrors, makeAdmin, makeSpace, signedInContext, type E2eAdmin } from "./helpers";

/**
 * Linha inteira clicável: nas listas que levam a uma tela de detalhe, clicar em qualquer ponto da
 * linha abre o detalhe (como em Suporte), e o menu ⋮ da linha continua funcionando por cima.
 */
let admin: E2eAdmin;
let context: BrowserContext;
let page: Page;
let errors: string[];
const tag = Date.now().toString(36);
const data: { space?: string; thread?: string; error?: string; announcement?: string; spaceName?: string; errorMessage?: string; subject?: string; title?: string } = {};

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  test.setTimeout(240_000);
  admin = await makeAdmin("platform_owner", "E2E Dono das Linhas");
  data.spaceName = `Linhas ${tag}`;
  data.space = await makeSpace(data.spaceName);
  data.subject = `Dúvida das linhas ${tag}`;
  data.errorMessage = `Erro das linhas ${tag}`;
  data.title = `E2E Aviso das linhas ${tag}`;
  const owner = ownerSql();
  try {
    const [thread] = await owner<{ id: string }[]>`
      select public.support_open_thread(${data.space}, 'user-e2e', 'Cris Linhas', 'cris@e2e.gestarahub.local', null, ${data.subject}, 'Preciso de ajuda', '/clients', null, 'free') as id`;
    data.thread = thread.id;
    const [error] = await owner<{ id: string }[]>`
      insert into public.error_logs (organization_id, fingerprint, source, event, message, count, last_reference)
      values (${data.space}, ${`e2e-linhas-${tag}`}, 'server', 'linhas.teste', ${data.errorMessage}, 1, 'E2ELIN01') returning id`;
    data.error = error.id;
    const [announcement] = await owner<{ id: string }[]>`
      insert into platform.announcements (title, body, severity, audience, audience_filter, starts_at, created_by_name)
      values (${data.title}, 'Corpo de teste', 'info', 'all', ${owner.json({} as never)}, '2020-01-01', 'E2E Linhas') returning id`;
    data.announcement = announcement.id;
  } finally {
    await owner.end();
  }
  ({ context, page } = await signedInContext(browser, admin));
  errors = collectErrors(page);
});

test.afterAll(async () => {
  await cleanupAll();
  await context?.close();
});

test.beforeEach(() => {
  errors.length = 0;
});
test.afterEach(() => {
  expect(errors, errors.join("\n")).toEqual([]);
});

/** Clica no canto direito da linha, longe de qualquer texto ou link (só a linha esticada pega o clique). */
async function clickRowBlankArea(page: Page, text: string) {
  const row = page.locator(".list-stagger > *", { hasText: text }).first();
  await expect(row).toBeVisible();
  const box = (await row.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.62, box.y + box.height - 6);
}

test("espaços: clicar em qualquer ponto da linha abre a ficha, e o ⋮ continua abrindo o menu", async () => {
  await page.goto(`/spaces?q=${encodeURIComponent(data.spaceName!)}`);
  await page.getByRole("button", { name: new RegExp(`Ações de ${data.spaceName}|Ações.*${data.spaceName}`) }).click();
  await expect(page.getByRole("menuitem").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await clickRowBlankArea(page, data.spaceName!);
  await expect(page).toHaveURL(new RegExp(`/spaces/${data.space}`));
});

test("saúde: clicar em qualquer ponto da linha do erro abre o detalhe", async () => {
  await page.goto(`/health?q=${encodeURIComponent(data.errorMessage!)}`);
  await clickRowBlankArea(page, data.errorMessage!);
  await expect(page).toHaveURL(new RegExp(`/health/errors/${data.error}`));
});

test("comunicados: clicar em qualquer ponto da linha abre a edição", async () => {
  await page.goto(`/announcements?q=${encodeURIComponent(data.title!)}`);
  await clickRowBlankArea(page, data.title!);
  await expect(page).toHaveURL(new RegExp(`/announcements/${data.announcement}`));
});

test("planos: a linha de espaços por plano leva à lista filtrada", async () => {
  await page.goto("/plans");
  const row = page.locator(".list-stagger > *", { hasText: /Grátis/ }).first();
  const box = (await row.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
  await expect(page).toHaveURL(/\/spaces\?tier=free/);
});

test("ficha do espaço: a conversa e o erro abrem inteiros no clique da linha", async () => {
  await page.goto(`/spaces/${data.space}?tab=suporte`);
  await clickRowBlankArea(page, data.subject!);
  await expect(page).toHaveURL(new RegExp(`/support/${data.thread}`));
  await page.goto(`/spaces/${data.space}?tab=saude`);
  await clickRowBlankArea(page, data.errorMessage!);
  await expect(page).toHaveURL(new RegExp(`/health/errors/${data.error}`));
});
