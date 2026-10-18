import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { AREAS, freshTenant } from "./areas-helpers";

/**
 * Configuracao inicial e landing page no celular (375 px, toque): sem rolagem
 * lateral, campos com 16 px (sem zoom do iOS) e sem teclado aberto sozinho.
 * Roda no projeto "mobile" (Pixel 7 com toque).
 */

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 375, height: 812 } });

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Nenhum dos elementos passa das bordas da tela. */
async function expectInsideViewport(page: Page, items: Locator) {
  const width = page.viewportSize()?.width ?? 0;
  for (const box of await items.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(width);
  }
}

async function expectMobileInput(input: Locator) {
  await expect(input).toBeVisible();
  await expect(input).not.toBeFocused();
  // iOS so da zoom abaixo de 16px.
  expect(parseFloat(await input.evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
}

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test.describe("configuração inicial no celular", () => {
  for (const area of [...AREAS.map((a) => ({ label: a.label, custom: false })), { label: "Outra área", custom: true }]) {
    test(`${area.label}: três passos sem rolagem lateral, 16 px ou mais e sem foco automático`, async ({ page }) => {
      await freshTenant(page);

      // Passo 1
      await expectMobileInput(page.getByLabel("Nome"));
      await page.getByLabel("Nome").fill("Espaço com um nome bem comprido para caber no celular");
      await page.getByRole("button", { name: "Tenho mais de um endereço" }).click();
      await expectMobileInput(page.getByLabel("Unidade ou filial (opcional)"));
      await expectNoHorizontalScroll(page);
      await expectInsideViewport(page, page.getByRole("button", { name: "Continuar" }));
      await page.getByRole("button", { name: "Continuar" }).click();

      // Passo 2: area padrao avanca no clique; "Outra área" abre os campos e usa o botao.
      const group = page.getByRole("radiogroup", { name: "Área do espaço" });
      await expectInsideViewport(page, group.getByRole("radio"));
      await expectNoHorizontalScroll(page);
      await group.getByRole("radio", { name: new RegExp(`^${escapeRe(area.label)}`) }).click();
      if (area.custom) {
        await expectMobileInput(page.getByLabel("O que você ensina?"));
        await page.getByRole("button", { name: "Autoescola", exact: true }).click();
        await expectInsideViewport(page, page.getByRole("radiogroup", { name: "Como seus alunos avançam?" }).getByRole("radio"));
        await expectInsideViewport(page, page.getByRole("radiogroup", { name: "Como você cobra?" }).getByRole("radio"));
        await expectNoHorizontalScroll(page);
        await expectInsideViewport(page, page.getByRole("button", { name: "Continuar" }));
        await page.getByRole("button", { name: "Continuar" }).click();
      }
      await expectInsideViewport(page, page.getByRole("status"));

      // Passo 3
      await expect(page.getByRole("heading", { name: "Quais aulas você oferece?" })).toBeVisible();
      const add = page.getByLabel("Não encontrou sua aula? Adicione abaixo:");
      await expectMobileInput(add);
      await add.fill("Aula com nome comprido para testar a pílula");
      await page.getByRole("button", { name: "Adicionar" }).click();
      await expectNoHorizontalScroll(page);
      await expectInsideViewport(page, page.getByRole("button", { name: "Concluir" }));
      await expectInsideViewport(page, page.getByRole("button", { name: "Voltar" }));

      await page.getByRole("button", { name: "Concluir" }).click();
      await page.waitForURL("**/dashboard");
      const welcome = page.getByRole("dialog", { name: /Bem-vindo/ });
      await expect(welcome).toBeVisible();
      await welcome.getByRole("button", { name: /Ir para os primeiros passos/ }).click();
      await expect(page.getByRole("heading", { name: "Primeiros passos da sua unidade" })).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }
});

test("landing page no celular: cards de áreas e título digitado cabem na tela", async ({ page }) => {
  await page.goto("/");
  const headline = page.getByRole("heading", { level: 1 });
  // A palavra mais longa ("estúdios de pilates e yoga.") quebra linha sem vazar.
  await expect(headline).toContainText("estúdios de pilates e yoga.", { timeout: 15_000 });
  await expectInsideViewport(page, headline);
  await expectNoHorizontalScroll(page);

  const section = page.locator("#modalidades");
  await section.scrollIntoViewIfNeeded();
  const titles = section.getByRole("heading", { level: 3 });
  await expect(titles).toHaveCount(11);
  await expectInsideViewport(page, section.locator("div.group"));
  // Titulo e exemplos sem corte (nada escondido por overflow).
  for (const clipped of await section
    .locator("div.group h3, div.group p")
    .evaluateAll((els) => els.map((el) => el.scrollWidth - el.clientWidth))) {
    expect(clipped).toBeLessThanOrEqual(0);
  }
  await expectNoHorizontalScroll(page);
});
