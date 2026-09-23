import { expect, seedAcademy, student, test } from "./fixtures";

test("mensalidades no celular: sem rolagem lateral e linha legível", async ({ page }) => {
  await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno Nome Comprido da Silva")]) });
  await page.goto("/classes/billing");
  await page.getByRole("button", { name: "Gerar cobranças" }).first().click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Gerar cobranças" }).click();

  const row = page.locator("div.group").filter({ hasText: "Aluno Nome Comprido da Silva" });
  await expect(row).toBeVisible();
  const nameBox = await row.getByText("Aluno Nome Comprido da Silva").boundingBox();
  expect(nameBox?.width ?? 0).toBeGreaterThan(120); // o nome nao fica espremido em "A..."

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("horários no celular: dia com dois turnos cabe sem rolagem lateral", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/settings?tab=horarios");
  await page.getByRole("button", { name: "Adicionar turno em Segunda" }).click();
  await expect(page.getByLabel("Segunda turno 2 fim")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
