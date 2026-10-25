import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ownerSql } from "./db";
import { cleanupAll, collectErrors, makeAdmin, makeSpace, signedInContext, type E2eAdmin } from "./helpers";

/**
 * Filtros e paginação de Saúde, Suporte, Planos e Uso da ajuda: total filtrado, "Página N de M",
 * filtros pelo endereço e estado vazio. Os dados entram direto no banco (marca E2E / e2e-filtros-c).
 */
let admin: E2eAdmin;
let context: BrowserContext;
let page: Page;
let errors: string[];
const tag = Date.now().toString(36);
const space: { id?: string; name?: string } = {};

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  test.setTimeout(240_000);
  admin = await makeAdmin("platform_owner", "E2E Dono dos Filtros");
  space.name = `E2E Filtros ${tag}`;
  space.id = await makeSpace(`Filtros ${tag}`);
  const owner = ownerSql();
  try {
    // 27 erros do espaço (3 avisos), para total, página 2 e filtro de nível.
    await owner`
      insert into public.error_logs (organization_id, fingerprint, source, level, event, message)
      select ${space.id}, ${`e2e-filtros-c-${tag}-`}::text || i::text, 'browser', case when i <= 3 then 'warn' else 'error' end, ${`filtros.${tag}`}::text, 'Falha de teste ' || i
        from generate_series(1, 27) i`;
    await owner`
      insert into public.job_runs (job, started_at, finished_at, status, organizations, failures)
      values (${`e2e_filtros_c_${tag}`}, now() - interval '1 hour', now(), 'ok', 1, 0),
             (${`e2e_filtros_c_${tag}`}, now() - interval '2 hours', now(), 'failed', 1, 2),
             (${`e2e_filtros_c_${tag}`}, now() - interval '3 hours', now(), 'ok', 1, 0)`;
    await owner`
      insert into public.webhook_events (provider, event_id, event, organization_id, status, outcome, received_at)
      values ('asaas', ${`e2e-filtros-c-${tag}-1`}, ${`PAYMENT_E2EFILTROS_${tag}`}, ${space.id}, 'processed', 'ok', now() - interval '1 hour'),
             ('asaas', ${`e2e-filtros-c-${tag}-2`}, ${`PAYMENT_E2EFILTROS_${tag}`}, ${space.id}, 'failed', 'erro', now() - interval '20 days')`;
    // Conversas: uma urgente nova, uma normal parada há 20 dias.
    for (const [subject, urgent, ageDays] of [
      [`Urgente filtros ${tag}`, true, 0],
      [`Parada filtros ${tag}`, false, 20],
    ] as const) {
      const [thread] = await owner<{ id: string }[]>`
        select public.support_open_thread(${space.id}, 'user-e2e-filtros', 'Bia Filtros', 'bia@e2e.gestarahub.local', null, ${subject}, 'Texto', '/clients', null, 'free') as id`;
      await owner`update platform.support_threads set status = 'waiting_us', urgent = ${urgent},
                    last_message_at = now() - ${`${ageDays} days`}::interval, last_customer_message_at = now() - ${`${ageDays} days`}::interval where id = ${thread.id}`;
    }
    // Concessões: 2 cortesias e 1 voltou ao Grátis.
    await owner`
      insert into platform.plan_grants (organization_id, kind, tier, starts_on, ends_on, days, reason, granted_by_name)
      values (${space.id}, 'courtesy', 'pro', current_date, current_date + 10, 10, 'Cortesia um de teste', 'E2E'),
             (${space.id}, 'courtesy', 'pro', current_date, current_date + 10, 10, 'Cortesia dois de teste', 'E2E'),
             (${space.id}, 'forced_free', null, current_date, null, null, 'Voltou ao Grátis de teste', 'E2E')`;
    // Buscas da ajuda sem resultado: uma de hoje e uma de 60 dias atrás.
    await owner`
      insert into platform.help_events (kind, term, route, organization_id, created_at)
      values ('miss', ${`termo recente ${tag}`}, 'e2e-filtros-c', ${space.id}, now()),
             ('miss', ${`termo antigo ${tag}`}, 'e2e-filtros-c', ${space.id}, now() - interval '60 days')`;
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

test("saúde: erros com total, página 2, filtro de nível e página acima do total", async () => {
  await page.goto(`/health?q=filtros.${tag}&period=7d`);
  await expect(page.getByText("Mostrando 1 a 25 de 27 erros")).toBeVisible();
  await expect(page.getByText("Página 1 de 2")).toBeVisible();
  await page.getByRole("link", { name: "Próxima" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Mostrando 26 a 27 de 27 erros")).toBeVisible();
  await expect(page.getByText("Página 2 de 2")).toBeVisible();
  // Só avisos (3) pelo endereço; a busca pelo nome do espaço também acha.
  await page.goto(`/health?q=filtros.${tag}&period=7d&level=warn`);
  await expect(page.getByText("3 erros")).toBeVisible();
  await page.goto(`/health?q=${encodeURIComponent(space.name!)}&period=7d`);
  await expect(page.getByText("Mostrando 1 a 25 de 27 erros")).toBeVisible();
  // Página acima do total mostra a última existente.
  await page.goto(`/health?q=filtros.${tag}&period=7d&page=99`);
  await expect(page.getByText("Página 2 de 2")).toBeVisible();
  // Sem resultado: estado vazio com a opção de limpar.
  await page.goto(`/health?q=nada-${tag}-nada`);
  await expect(page.getByText("Nenhum erro com esses filtros.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Limpar filtros" }).first()).toBeVisible();
});

test("saúde: rotinas filtradas por situação e avisos do parceiro por período e busca", async () => {
  await page.goto(`/health?tab=rotinas&job=e2e_filtros_c_${tag}`);
  await expect(page.getByText("3 execuções")).toBeVisible();
  await page.goto(`/health?tab=rotinas&job=e2e_filtros_c_${tag}&status=failed`);
  await expect(page.getByText("1 execução")).toBeVisible();
  await page.goto(`/health?tab=rotinas&job=e2e_filtros_c_${tag}&status=ok&period=24h`);
  await expect(page.getByText("2 execuções")).toBeVisible();

  await page.goto(`/health?tab=avisos&q=E2EFILTROS_${tag}`);
  await expect(page.getByText("2 avisos")).toBeVisible();
  await page.goto(`/health?tab=avisos&q=E2EFILTROS_${tag}&period=24h`);
  await expect(page.getByText("1 aviso", { exact: true })).toBeVisible();
  await page.goto(`/health?tab=avisos&q=${encodeURIComponent(space.name!)}&status=failed`);
  await expect(page.getByText("1 aviso", { exact: true })).toBeVisible();
});

test("suporte: só urgentes, período, total e ordem", async () => {
  await page.goto(`/support?filter=all&q=${encodeURIComponent(space.name!)}`);
  await expect(page.getByText("2 conversas")).toBeVisible();
  await page.goto(`/support?filter=all&q=${encodeURIComponent(space.name!)}&urgent=1`);
  await expect(page.getByText("1 conversa", { exact: true })).toBeVisible();
  await expect(page.getByText(`Urgente filtros ${tag}`)).toBeVisible();
  await page.goto(`/support?filter=all&q=${encodeURIComponent(space.name!)}&period=7d`);
  await expect(page.getByText("1 conversa", { exact: true })).toBeVisible();
  await expect(page.getByText(`Parada filtros ${tag}`)).toHaveCount(0);
  await page.goto(`/support?filter=all&q=${encodeURIComponent(space.name!)}&order=oldest`);
  await expect(page.getByRole("link", { name: /filtros/ }).first()).toContainText(`Parada filtros ${tag}`);
  // Pela tela: escolhe "Só urgentes" e limpa.
  await page.goto(`/support?filter=all&q=${encodeURIComponent(space.name!)}`);
  await page.getByRole("combobox", { name: "Filtrar por urgência" }).click();
  await page.getByRole("option", { name: "Só urgentes" }).click();
  await expect(page).toHaveURL(/urgent=1/);
  await expect(page.getByText("1 conversa", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page).not.toHaveURL(/urgent=1/);
  // Sem resultado.
  await page.goto(`/support?filter=all&q=nada-${tag}-nada`);
  await expect(page.getByText("Nenhuma conversa com esses filtros")).toBeVisible();
});

test("planos: concessões filtradas por tipo e busca pelo espaço", async () => {
  await page.goto(`/plans?grants_q=${encodeURIComponent(space.name!)}`);
  await expect(page.getByText("3 concessões")).toBeVisible();
  await page.goto(`/plans?grants_q=${encodeURIComponent(space.name!)}&grants_kind=courtesy`);
  await expect(page.getByText("2 concessões")).toBeVisible();
  await page.goto(`/plans?grants_q=${encodeURIComponent(space.name!)}&grants_kind=forced_free`);
  await expect(page.getByText("1 concessão", { exact: true })).toBeVisible();
  await page.goto(`/plans?grants_q=${encodeURIComponent(space.name!)}&grants_kind=grace`);
  await expect(page.getByText("Nenhuma concessão com esses filtros")).toBeVisible();
  // Tipo fora da lista vira sem filtro.
  await page.goto(`/plans?grants_q=${encodeURIComponent(space.name!)}&grants_kind=qualquer`);
  await expect(page.getByText("3 concessões")).toBeVisible();
  await page.goto("/plans");
  await expect(page.locator('a[href^="/spaces?tier="]').first()).toBeVisible();
});

test("uso da ajuda: período de 7, 30 e 90 dias e busca", async () => {
  await page.goto(`/support/help?days=30&q=${tag}`);
  await expect(page.getByText(`termo recente ${tag}`)).toBeVisible();
  await expect(page.getByText(`termo antigo ${tag}`)).toHaveCount(0);
  await page.goto(`/support/help?days=90&q=${tag}`);
  await expect(page.getByText(`termo antigo ${tag}`)).toBeVisible();
  await expect(page.getByText("2 termos")).toBeVisible();
  await page.goto(`/support/help?days=7&q=nada-${tag}-nada`);
  await expect(page.getByText("Nenhum termo com essa busca")).toBeVisible();
  await page.goto("/support/help?days=999");
  await expect(page.getByRole("heading", { name: "Uso da ajuda" })).toBeVisible();
});
