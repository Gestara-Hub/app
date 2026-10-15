import { BASE_URL, expect, test } from "./fixtures";
import { AREAS } from "./areas-helpers";

/**
 * Landing page publica (`/`, sem sessao): as areas do setup, os textos da
 * cobranca por curso e pacote e a promessa do plano gratis sem "para sempre".
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
  "estúdios de pilates e yoga.",
  "escolas de música.",
  "escolas de idiomas.",
  "escolas de dança.",
  "escolas de confeitaria.",
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
    const section = page.locator("#modalidades");
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
    await expect(other.getByRole("link", { name: /Criar conta gratuita/ })).toHaveAttribute("href", "#cadastro");
    // Cards sem reticencias (sem corte de texto).
    expect(await section.innerText()).not.toContain("...");
    expect(await section.innerText()).not.toContain("…");
  });

  test("o título passa por todas as áreas digitadas", async ({ page }) => {
    // Cada palavra leva uns 5 s (digita, pausa, apaga).
    test.setTimeout(120_000);
    await page.goto("/");
    const headline = page.getByRole("heading", { level: 1 });
    for (const word of TYPEWRITER_WORDS) {
      await expect(headline).toContainText(word, { timeout: 15_000 });
    }
    // Depois da ultima, volta para a primeira.
    await expect(headline).toContainText(TYPEWRITER_WORDS[0], { timeout: 15_000 });
  });

  test("recursos: mensalidade, curso fechado ou pacote de aulas", async ({ page }) => {
    await page.goto("/");
    const features = page.locator("#recursos");
    await features.scrollIntoViewIfNeeded();
    await expect(features.getByText("Mensalidade, curso fechado ou pacote de aulas", { exact: true })).toBeVisible();
    await expect(features).toContainText("Gestão Financeira");
    await expect(features).toContainText("Controle de Progresso");
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
    // Gratis: o Pro e opcional, sem "para sempre".
    const free = faq.getByRole("button", { name: /realmente gratuito/ });
    await free.click();
    await expect(faq.getByText(/ficam no plano Pro, que é opcional\./)).toBeVisible();
  });
});
