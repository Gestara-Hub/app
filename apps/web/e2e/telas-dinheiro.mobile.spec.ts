import type { Locator, Page } from "@playwright/test";
import { classGroup, enrollment, expect, pageAction, rollCallRow, seedAcademy, student, test } from "./fixtures";
import { TS } from "./geral-fixtures";

/**
 * Telas de dinheiro e de turma no celular (375 px, toque): Cobrancas,
 * Financeiro, Planos e pacotes, detalhe da turma e chamada da aula. Sem
 * rolagem lateral, campos com 16 px (sem zoom do iOS) e dialogos que cabem.
 * Roda no projeto "mobile". Hoje e terca 22/09/2026.
 */

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 375, height: 812 } });

const ORG = "org-academia-x";

/**
 * Sem rolagem lateral e nada cortado na borda: a raiz do app esconde o
 * excesso, entao confere cada elemento (menos os de faixas com rolagem propria,
 * como as abas, e os textos de leitor de tela).
 */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const cut = await page.evaluate(() => {
    const width = window.innerWidth;
    const scrolls = (el: Element | null): boolean => {
      for (let p = el?.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
      }
      return false;
    };
    return [...document.querySelectorAll("main *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.right > width + 1 || r.left < -1) && !el.closest(".sr-only") && !scrolls(el);
      })
      .map((el) => `${el.tagName} ${(el.textContent ?? "").trim().slice(0, 30)}`)
      .slice(0, 5);
  });
  expect(cut, "elementos cortados na borda da tela").toEqual([]);
}

/** Todo campo de texto visivel no escopo tem 16 px e nao comeca focado. */
async function expectMobileInputs(scope: Locator) {
  const inputs = scope.locator(
    "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):visible, textarea:visible",
  );
  const count = await inputs.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    const name = (await input.getAttribute("aria-label")) ?? (await input.getAttribute("name")) ?? `#${i}`;
    expect(await input.evaluate((el) => getComputedStyle(el).fontSize), `campo ${name}`).toBe("16px");
  }
  await expect(scope.locator("input:focus, textarea:focus")).toHaveCount(0);
}

/** O dialogo aberto cabe na largura (sem rolagem lateral dentro dele). */
async function expectDialogFits(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // O painel entra deslizando: mede depois de parar dentro da tela.
  await expect.poll(async () => { const b = await dialog.boundingBox(); return b ? b.x + b.width : 999; }).toBeLessThanOrEqual(375);
  const box = await dialog.boundingBox();
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 999)).toBeLessThanOrEqual(375);
  const overflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  return dialog;
}

async function seedMoney(page: Page) {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [
        student("c-a", "Aluno Com Nome Bem Comprido da Silva"),
        student("c-b", "Bruna Lima", { planId: undefined }),
        student("c-c", "Carla Souza", { planId: undefined }),
      ];
      t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto Avançado Noite")];
      t.enrollments = [enrollment("e-1", "cg-1", "c-a"), enrollment("e-2", "cg-1", "c-b")];
      t.charges = [
        {
          id: "ch-x",
          organizationId: ORG,
          unitId: "unit-academia-x",
          studentId: "c-b",
          kind: "extra",
          description: "Kimono trançado azul tamanho A2",
          competence: "2026-09",
          dueDate: "2026-09-25",
          amountCents: 125000,
          status: "pending",
          createdAt: TS,
          updatedAt: TS,
        },
      ];
      t.lessonPackages = [
        { id: "lp-10", organizationId: ORG, name: "10 aulas de Jiu-Jitsu", lessons: 10, priceCents: 50000, modalityIds: [], absenceConsumes: true, status: "active", createdAt: TS, updatedAt: TS },
      ];
    },
  });
  await page.evaluate(() => localStorage.setItem("gestarahub_coachmark_view_mode_clients", "1"));
}

test("Cobranças: lista, filtros e registrar pagamento cabem", async ({ page }) => {
  await seedMoney(page);
  await page.goto("/classes/billing?status=all");
  await expect(page.locator("div.group").filter({ hasText: "Bruna Lima" })).toBeVisible();
  await expect(page.locator("div.group").filter({ hasText: "Aluno Com Nome Bem Comprido da Silva" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectMobileInputs(page.getByRole("main"));

  await page.getByRole("button", { name: "Ações de Bruna Lima", exact: true }).click();
  await page.getByRole("menuitem", { name: "Marcar pago" }).click();
  await expectDialogFits(page);
  await expectNoHorizontalScroll(page);
});

test("Financeiro: resumo, lançamentos e novo lançamento cabem", async ({ page }) => {
  await seedMoney(page);
  await page.goto("/finance");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto("/finance?tab=lancamentos");
  await expect(page.getByRole("button", { name: "Novo lançamento" }).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectMobileInputs(page.getByRole("main"));
  await page.getByRole("button", { name: "Novo lançamento" }).first().click();
  const dialog = await expectDialogFits(page);
  await expectMobileInputs(dialog);

  await page.keyboard.press("Escape");
  await page.goto("/finance?tab=professores");
  await expectNoHorizontalScroll(page);
});

test("Planos e pacotes: listas e formulários cabem", async ({ page }) => {
  await seedMoney(page);
  await page.goto("/classes/plans");
  await expect(page.getByText("Mensal Jiu-Jitsu")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Novo plano" }).first().click();
  let dialog = await expectDialogFits(page);
  await expectMobileInputs(dialog);
  await page.keyboard.press("Escape");

  await page.goto("/classes/plans?tab=packages");
  await expect(page.getByText("10 aulas de Jiu-Jitsu")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Novo pacote" }).first().click();
  dialog = await expectDialogFits(page);
  await expectMobileInputs(dialog);
});

test("detalhe da turma e matrícula cabem", async ({ page }) => {
  await seedMoney(page);
  await page.goto("/classes/cg-1");
  await expect(page.getByRole("heading", { level: 1, name: "Jiu-Jitsu Adulto Avançado Noite" })).toBeVisible();
  await expect(page.getByText("Aluno Com Nome Bem Comprido da Silva")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Matricular alunos" }).click();
  const dialog = await expectDialogFits(page);
  // Busca de aluno: 16 px e sem teclado aberto sozinho no toque.
  await expectMobileInputs(dialog);
});

test("chamada da aula: linhas, menu do aluno e barra de baixo cabem e marcam", async ({ page }) => {
  await seedMoney(page);
  await page.goto(`/classes/sessions/${encodeURIComponent("cg-1~2026-09-21~17:00")}`);
  const row = rollCallRow(page, "Aluno Com Nome Bem Comprido da Silva");
  await expect(row).toBeVisible();
  await expectNoHorizontalScroll(page);
  for (const [label, button] of [
    ["menu do aluno", page.getByRole("button", { name: "Ações de Bruna Lima", exact: true })],
    ["Todos vieram", page.getByRole("button", { name: "Todos vieram" })],
    ["Concluir chamada", page.getByRole("button", { name: "Concluir chamada" })],
  ] as const) {
    const box = await button.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 375, `${label} dentro da tela`).toBe(true);
  }
  // Tocar na linha marca presente.
  await row.click();
  await expect(row).toHaveAccessibleName("Aluno Com Nome Bem Comprido da Silva: Presente");
  await pageAction(page, "Mais ações da aula", "Adicionar aluno nesta aula");
  await expectDialogFits(page);
  await expectNoHorizontalScroll(page);
});
