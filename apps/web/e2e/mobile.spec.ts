import { classGroup, enrollment, expect, seedAcademy, student, test } from "./fixtures";

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

test("horários no celular: modal e dia com dois turnos cabem sem rolagem lateral", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/settings?tab=horarios");
  await page.getByRole("button", { name: "Editar horários de Segunda" }).click();
  await page.getByLabel("Segunda turno 1 fim").fill("12:00");
  await page.getByRole("button", { name: "Adicionar turno em Segunda" }).click();
  await expect(page.getByLabel("Segunda turno 2 fim")).toBeVisible();
  const dialogOverflow = await page.getByRole("dialog").evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(dialogOverflow).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Aplicar" }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("calendário no celular abre em lista e mantém a grade escolhida", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [student("c-a", "Aluno A20")];
      t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
      t.enrollments = [enrollment("e-1", "cg-1", "c-a")];
    },
  });
  await page.goto("/classes/calendar");
  const list = page.getByRole("tab", { name: "Lista" });
  const grid = page.getByRole("tab", { name: "Grade" });
  await expect(list).toHaveAttribute("aria-selected", "true");
  await expect(page).not.toHaveURL(/view=/);

  await grid.click();
  await expect(page).toHaveURL(/view=grid/);
  await expect(grid).toHaveAttribute("aria-selected", "true");
  await page.reload();
  await expect(grid).toHaveAttribute("aria-selected", "true");
});
