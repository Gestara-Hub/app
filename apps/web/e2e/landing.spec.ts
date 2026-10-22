import { BASE_URL, expect, test } from "./fixtures";
import { AREAS } from "./areas-helpers";

/**
 * Landing page publica (`/`, sem sessao): as areas do setup, os textos da
 * cobranca por curso e pacote, a promessa do plano gratis sem "para sempre" e
 * as paginas de Termos e Privacidade.
 */

/** Exemplos de cada area (mesma linha do passo 2 do setup). */
const EXAMPLES: Record<string, string> = {
  martial_arts: "Jiu-jitsu, judô, muay thai",
  pilates_yoga: "Solo, aparelho, meditação",
  functional_training: "Funcional, HIIT, calistenia",
  dance: "Balé, salão, ritmos",
  music: "Violão, piano, canto",
  languages: "Inglês, reforço, cursinho",
  swimming_sports: "Natação, futebol, tênis",
  gastronomy: "Confeitaria, pães, culinária",
  arts_crafts: "Cerâmica, pintura, costura",
  beauty_courses: "Maquiagem, unhas, oratória",
};

const TYPEWRITER_WORDS = [
  "academias de luta.",
  "estúdios de pilates.",
  "aulas particulares.",
  "escolas de música.",
  "escolas de idiomas.",
  "escolas de dança.",
  "cursos de confeitaria.",
  "cursos livres.",
];

