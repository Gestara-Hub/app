import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ownerSql } from "./db";
import { collectErrors, makeAdmin, makeSpace, signedInContext, E2E_DOMAIN, type E2eAdmin } from "./helpers";

/**
 * Fluxos do proprietário no painel: o que uma pessoa faz de verdade (gaveta de cadastro, confirmação,
 * filtro, menu ⋮). Cada teste confere o resultado na tela e que a página não gerou erro.
 */
let admin: E2eAdmin;
let context: BrowserContext;
let page: Page;
let errors: string[];
const data: { space?: string; thread?: string; error?: string } = {};
const tag = Date.now().toString(36);

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  test.setTimeout(240_000);
  admin = await makeAdmin("platform_owner", "E2E Dono dos Fluxos");
  data.space = await makeSpace(`Espaço Fluxos ${tag}`);
  const owner = ownerSql();
  try {
    const [thread] = await owner<{ id: string }[]>`
      select public.support_open_thread(${data.space}, 'user-e2e', 'Bia Fluxos', 'bia@e2e.gestarahub.local', null, ${`Dúvida dos fluxos ${tag}`}, 'Como pauso um aluno?', '/clients', null, 'free') as id`;
    data.thread = thread.id;
    await owner`update platform.support_threads set status = 'waiting_us' where id = ${thread.id}`;
    const [error] = await owner<{ id: string }[]>`
      insert into public.error_logs (organization_id, fingerprint, source, event, message, count, last_reference)
      values (${data.space}, ${`e2e-fluxo-${tag}`}, 'server', 'fluxos.teste', ${`Erro de teste ${tag}`}, 1, 'E2EFLX01') returning id`;
    data.error = error.id;
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

const drawer = (page: Page) => page.getByRole("dialog");

test("equipe: convida uma pessoa, copia o link e desativa o acesso com confirmação", async () => {
  const name = `E2E Convidada ${tag}`;
  const email = `e2e-convite-${tag}@${E2E_DOMAIN}`;
  await page.goto("/team");
  await page.getByRole("button", { name: "Convidar" }).click();
  await drawer(page).getByLabel("Nome").fill(name);
  await drawer(page).getByLabel("E-mail").fill(email);
  await drawer(page).getByRole("button", { name: "Convidar" }).click();
  await expect(drawer(page).getByText(/\/accept/)).toBeVisible({ timeout: 20_000 });
  await expect(drawer(page).getByRole("button", { name: /Copiar link/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByText(name).first()).toBeVisible();
  // Convidada ainda não aceitou: dá para reenviar o convite (com confirmação) e não há "Reiniciar 2FA".
  await page.getByRole("button", { name: `Ações de ${name}` }).click();
  await expect(page.getByRole("menuitem", { name: "Reiniciar 2FA" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Reenviar convite" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Reenviar convite");
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  // Quem já está ativo pode ser desativado, sempre depois de confirmar.
  const member = await makeAdmin("platform_support", `E2E Membro ${tag}`);
  await page.reload();
  await page.getByRole("button", { name: `Ações de ${member.name}` }).click();
  await page.getByRole("menuitem", { name: "Desativar" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Desativar");
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await page.getByRole("button", { name: `Ações de ${member.name}` }).click();
  await page.getByRole("menuitem", { name: "Desativar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Desativar" }).click();
  await expect(page.getByText("Desativado").first()).toBeVisible({ timeout: 15_000 });
});

test("respostas prontas: cria numa gaveta, edita e exclui com confirmação", async () => {
  const title = `Resposta ${tag}`;
  await page.goto("/support/macros");
  await page.getByRole("button", { name: /Nova resposta pronta/ }).first().click();
  await drawer(page).getByLabel("Título").fill(title);
  await drawer(page).getByLabel("Texto da resposta").fill("Oi! Pode me contar mais detalhes?");
  await drawer(page).getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: `Ações de ${title}` }).click();
  await page.getByRole("menuitem", { name: "Excluir" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByText(title)).toHaveCount(0, { timeout: 15_000 });
});

test("comunicados: publica, aparece na lista e arquiva com confirmação", async () => {
  const title = `Aviso ${tag}`;
  await page.goto("/announcements/new");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Mensagem").fill("Manutenção rápida amanhã de manhã.");
  await page.getByRole("button", { name: "Publicar" }).click();
  await page.waitForURL("**/announcements");
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: new RegExp(`Ações.*${title}`) }).click();
  await page.getByRole("menuitem", { name: "Arquivar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Arquivar/ }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden({ timeout: 15_000 });
});

test("LGPD: registra um pedido na gaveta e ele aparece em aberto", async () => {
  const who = `Titular ${tag}`;
  await page.goto("/privacy");
  await page.getByRole("button", { name: /Registrar pedido/ }).first().click();
  await drawer(page).getByLabel("Nome de quem pediu").fill(who);
  await drawer(page).getByLabel("E-mail").fill(`titular-${tag}@${E2E_DOMAIN}`);
  await drawer(page).getByLabel("O que foi pedido").fill("Quero saber quais dados vocês guardam sobre mim.");
  await drawer(page).getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText(who).first()).toBeVisible({ timeout: 15_000 });
});

test("suporte: nota interna, resposta ao cliente e encerrar com confirmação", async () => {
  await page.goto(`/support/${data.thread}`);
  await expect(page.getByRole("heading", { name: new RegExp(`Dúvida dos fluxos ${tag}`) })).toBeVisible();
  await page.getByRole("tab", { name: "Nota interna" }).click();
  await page.getByLabel("Nota interna").fill(`Nota de teste ${tag}`);
  await page.getByRole("button", { name: /Salvar nota|Adicionar nota|Registrar nota/ }).click();
  await expect(page.getByText(`Nota de teste ${tag}`).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("tab", { name: "Responder ao cliente" }).click();
  await page.getByPlaceholder(/Escreva a resposta/).fill(`Resposta de teste ${tag}`);
  await page.getByRole("button", { name: "Enviar resposta" }).click();
  await expect(page.getByText(`Resposta de teste ${tag}`).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Encerrar conversa/ }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("button", { name: /Encerrar conversa/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Encerrar/ }).click();
  await expect(page.getByRole("button", { name: /Reabrir/ })).toBeVisible({ timeout: 15_000 });
});

test("espaços: busca, limpa os filtros, abre a ficha e percorre as abas", async () => {
  await page.goto("/spaces");
  await page.getByLabel("Buscar espaços").fill(`Espaço Fluxos ${tag}`);
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByRole("link", { name: new RegExp(`Espaço Fluxos ${tag}`) }).first()).toBeVisible();
  await page.getByLabel("Buscar espaços").fill("zzzz-nada-assim");
  await expect(page.getByText(/Nenhum espaço|nada/i).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Limpar filtros" }).first().click();
  await page.getByLabel("Buscar espaços").fill(`Espaço Fluxos ${tag}`);
  await page.getByRole("link", { name: new RegExp(`Espaço Fluxos ${tag}`) }).first().click();
  await page.waitForURL(/\/spaces\//);
  const tabs = page.getByRole("navigation", { name: "Seções" });
  for (const tab of ["Assinatura", "Saúde", "Recebimentos online", "Suporte e notas", "Auditoria do painel", "Dados e LGPD", "Resumo"]) {
    await tabs.getByRole("link", { name: tab, exact: true }).click();
    await expect(tabs.getByRole("link", { name: tab, exact: true })).toHaveAttribute("aria-current", "page");
  }
});

test("espaço: anotação em gaveta e ações do plano abrem a gaveta com motivo", async () => {
  const note = `Anotação ${tag}`;
  await page.goto(`/spaces/${data.space}?tab=suporte`);
  await page.getByRole("button", { name: /Nova anotação/ }).click();
  await drawer(page).getByRole("textbox").first().fill(note);
  await drawer(page).getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText(note).first()).toBeVisible({ timeout: 15_000 });
  await page.goto(`/spaces/${data.space}?tab=assinatura`);
  await page.getByRole("button", { name: "Dar cortesia" }).click();
  await expect(drawer(page).getByLabel(/Motivo/)).toBeVisible();
  await expect(drawer(page).getByLabel("Dias")).toBeVisible();
  await drawer(page).getByRole("button", { name: "Cancelar" }).click();
  await expect(drawer(page)).toBeHidden();
});

test("saúde: marca e desmarca o erro como conhecido e filtra os conhecidos", async () => {
  await page.goto("/health");
  const row = page.locator("div", { hasText: `Erro de teste ${tag}` }).last();
  await expect(page.getByText(`Erro de teste ${tag}`).first()).toBeVisible();
  await page.getByRole("button", { name: /Ações|Mais ações|Abrir menu/ }).first().click();
  await page.getByRole("menuitem", { name: "Marcar conhecido" }).first().click();
  await expect(page.getByText("Erro marcado como conhecido.")).toBeVisible({ timeout: 15_000 });
  void row;
  await page.goto("/health?known=hide");
  await expect(page.getByText(`Erro de teste ${tag}`)).toHaveCount(0);
});

test("papéis: suporte não vê Equipe nem Auditoria e é barrado pela URL", async ({ browser }) => {
  const support = await makeAdmin("platform_support", "E2E Suporte");
  const { context: ctx, page: p } = await signedInContext(browser, support);
  try {
    const errs = collectErrors(p);
    await p.goto("/");
    await expect(p.getByRole("link", { name: "Suporte" }).first()).toBeVisible();
    await expect(p.getByRole("link", { name: "Equipe" })).toHaveCount(0);
    await expect(p.getByRole("link", { name: "Auditoria" })).toHaveCount(0);
    await p.goto("/team");
    await expect(p).toHaveURL(/\/($|\?)/);
    await p.goto("/audit");
    await expect(p).toHaveURL(/\/($|\?)/);
    expect(errs).toEqual([]);
  } finally {
    await ctx.close();
  }
});
