import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ownerSql } from "./db";
import { collectErrors, makeAdmin, makeSpace, signedInContext, type E2eAdmin } from "./helpers";

/**
 * Protocolo das conversas do suporte (GH-n): a busca acha pelo protocolo, a linha da lista e a página
 * da conversa mostram o número. Os dados entram direto no banco (marca E2E).
 */
let admin: E2eAdmin;
let context: BrowserContext;
let page: Page;
let errors: string[];
const tag = Date.now().toString(36);
const data: { thread?: string; number?: number; subject?: string } = {};

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  test.setTimeout(240_000);
  admin = await makeAdmin("platform_owner", "E2E Dono do Protocolo");
  const space = await makeSpace(`Protocolo ${tag}`);
  data.subject = `Protocolo E2E ${tag}`;
  const owner = ownerSql();
  try {
    const [thread] = await owner<{ id: string }[]>`
      select public.support_open_thread(${space}, 'user-e2e', 'Bia Protocolo', 'bia@e2e.gestarahub.local', null, ${data.subject}, 'Mensagem de teste E2E', '/clients', null, 'free') as id`;
    data.thread = thread.id;
    await owner`update platform.support_threads set status = 'waiting_us' where id = ${thread.id}`;
    const [row] = await owner<{ number: number }[]>`select number from platform.support_threads where id = ${thread.id}`;
    data.number = row.number;
  } finally {
    await owner.end();
  }
  ({ context, page } = await signedInContext(browser, admin));
  errors = collectErrors(page);
});

test.afterAll(async () => {
  await context?.close();
});

test.beforeEach(() => {
  errors.length = 0;
});
test.afterEach(() => {
  expect(errors, errors.join("\n")).toEqual([]);
});

test("suporte: buscar pelo protocolo acha a conversa e a linha mostra o número", async () => {
  const protocol = `GH-${data.number}`;
  await page.goto(`/support?filter=all&q=${encodeURIComponent(protocol)}`);
  const row = page.getByRole("link", { name: new RegExp(data.subject!) });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row).toContainText(protocol);
  await expect(page.getByPlaceholder("Buscar protocolo, espaço, pessoa ou assunto")).toHaveValue(protocol);

  // Só o número, sem o prefixo, também acha.
  await page.goto(`/support?filter=all&q=${data.number}`);
  await expect(page.getByRole("link", { name: new RegExp(data.subject!) })).toBeVisible();

  // Um protocolo que não existe não acha nada.
  await page.goto(`/support?filter=all&q=GH-${data.number! + 900000}`);
  await expect(page.getByText("Nenhuma conversa com esses filtros")).toBeVisible();
});

test("suporte: a página da conversa mostra o protocolo", async () => {
  await page.goto(`/support/${data.thread}`);
  await expect(page.getByRole("heading", { name: data.subject! })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(`GH-${data.number}`).first()).toBeVisible();
  await expect(page).toHaveTitle(new RegExp(`GH-${data.number}`));
});
