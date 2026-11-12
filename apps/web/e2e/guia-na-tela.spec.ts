import type { Page } from "@playwright/test";
import { expect, seedAcademy, student, test } from "./fixtures";

/**
 * Guia na tela ("Me mostre na tela", doc technical/26 §18.5), em painel lateral
 * de passos desde 11/11/2026. Passo de clique
 * nao tem "Próximo" (seguir sem clicar deixava a janela fechada e o passo
 * seguinte sem alvo): tem "Fazer por mim", que clica pela pessoa, e o guia so
 * segue com a tela pronta. Clicar no proprio destaque tambem segue (30/10/2026).
 */

async function startGuide(page: Page, title: string) {
  await page.getByRole("button", { name: /^Menu do usuário/ }).click();
  await page.getByRole("menuitem", { name: "Ajuda e suporte" }).click();
  const card = page.locator("article").filter({ hasText: title }).first();
  await card.getByRole("button", { name: "Me mostre na tela" }).click();
  return page.getByRole("dialog", { name: title });
}

test("botão que abre janela: 'Fazer por mim' abre o cadastro e o passo seguinte acha o campo", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/clients");
  const guide = await startGuide(page, "Cadastrar um aluno");
  await expect(guide).toContainText("1 de 5");
  await expect(guide.getByRole("button", { name: "Próximo" })).toHaveCount(0);

  await guide.getByRole("button", { name: "Fazer por mim" }).click();
  await expect(page.getByRole("dialog", { name: "Novo aluno" })).toBeVisible();
  await expect(guide).toContainText("2 de 5");
  await expect(guide).not.toContainText("Não achei");
  // Campo: a pessoa escreve e segue com "Próximo".
  await expect(guide.getByRole("button", { name: "Próximo" })).toBeVisible();
  await expect(guide.getByRole("button", { name: "Fazer por mim" })).toHaveCount(0);
});

test("menu ⋮: 'Fazer por mim' abre o menu e escolhe a opção, sem travar", async ({ page }) => {
  await seedAcademy(page, { extra: (t) => (t.clients = [student("c-g", "Aluna Guia", { phone: "11977776600" })]) });
  await page.goto("/clients");
  const guide = await startGuide(page, "Editar o cadastro de um aluno");
  await expect(guide).toContainText("1 de 4");

  await guide.getByRole("button", { name: "Fazer por mim" }).click();
  await expect(page.getByRole("menuitem", { name: "Editar cadastro" })).toBeVisible();
  await expect(guide).toContainText("2 de 4");

  await guide.getByRole("button", { name: "Fazer por mim" }).click();
  await expect(page.getByRole("dialog", { name: "Editar aluno" })).toBeVisible();
  await expect(guide).toContainText("3 de 4");
  await expect(guide).not.toContainText("Não achei");
});

test("clicar no próprio destaque também segue", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/clients");
  const guide = await startGuide(page, "Cadastrar um aluno");
  await page.getByRole("button", { name: "Novo aluno" }).click();
  await expect(page.getByRole("dialog", { name: "Novo aluno" })).toBeVisible();
  await expect(guide).toContainText("2 de 5");
});

test("fechar a janela no meio volta ao passo que a abriu", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/clients");
  const guide = await startGuide(page, "Cadastrar um aluno");
  await guide.getByRole("button", { name: "Fazer por mim" }).click();
  await expect(guide).toContainText("2 de 5");
  // Esc fecha a janela, não o guia.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Novo aluno" })).toHaveCount(0);
  await expect(guide).toContainText("1 de 5");
  await expect(guide).toContainText("A janela fechou");
});
