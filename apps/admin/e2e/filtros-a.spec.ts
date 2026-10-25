import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ownerSql } from "./db";
import { cleanupAll, collectErrors, makeAdmin, makeSpace, signedInContext, type E2eAdmin } from "./helpers";

/**
 * Filtros, total e paginação de Espaços, Auditoria e Equipe: o que a pessoa vê no resumo,
 * na página 2 e ao combinar filtros pelo endereço e pelos controles.
 */
let admin: E2eAdmin;
let support: E2eAdmin;
let context: BrowserContext;
let page: Page;
let errors: string[];
const tag = Date.now().toString(36);
const marker = `Filtros ${tag}`;

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  test.setTimeout(300_000);
  admin = await makeAdmin("platform_owner", `E2E Dono Filtros ${tag}`);
  support = await makeAdmin("platform_support", `E2E Apoio Filtros ${tag}`);
  const owner = ownerSql();
  try {
    await owner`update platform.admins set status = 'disabled' where id = ${support.adminId}`;
  } finally {
    await owner.end();
  }
  for (let i = 1; i <= 27; i += 1) await makeSpace(`${marker} ${String(i).padStart(2, "0")}`);
  ({ context, page } = await signedInContext(browser, admin));
  errors = collectErrors(page);
});

test.afterAll(async () => {
  // Os dados em massa (dezenas de linhas) saem aqui, para não empurrar os cenários dos outros arquivos para a página 2.
  await cleanupAll();
  await context?.close();
});

test.beforeEach(() => {
  errors.length = 0;
});
test.afterEach(() => {
  expect(errors, errors.join("\n")).toEqual([]);
});

test("espaços: mostra o total filtrado e a página 2", async () => {
  await page.goto("/spaces");
  await page.getByLabel("Buscar espaços").fill(`E2E ${marker}`);
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByText("Mostrando 1 a 25 de 27 espaços")).toBeVisible();
  await expect(page.getByText("Página 1 de 2")).toBeVisible();
  await page.getByRole("link", { name: "Próxima" }).click();
  await expect(page.getByText("Mostrando 26 a 27 de 27 espaços")).toBeVisible();
  await expect(page.getByText("Página 2 de 2")).toBeVisible();
  // Mudar o filtro volta à primeira página.
  await page.getByLabel("Buscar espaços").fill(`E2E ${marker} 05`);
  await expect(page.getByText("1 espaço", { exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/page=/);
});

test("espaços: página além do fim mostra a última e filtro sem resultado limpa", async () => {
  await page.goto(`/spaces?q=${encodeURIComponent(`E2E ${marker}`)}&page=99`);
  await expect(page.getByText("Mostrando 26 a 27 de 27 espaços")).toBeVisible();
  await page.goto(`/spaces?q=${encodeURIComponent(`nada ${tag}`)}`);
  await expect(page.getByText("Nenhum espaço com esses filtros")).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page).not.toHaveURL(/q=/);
});

test("auditoria: busca, pessoa e período, com a origem da própria máquina", async () => {
  await page.goto("/audit");
  await page.getByLabel("Buscar na auditoria").fill("entrou");
  await expect(page.getByText("Entrou no painel").first()).toBeVisible();
  await expect(page.getByText("Este computador").first()).toBeVisible();
  await expect(page.getByText(/\d+ registros?|Mostrando \d+ a \d+ de \d+ registros/).first()).toBeVisible();

  await page.getByLabel("Pessoa").click();
  await page.getByRole("option", { name: admin.name }).click();
  await expect(page).toHaveURL(/admin=/);
  await expect(page.getByText(admin.name).first()).toBeVisible();

  await page.getByLabel("Período").click();
  await page.getByRole("option", { name: "Hoje" }).click();
  await expect(page).toHaveURL(/period=today/);
  await expect(page.getByText("Entrou no painel").first()).toBeVisible();

  // Datas no passado distante não têm registro.
  await page.getByLabel("Data final").fill("2020-01-01");
  await expect(page.getByText("Nenhum registro com esses filtros")).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page).not.toHaveURL(/admin=|period=|to=/);
});

test("auditoria: endereço com valores inválidos vira sem filtro", async () => {
  await page.goto("/audit?admin=lixo&period=99&from=31/02&space=a%20b&page=-4");
  await expect(page.getByRole("heading", { name: "Auditoria" })).toBeVisible();
  await expect(page.getByText("Entrou no painel").first()).toBeVisible();
});

test("equipe: filtra por papel e por situação", async () => {
  await page.goto("/team");
  // A lista (não o nome da pessoa logada no topo da página).
  const list = page.locator(".list-stagger");
  await expect(list.getByText(support.name)).toBeVisible();
  await page.getByLabel("Buscar na equipe").fill(`Apoio Filtros ${tag}`);
  await expect(page.getByText("1 pessoa", { exact: true })).toBeVisible();
  await expect(list.getByText(admin.name)).toHaveCount(0);

  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page.getByLabel("Papel").click();
  await page.getByRole("option", { name: "Proprietário" }).click();
  await expect(list.getByText(admin.name)).toBeVisible();
  await expect(list.getByText(support.name)).toHaveCount(0);

  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page.getByLabel("Situação").click();
  await page.getByRole("option", { name: "Desativado" }).click();
  await expect(list.getByText(support.name)).toBeVisible();
  await expect(list.getByText(admin.name)).toHaveCount(0);
});
