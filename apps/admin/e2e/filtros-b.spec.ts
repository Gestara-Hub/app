import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ownerSql } from "./db";
import { cleanupAll, collectErrors, makeAdmin, signedInContext, E2E_DOMAIN, type E2eAdmin } from "./helpers";

/**
 * Filtros e paginação de LGPD, Comunicados e Respostas prontas: página 2, busca, tipo, importância e público.
 * Os dados são criados direto no banco com a marca E2E (a limpeza geral apaga).
 */
let admin: E2eAdmin;
let context: BrowserContext;
let page: Page;
let errors: string[];
const tag = Date.now().toString(36);
const pad = (n: number) => String(n).padStart(2, "0");

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  test.setTimeout(240_000);
  admin = await makeAdmin("platform_owner", "E2E Dono dos Filtros B");
  const owner = ownerSql();
  try {
    for (let i = 1; i <= 27; i++) {
      await owner`
        insert into platform.privacy_requests (requester_name, requester_email, kind, description, status, due_at, created_by_name)
        values (${`E2E Titular ${tag} ${pad(i)}`}, ${`titular-${tag}-${pad(i)}@${E2E_DOMAIN}`}, ${i > 25 ? "deletion" : "access"}, ${`Pedido de teste ${tag}`}, 'open', now() + make_interval(hours => ${i}::int), 'E2E Filtros')`;
    }
    for (let i = 1; i <= 27; i++) {
      const severity = i > 24 ? "urgent" : i > 22 ? "warning" : "info";
      const audience = i <= 2 ? "tier" : "all";
      await owner`
        insert into platform.announcements (title, body, severity, audience, audience_filter, starts_at, created_at, created_by_name)
        values (${`E2E Comunicado ${tag} ${pad(i)}`}, 'Corpo de teste', ${severity}, ${audience}, ${owner.json((audience === "tier" ? { tiers: ["pro"] } : {}) as never)},
                '2020-01-01', now() + make_interval(mins => ${i}::int), 'E2E Filtros')`;
    }
    await owner`insert into platform.support_macros (title, body) values (${`E2E Macro ${tag} boas-vindas`}, 'Olá! Seja bem-vindo.'), (${`E2E Macro ${tag} reembolso`}, 'Sobre o estorno do valor pago.'), (${`E2E Macro ${tag} senha`}, 'Use o link de recuperação.')`;
  } finally {
    await owner.end();
  }
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

const pickOption = async (label: string, option: string) => {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

test("LGPD: pagina, busca e filtra por tipo", async () => {
  await page.goto(`/privacy?q=${encodeURIComponent(`Titular ${tag}`)}`);
  await expect(page.getByText(/Mostrando 1 a 25 de 27 pedidos/)).toBeVisible();
  await expect(page.getByText("Página 1 de 2")).toBeVisible();
  await expect(page.getByText(`E2E Titular ${tag} 01`)).toBeVisible();
  await expect(page.getByText(`E2E Titular ${tag} 27`)).toHaveCount(0);
  await page.getByRole("link", { name: "Próxima" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText(/Mostrando 26 a 27 de 27 pedidos/)).toBeVisible();
  await expect(page.getByText(`E2E Titular ${tag} 27`)).toBeVisible();
  await page.getByRole("link", { name: "Anterior" }).click();
  await expect(page.getByText("Página 1 de 2")).toBeVisible();

  // Tipo: trocar o filtro volta para a página 1.
  await pickOption("Filtrar por tipo de pedido", "Exclusão de dados");
  await expect(page).toHaveURL(/kind=deletion/);
  await expect(page).not.toHaveURL(/page=/);
  await expect(page.getByText(`E2E Titular ${tag} 26`)).toBeVisible();
  await expect(page.getByText(`E2E Titular ${tag} 27`)).toBeVisible();
  await expect(page.getByText(`E2E Titular ${tag} 01`)).toHaveCount(0);

  // Busca por e-mail e filtro vazio com "Limpar filtros".
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page.getByLabel("Buscar pedidos").fill(`titular-${tag}-05@`);
  await expect(page.getByText(`E2E Titular ${tag} 05`)).toBeVisible();
  await expect(page.getByText(`E2E Titular ${tag} 06`)).toHaveCount(0);
  await page.getByLabel("Buscar pedidos").fill("zzzz-nada-assim");
  await expect(page.getByText("Nenhum pedido para este filtro")).toBeVisible();
});

test("LGPD: página acima do total mostra a última e valores inválidos viram sem filtro", async () => {
  await page.goto(`/privacy?q=${encodeURIComponent(`Titular ${tag}`)}&page=99&kind=invalido`);
  await expect(page.getByText("Página 2 de 2")).toBeVisible();
  await expect(page.getByText(`E2E Titular ${tag} 27`)).toBeVisible();
});

test("Comunicados: página 2, importância e público", async () => {
  const q = encodeURIComponent(`Comunicado ${tag}`);
  await page.goto(`/announcements?q=${q}`);
  await expect(page.getByText(/Mostrando 1 a 25 de 27 comunicados/)).toBeVisible();
  await expect(page.getByText("Página 1 de 2")).toBeVisible();
  // Mais recente primeiro: o 27 está na primeira página, o 01 na segunda.
  await expect(page.getByText(`E2E Comunicado ${tag} 27`)).toBeVisible();
  await expect(page.getByText(`E2E Comunicado ${tag} 01`)).toHaveCount(0);
  await page.getByRole("link", { name: "Próxima" }).click();
  await expect(page.getByText(`E2E Comunicado ${tag} 01`)).toBeVisible();
  await expect(page.getByText(/Mostrando 26 a 27 de 27 comunicados/)).toBeVisible();

  await pickOption("Filtrar por importância", "Urgente");
  await expect(page).toHaveURL(/severity=urgent/);
  await expect(page).not.toHaveURL(/page=/);
  await expect(page.getByText(/3 comunicados/)).toBeVisible();
  await expect(page.getByText(`E2E Comunicado ${tag} 27`)).toBeVisible();
  await expect(page.getByText(`E2E Comunicado ${tag} 20`)).toHaveCount(0);

  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page.getByLabel("Buscar comunicados").fill(`Comunicado ${tag}`);
  await pickOption("Filtrar por público", "Por plano");
  await expect(page).toHaveURL(/audience=tier/);
  await expect(page.getByText(/2 comunicados/)).toBeVisible();
  await expect(page.getByText(`E2E Comunicado ${tag} 02`)).toBeVisible();
  await expect(page.getByText(`E2E Comunicado ${tag} 03`)).toHaveCount(0);

  await pickOption("Filtrar por importância", "Atenção");
  await expect(page.getByText("Nenhum comunicado para este filtro")).toBeVisible();
});

test("Respostas prontas: busca no título e no texto", async () => {
  await page.goto("/support/macros");
  await page.getByLabel("Buscar respostas prontas").fill(`Macro ${tag}`);
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByText(/3 respostas prontas/)).toBeVisible();
  await page.getByLabel("Buscar respostas prontas").fill("estorno do valor");
  await expect(page.getByText(`E2E Macro ${tag} reembolso`)).toBeVisible();
  await expect(page.getByText(`E2E Macro ${tag} senha`)).toHaveCount(0);
  await page.getByLabel("Buscar respostas prontas").fill("zzzz-nada-assim");
  await expect(page.getByText("Nenhuma resposta para esta busca")).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page).not.toHaveURL(/q=/);
});
