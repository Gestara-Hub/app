import { expect, seedAcademy, test } from "./fixtures";

/**
 * Recebimentos online antes de ativar (01/11/2026): como funciona, quanto o
 * espaco recebe (mesma conta da previa da cobranca) e o botao de ativar.
 * Plano Gratis: taxa do GestaraHub de R$ 1,99 por cobranca paga.
 */

test("Recebimentos online antes de ativar: simulação de R$ 150 no Pix e no cartão, com e sem repasse", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/online-payments");

  await expect(page.getByRole("heading", { name: "Como funciona" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ativar conta de recebimento/ })).toBeVisible();

  const simulation = page.locator("section[aria-labelledby=online-simulation]");
  await expect(simulation).toContainText("Com a taxa do seu plano (Grátis)");
  await simulation.getByRole("button", { name: "R$ 150,00" }).click();
  await expect(simulation.getByLabel("Valor da cobrança")).toHaveValue("150");

  // Cada resultado e um quadro com o titulo ("No Pix · cai na hora") e a conta.
  const pix = simulation.locator("div.rounded-lg").filter({ hasText: "No Pix" });
  const card = simulation.locator("div.rounded-lg").filter({ hasText: "No cartão de crédito" });

  // Sem repasse: as taxas saem do valor.
  await expect(pix).toContainText("R$ 146,02");
  await expect(pix).toContainText("Saem R$ 1,99 do parceiro e R$ 1,99 do GestaraHub.");
  await expect(card).toContainText("R$ 143,04");
  await expect(card).toContainText("Saem R$ 4,97 do parceiro e R$ 1,99 do GestaraHub.");

  // Com repasse: o aluno paga as taxas e o espaco recebe o valor cheio.
  await simulation.getByLabel("Repassar as taxas ao aluno").click();
  await expect(pix).toContainText("O aluno paga");
  await expect(card).toContainText("O aluno paga");
  await expect(pix).toContainText("R$ 150,00");
  await expect(card).toContainText("R$ 150,00");

  // Valor apagado: pede o valor em vez de mostrar conta errada.
  await simulation.getByLabel("Valor da cobrança").fill("");
  await expect(pix).toContainText("Informe um valor para ver a conta.");
});