test.describe("landing page", () => {
  test("selo do plano grátis, sem \"para sempre\" em lugar nenhum", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Plano grátis • Sem cartão de crédito")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Chega de caderno e planilha.");
    const text = (await page.locator("body").innerText()).toLowerCase();
    expect(text).not.toContain("para sempre");
    // Sem sessao, a landing fica na raiz.
    await expect(page).toHaveURL(`${BASE_URL}/`);
  });

  test("as 10 áreas da configuração inicial e o card \"Sua área não está aqui?\"", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#areas");
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole("heading", { level: 2 })).toHaveText("Para quem ensina, em qualquer área");
    const titles = section.getByRole("heading", { level: 3 });
    await expect(titles).toHaveText([...AREAS.map((a) => a.label), "Sua área não está aqui?"]);
    for (const area of AREAS) {
      const card = section.locator("div.group").filter({ has: page.getByRole("heading", { name: area.label, exact: true }) });
      await expect(card).toContainText(EXAMPLES[area.id]);
    }
    const other = section.locator("div.group").filter({ hasText: "Sua área não está aqui?" });
    await expect(other).toContainText("Também serve: teatro, xadrez, autoescola");
    await expect(other.getByRole("link", { name: /Criar conta grátis/ })).toHaveAttribute("href", "#cadastro");
    // Cards sem reticencias (sem corte de texto).
    expect(await section.innerText()).not.toContain("...");
    expect(await section.innerText()).not.toContain("…");
  });

  test("o título passa por todas as áreas digitadas", async ({ page }) => {
    // Cada palavra leva uns 5 s (digita, pausa, apaga).
    test.setTimeout(120_000);
    await page.goto("/");
    // O h1 guarda todas as palavras invisiveis (reserva de altura): olha so a digitada.
    const current = page.locator("[data-slot=typewriter-current]");
    const headline = page.getByRole("heading", { level: 1 });
    const height = (await headline.boundingBox())?.height;
    for (const word of TYPEWRITER_WORDS) {
      await expect(current).toHaveText(word, { timeout: 15_000 });
      // A altura do titulo nao muda de uma palavra para outra.
      expect((await headline.boundingBox())?.height).toBe(height);
    }
    // Depois da ultima, volta para a primeira.
    await expect(current).toHaveText(TYPEWRITER_WORDS[0], { timeout: 15_000 });
  });

  test("recursos: 4 pilares com chips, sem checks", async ({ page }) => {
    await page.goto("/");
    const features = page.locator("#recursos");
    await features.scrollIntoViewIfNeeded();
    await expect(features.getByRole("heading", { level: 3 })).toHaveText([
      "Financeiro",
      "Turmas e aulas particulares",
      "Evolução dos alunos",
      "Comunicação",
    ]);
    const finance = features.locator("div.group").filter({ has: page.getByRole("heading", { name: "Financeiro" }) });
    await expect(finance.getByRole("listitem")).toHaveText(["Mensalidade", "Curso fechado", "Pacote de aulas", "Despesas fixas"]);
    // Sem promessa de reposicao (o modelo de turmas nao tem).
    expect((await page.locator("body").innerText()).toLowerCase()).not.toContain("reposi");
  });

  test("FAQ responde sobre curso com valor fechado e pacote de aulas", async ({ page }) => {
    await page.goto("/");
    const faq = page.locator("#faq");
    await faq.scrollIntoViewIfNeeded();
    const question = faq.getByRole("button", { name: "Dá para vender curso com valor fechado ou pacote de aulas?" });
    await expect(question).toBeVisible();
    await expect(question).toHaveAttribute("aria-expanded", "false");
    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "true");
    await expect(
      faq.getByText("Sim. O curso tem valor fechado e pode ser dividido em parcelas. O pacote tem um número de aulas, e a chamada desconta do saldo do aluno."),
    ).toBeVisible();
    // Gratis sem "para sempre" e sem citar o Pro (preco e cobranca em aberto, doc 08 secao 3.5).
    const free = faq.getByRole("button", { name: /realmente gratuito/ });
    await free.click();
    await expect(faq.getByText(/O dia a dia é grátis/)).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(/\bPro\b/);
  });

  test("cadastro: Nome* e E-mail*, aceite dos termos e páginas legais públicas", async ({ page }) => {
    await page.goto("/");
    const signup = page.locator("#cadastro");
    await signup.scrollIntoViewIfNeeded();
    await expect(signup.locator("label[for=signup-name]")).toHaveText("Nome*");
    await expect(signup.locator("label[for=signup-email]")).toHaveText("E-mail*");
    await expect(signup.getByPlaceholder("Informe seu nome")).toBeVisible();
    // Botao sempre ativo: enviar vazio mostra o erro em cada campo.
    await signup.getByRole("button", { name: /Criar conta grátis/ }).click();
    await expect(signup.getByText("Informe seu nome.")).toBeVisible();
    await expect(signup.getByText("Informe seu e-mail.")).toBeVisible();
    await expect(signup.locator("#signup-name")).toHaveAttribute("aria-invalid", "true");
    await signup.locator("#signup-email").fill("ana@");
    await expect(signup.getByText("Informe um e-mail válido.")).toBeVisible();
    await expect(signup.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
    await signup.getByRole("link", { name: "Termos de uso" }).click();
    await expect(page).toHaveURL(`${BASE_URL}/terms`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Termos de Uso e Condições Gerais");
    await page.getByRole("contentinfo").getByRole("link", { name: "Privacidade" }).click();
    await expect(page).toHaveURL(`${BASE_URL}/privacy`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Política de Privacidade e Proteção de Dados");
  });

  test("celular: campos do cadastro com 16px (sem zoom no iPhone)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const input = page.locator("#signup-name");
    await input.scrollIntoViewIfNeeded();
    expect(await input.evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
  });

  test("o sistema: abas trocam a tela real mostrada", async ({ page }) => {
    await page.goto("/");
    const showcase = page.locator("#o-sistema");
    await showcase.scrollIntoViewIfNeeded();
    const tabs = showcase.getByRole("tab");
    await expect(tabs).toHaveText(["Painel", "Cobranças", "Chamada", "Ficha do aluno", "Financeiro", "Calendário"]);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(showcase.getByRole("img", { name: /Painel inicial/ }).first()).toBeVisible();
    await showcase.getByRole("tab", { name: "Cobranças" }).click();
    await expect(showcase.getByText("Quem pagou e quem atrasou, agrupado por aluno.")).toBeVisible();
    await expect(showcase.getByRole("img", { name: /Tela de cobranças/ }).first()).toBeVisible();
    // O hero leva para esta secao.
    await expect(page.getByRole("link", { name: "Ver o sistema" })).toHaveAttribute("href", "#o-sistema");
  });

  test("FAQ: professores e alunos", async ({ page }) => {
    await page.goto("/");
    const faq = page.locator("#faq");
    await faq.scrollIntoViewIfNeeded();
    await faq.getByRole("button", { name: "Meus professores podem usar?" }).click();
    await expect(faq.getByText(/vê as turmas e faz a chamada, sem ver o financeiro\./)).toBeVisible();
    await faq.getByRole("button", { name: "Meus alunos precisam baixar algum app?" }).click();
    await expect(faq.getByText("Não. Os avisos chegam pelo seu WhatsApp, sem instalar nada.")).toBeVisible();
  });

  test("celular: \"Criar conta\" sempre à vista no topo e tema dentro do menu", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Criar conta", exact: true })).toHaveAttribute("href", "/#cadastro");
    await expect(header.getByRole("button", { name: "Alternar tema" })).toBeHidden();
    await header.getByRole("button", { name: "Abrir menu" }).click();
    await expect(header.getByRole("button", { name: /Tema (escuro|claro)/ })).toBeVisible();
  });
});
