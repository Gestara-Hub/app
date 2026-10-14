import type { Locator, Page } from "@playwright/test";
import { classGroup, enrollment, expect, seedAcademy, setSessionCookie, student, test } from "./fixtures";

/** Nenhum dos elementos passa da borda direita da tela (a raiz pode esconder o excesso). */
async function expectInsideViewport(page: Page, items: Locator) {
  const width = page.viewportSize()?.width ?? 0;
  for (const box of await items.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(width);
  }
}

test("mensalidades no celular: sem rolagem lateral e linha legível", async ({ page }) => {
  await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno Nome Comprido da Silva")]) });
  // A mensalidade do mes atual nasce sozinha ao abrir a tela.
  await page.goto("/classes/billing");

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

test("configuração inicial em 375px: sem teclado automático, cards e opções cabem", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setSessionCookie(page, "Ana Ribeiro");
  await page.goto("/setup");

  const name = page.getByLabel("Nome");
  await expect(name).toBeVisible();
  await expect(name).not.toBeFocused();
  // 16px evita o zoom automatico do iOS ao tocar no campo.
  expect(await name.evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
  await name.fill("Ateliê da Lu");
  await page.getByRole("button", { name: "Tenho mais de um endereço" }).click();
  await expect(page.getByLabel("Unidade ou filial (opcional)")).not.toBeFocused();
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByRole("radio", { name: /^Outra área/ }).click();
  const custom = page.getByLabel("O que você ensina?");
  await expect(custom).not.toBeFocused();
  expect(await custom.evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
  await expectInsideViewport(page, page.getByRole("radio"));
  await expectInsideViewport(page, page.getByRole("button", { name: "Continuar" }));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("landing page em 375px: os 11 cards de áreas cabem sem rolagem lateral", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const section = page.locator("#modalidades");
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole("heading", { level: 3 })).toHaveCount(11);
  await expect(section.getByText("Sua área não está aqui?")).toBeVisible();
  await expectInsideViewport(page, section.getByRole("heading", { level: 3 }));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
