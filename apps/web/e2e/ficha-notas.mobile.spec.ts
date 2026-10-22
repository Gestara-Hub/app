import type { Locator, Page } from "@playwright/test";
import {
  classGroup,
  enrollment,
  expect,
  openProfileSection,
  pageAction,
  profileSection,
  seedAcademy,
  student,
  test,
} from "./fixtures";
import {
  ADULT,
  MODULES_TRACK,
  assessment,
  grade,
  gradedSettings,
  jjWhite,
  modality,
} from "./ficha-notas-fixtures";

/**
 * Ficha do aluno e notas no celular (375px): secoes da ficha em sanfona sem
 * rolagem lateral da pagina, "Editar" no menu ⋮, campos de nota com 16px (sem
 * zoom do iOS) e teclado numerico, e dialogos que cabem na tela. Hoje e terca
 * 22/09/2026.
 */

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
});

async function seed(page: Page, scale: "zero_ten" | "zero_hundred" | "concept" = "zero_ten") {
  await seedAcademy(page, {
    extra: (t) => {
      t.categories = [
        modality("m-jj", "Jiu-Jitsu", 0),
        modality("m-ing", "Inglês", 1, { progressionTrack: MODULES_TRACK, assessments: gradedSettings(scale) }),
      ];
      t.clients = [
        student("c-a", "Aluna Com Nome Bem Comprido da Silva", {
          birthDate: ADULT,
          email: "aluna.com.nome.comprido@exemplo.com.br",
          progressions: { "m-jj": jjWhite() },
        }),
        student("c-b", "Aluno Beta", { birthDate: ADULT }),
      ];
      t.classGroups = [classGroup("cg-jj", "Jiu-Jitsu Adulto"), classGroup("cg-ing", "Inglês Noite", { modalityId: "m-ing" })];
      t.enrollments = [
        enrollment("e-1", "cg-jj", "c-a"),
        enrollment("e-2", "cg-ing", "c-a"),
        enrollment("e-3", "cg-ing", "c-b"),
      ];
      t.assessments = [
        assessment("as-1", "cg-ing", "m-ing", "Prova do módulo básico", {
          levelId: "lvl-mod-basic",
          grades: scale === "concept" ? [] : [grade("c-a", scale === "zero_ten" ? 4.5 : 45)],
        }),
      ];
    },
  });
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** O dialogo cabe na largura da tela e nao rola para o lado. */
async function expectDialogFits(page: Page, dialog: Locator) {
  // O painel entra deslizando: mede depois de parar dentro da tela.
  await expect.poll(async () => { const b = await dialog.boundingBox(); return b ? b.x + b.width : 999; }).toBeLessThanOrEqual(375);
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(812);
  const inner = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(inner).toBeLessThanOrEqual(0);
}

test("ficha no celular: seções abrem ali mesmo, a página não rola de lado; Editar no menu ⋮", async ({ page }) => {
  await seed(page);
  await page.goto("/clients/c-a");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Aluna Com Nome Bem Comprido da Silva");
  await expectNoPageOverflow(page);

  // No celular o "Editar" sai do topo: fica no menu ⋮ como "Editar cadastro".
  await expect(page.getByRole("button", { name: "Editar", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Mais ações do aluno", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Nova cobrança" })).toBeVisible();
  await page.keyboard.press("Escape");
  await pageAction(page, "Mais ações do aluno", "Editar cadastro");
  const edit = page.getByRole("dialog", { name: "Editar aluno" });
  await expect(edit).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(edit).toBeHidden();

  // Cada secao abre embaixo do titulo, sem sair da tela (sem pacote, sem "Pacotes").
  await expect(profileSection(page, "Pacotes")).toHaveCount(0);
  const data = await openProfileSection(page, "Cadastro");
  await expect(data).toContainText("aluna.com.nome.comprido@exemplo.com.br");
  await expectNoPageOverflow(page);
  for (const title of ["Cobranças", "Evolução", "Mensagens", "Turmas"] as const) {
    await openProfileSection(page, title);
    await expectNoPageOverflow(page);
  }
});

test("lançar notas no celular: 16px, teclado decimal e o diálogo cabe", async ({ page }) => {
  await seed(page);
  await page.goto("/classes/cg-ing");
  await page.getByRole("tab", { name: /^Avaliações/ }).click();
  await expectNoPageOverflow(page);
  await page.getByRole("button", { name: /^Prova do módulo básico/ }).first().click();
  const sheet = page.getByRole("dialog", { name: "Lançar notas" });
  await expect(sheet.getByLabel("Aluno Beta")).toBeVisible();
  await expectDialogFits(page, sheet);

  for (const name of ["Aluna Com Nome Bem Comprido da Silva", "Aluno Beta"]) {
    const input = sheet.getByLabel(name);
    await expect(input).toHaveAttribute("inputmode", "decimal");
    expect(await input.evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
    await expect(input).not.toBeFocused();
  }
  // Abaixo da minima aparece em vermelho tambem no celular.
  await expect(sheet.getByLabel("Aluna Com Nome Bem Comprido da Silva")).toHaveValue("4,5");
  await sheet.getByLabel("Aluno Beta").fill("9");
  await expect(sheet).toContainText("Média6,8");
  // Botoes Faltou e Sem nota dentro da tela.
  for (const button of await sheet.getByRole("button", { name: /Faltou|Sem nota/ }).all()) {
    const box = await button.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  }
  await sheet.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Notas salvas.")).toBeVisible();
});

test("lançar notas 0 a 100 no celular: teclado numérico", async ({ page }) => {
  await seed(page, "zero_hundred");
  await page.goto("/classes/cg-ing");
  await page.getByRole("tab", { name: /^Avaliações/ }).click();
  await page.getByRole("button", { name: /^Prova do módulo básico/ }).first().click();
  const sheet = page.getByRole("dialog", { name: "Lançar notas" });
  const input = sheet.getByLabel("Aluno Beta");
  await expect(input).toHaveAttribute("inputmode", "numeric");
  expect(await input.evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
  await expectDialogFits(page, sheet);
});

test("conceito no celular: os cinco botões e Faltou/Sem nota cabem na linha", async ({ page }) => {
  await seed(page, "concept");
  await page.goto("/classes/cg-ing");
  await page.getByRole("tab", { name: /^Avaliações/ }).click();
  await page.getByRole("button", { name: /^Prova do módulo básico/ }).first().click();
  const sheet = page.getByRole("dialog", { name: "Lançar notas" });
  await expect(sheet.getByRole("radiogroup", { name: "Conceito de Aluno Beta" })).toBeVisible();
  await expectDialogFits(page, sheet);
  for (const radio of await sheet.getByRole("radio").all()) {
    const box = await radio.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    // Alvo de toque confortavel.
    expect(box!.height).toBeGreaterThanOrEqual(32);
  }
});

test("nova avaliação e boletim no celular cabem na tela", async ({ page }) => {
  await seed(page);
  await page.goto("/classes/cg-ing");
  await page.getByRole("tab", { name: /^Avaliações/ }).click();
  await page.getByRole("button", { name: "Nova avaliação" }).first().click();
  const form = page.getByRole("dialog", { name: "Nova avaliação" });
  await expect(form.getByLabel("Nome")).not.toBeFocused();
  expect(await form.getByLabel("Nome").evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
  expect(await form.getByLabel("Peso").evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
  await expect(form.getByLabel("Peso")).toHaveAttribute("inputmode", "decimal");
  await expectDialogFits(page, form);
  await form.getByRole("button", { name: "Cancelar" }).click();

  await page.goto("/clients/c-a?tab=evolution");
  const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "Inglês", exact: true }) });
  await card.getByRole("button", { name: "Notas" }).click();
  const report = page.getByRole("dialog", { name: "Notas" });
  await expect(report).toContainText("Prova do módulo básico");
  await expectDialogFits(page, report);
  await expectNoPageOverflow(page);
});

test("extrato de cobranças no celular: valor e ações descem sem rolagem lateral", async ({ page }) => {
  await seed(page);
  await page.goto("/clients/c-a?tab=charges");
  const row = page.locator("div.group").filter({ hasText: "Mensalidade" }).first();
  await expect(row).toContainText("R$ 55,00");
  const box = await row.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  await expectNoPageOverflow(page);
});
