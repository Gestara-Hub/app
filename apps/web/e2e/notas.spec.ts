import type { Locator, Page } from "@playwright/test";
import { classGroup, enrollment, expect, readAcademy, seedAcademy, student, test } from "./fixtures";
import {
  ADULT,
  MODULES_TRACK,
  assessment,
  grade,
  gradedSettings,
  modality,
  progression,
  rowOf,
  skipClientsCoachmark,
  waitForStore,
  type Tenant,
} from "./ficha-notas-fixtures";

/**
 * Notas dos alunos (doc 21 §2.2, fase 1): avaliacoes ligadas na modalidade,
 * aba "Avaliações" da turma, "Lançar notas" em cada escala, boletim "Notas"
 * e a auditoria. Hoje e terca 22/09/2026; a turma e seg/ter/qua 17h.
 */

const CLASS_URL = "/classes/cg-ing";
const SESSION = "cg-ing~2026-09-21~17:00";
type Scale = "zero_ten" | "zero_hundred" | "concept" | "pass_fail";

/**
 * Escola com Ingles (modulos, avaliacoes ligadas) e Jiu-Jitsu (sem avaliacoes).
 * Tres alunos matriculados no Ingles Noite, em ordem alfabetica: Alfa, Beta, Gama.
 */
async function seedSchool(page: Page, opts: { scale?: Scale; passing?: number | string; extra?: (t: Tenant) => void } = {}) {
  await seedAcademy(page, {
    extra: (t) => {
      t.organization.classSegment = "languages";
      t.categories = [
        modality("m-jj", "Jiu-Jitsu", 0),
        modality("m-ing", "Inglês", 1, {
          progressionTrack: MODULES_TRACK,
          assessments: gradedSettings(opts.scale ?? "zero_ten", opts.passing),
        }),
      ];
      t.professionals[0].modalityIds = ["m-jj", "m-ing"];
      t.clients = [
        student("c-g", "Aluno Gama", { birthDate: ADULT }),
        student("c-a", "Aluno Alfa", { birthDate: ADULT }),
        student("c-b", "Aluno Beta", { birthDate: ADULT }),
      ];
      t.classGroups = [
        classGroup("cg-ing", "Inglês Noite", { modalityId: "m-ing" }),
        classGroup("cg-jj", "Jiu-Jitsu Adulto"),
      ];
      t.enrollments = [
        enrollment("e-a", "cg-ing", "c-a"),
        enrollment("e-b", "cg-ing", "c-b"),
        enrollment("e-g", "cg-ing", "c-g"),
        enrollment("e-jj", "cg-jj", "c-a"),
      ];
      opts.extra?.(t);
    },
  });
}

const assessmentsTab = (page: Page) => page.getByRole("tab", { name: /^Avaliações/ });

/** Abre a aba Avaliações da turma de Ingles. */
async function openAssessments(page: Page) {
  await page.goto(CLASS_URL);
  await assessmentsTab(page).click();
  await expect(assessmentsTab(page)).toHaveAttribute("aria-selected", "true");
}

/** Abre o "Lançar notas" pela linha da avaliacao. */
async function openSheet(page: Page, name: string): Promise<Locator> {
  await openAssessments(page);
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).first().click();
  const sheet = page.getByRole("dialog", { name: "Lançar notas" });
  await expect(sheet).toContainText(`${name} · Inglês Noite`);
  return sheet;
}

/** Linha de um aluno no lancamento. */
const sheetRow = (sheet: Locator, name: string) =>
  sheet.locator("div.rounded-lg").filter({ has: sheet.page().getByText(name, { exact: true }) });

test.describe("modalidade", () => {
  test("ligar avaliações, trocar a escala e a nota mínima; a aba da turma acompanha", async ({ page }) => {
    await seedSchool(page, {
      extra: (t) => {
        t.categories[1].assessments = undefined;
      },
    });
    // Sem avaliacoes (e sem lista de espera) a turma nao tem abas: so a lista de alunos.
    await page.goto(CLASS_URL);
    await expect(page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true })).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Seções da turma" })).toHaveCount(0);
    await expect(assessmentsTab(page)).toHaveCount(0);

    await page.goto("/classes/modalities");
    await page.getByRole("button", { name: "Ações de Inglês", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Editar/ }).click();
    const dialog = page.getByRole("dialog", { name: "Editar modalidade" });
    const toggle = dialog.getByRole("switch", { name: "Esta modalidade tem avaliações" });
    await expect(toggle).not.toBeChecked();
    await expect(dialog.getByRole("radiogroup", { name: "Escala da nota" })).toHaveCount(0);
    await toggle.click();

    const scale = dialog.getByRole("radiogroup", { name: "Escala da nota" });
    const minimum = dialog.getByLabel("Nota mínima para aprovar");
    await expect(scale.getByRole("radio", { name: "0 a 10", exact: true })).toHaveAttribute("aria-checked", "true");
    await expect(minimum).toHaveValue("6");
    await expect(minimum).toHaveAttribute("inputmode", "decimal");

    // Trocar a escala volta a minima para o padrao dela.
    await scale.getByRole("radio", { name: "0 a 100", exact: true }).click();
    await expect(minimum).toHaveValue("60");
    await expect(minimum).toHaveAttribute("inputmode", "numeric");
    await scale.getByRole("radio", { name: "A a E", exact: true }).click();
    await expect(dialog.getByRole("combobox", { name: /Nota mínima para aprovar/ })).toContainText("C");
    await scale.getByRole("radio", { name: "Apto ou não", exact: true }).click();
    await expect(dialog.getByText("Aprova quem fica apto.")).toBeVisible();

    // Minima fora da escala nao salva.
    await scale.getByRole("radio", { name: "0 a 10", exact: true }).click();
    await minimum.fill("11");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(dialog.getByText("A nota vai de 0 a 10.")).toBeVisible();
    await minimum.fill("7,5");
    await expect(dialog.getByText("A nota vai de 0 a 10.")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Modalidade atualizada com sucesso.")).toBeVisible();
    await expect(dialog).toBeHidden();

    // Reabrir mostra o que foi salvo.
    await page.getByRole("button", { name: "Ações de Inglês", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Editar/ }).click();
    await expect(dialog.getByRole("switch", { name: "Esta modalidade tem avaliações" })).toBeChecked();
    await expect(dialog.getByLabel("Nota mínima para aprovar")).toHaveValue("7,5");
    await dialog.getByRole("button", { name: "Cancelar" }).click();

    await page.goto(CLASS_URL);
    await assessmentsTab(page).click();
    await expect(page.getByText("0 a 10 · Mínima 7,5 · Média da turma")).toBeVisible();
    // A turma de Jiu-Jitsu (sem avaliacoes) segue sem a aba.
    await page.goto("/classes/cg-jj");
    await expect(page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true })).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Seções da turma" })).toHaveCount(0);
  });

  test("nova modalidade em escola de idiomas já vem com avaliações ligadas", async ({ page }) => {
    await seedSchool(page);
    await page.goto("/classes/modalities");
    await page.getByRole("button", { name: "Nova modalidade" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Nova modalidade" });
    await expect(dialog.getByRole("switch", { name: "Esta modalidade tem avaliações" })).toBeChecked();
    await expect(dialog.getByLabel("Nota mínima para aprovar")).toHaveValue("6");
  });

  test("desligar depois esconde a aba e o 'Notas', mas guarda as avaliações", async ({ page }) => {
    await seedSchool(page, {
      extra: (t) => {
        t.assessments = [assessment("as-1", "cg-ing", "m-ing", "Prova 1", { grades: [grade("c-a", 8)] })];
      },
    });
    await page.goto("/classes/modalities");
    await page.getByRole("button", { name: "Ações de Inglês", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Editar/ }).click();
    const dialog = page.getByRole("dialog", { name: "Editar modalidade" });
    await dialog.getByRole("switch", { name: "Esta modalidade tem avaliações" }).click();
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Modalidade atualizada com sucesso.")).toBeVisible();

    await page.goto(CLASS_URL);
    await expect(page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true })).toBeVisible();
    await expect(assessmentsTab(page)).toHaveCount(0);
    await skipClientsCoachmark(page);
    await page.goto("/clients");
    await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Registros de aula" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Notas" })).toHaveCount(0);
    const stored = ((await readAcademy()).assessments ?? []).length;
    expect(stored).toBe(1);
  });
});

test.describe("avaliações da turma", () => {
  test("criar (sugestão, peso decimal, módulo), editar, buscar e excluir", { tag: "@smoke" }, async ({ page }) => {
    await seedSchool(page);
    await openAssessments(page);
    await expect(page.getByText("Nenhuma avaliação ainda.")).toBeVisible();
    await expect(page.getByText("0 a 10 · Mínima 6 · Média da turma")).toBeVisible();

    await page.getByRole("button", { name: "Nova avaliação" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Nova avaliação" });
    await expect(dialog).toContainText("Inglês Noite");
    await expect(dialog.getByLabel("Peso")).toHaveValue("1");
    await expect(dialog.getByLabel("Peso")).toHaveAttribute("inputmode", "decimal");
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(dialog.getByText("Informe o nome da avaliação.")).toBeVisible();

    await dialog.getByRole("button", { name: "+ Prova prática" }).click();
    await expect(dialog.getByLabel("Nome")).toHaveValue("Prova prática");
    await dialog.getByLabel("Peso").fill("0");
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(dialog.getByText("O peso precisa ser maior que zero.")).toBeVisible();
    await dialog.getByLabel("Peso").fill("1,25");
    await expect(dialog.getByText("Use no máximo uma casa decimal no peso.")).toBeVisible();
    await dialog.getByLabel("Peso").fill("101");
    await expect(dialog.getByText("O peso vai até 100.")).toBeVisible();
    await dialog.getByLabel("Peso").fill("1,5");
    await dialog.getByRole("combobox", { name: /Módulo \(opcional\)/ }).click();
    await page.getByRole("menuitem", { name: "Módulo Básico" }).click();
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Avaliação criada.")).toBeVisible();
    await expect(dialog).toBeHidden();

    const row = rowOf(page, "Prova prática");
    await expect(row).toContainText("22/09/2026 · Peso 1,5 · Módulo Básico");
    await expect(row).toContainText("0 de 3 lançadas");
    await expect(row).toContainText("sem nota");
    await expect(assessmentsTab(page)).toContainText("1");

    // Editar pelo menu: nome, peso e sem etapa.
    await page.getByRole("button", { name: "Ações de Prova prática", exact: true }).click();
    await page.getByRole("menuitem", { name: "Editar" }).click();
    const edit = page.getByRole("dialog", { name: "Editar avaliação" });
    await expect(edit.getByLabel("Peso")).toHaveValue("1,5");
    await expect(edit.getByRole("button", { name: "+ Prova" })).toHaveCount(0);
    await edit.getByLabel("Nome").fill("Prova final");
    await edit.getByLabel("Peso").fill("2");
    await edit.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Avaliação atualizada.")).toBeVisible();
    await expect(rowOf(page, "Prova final")).toContainText("Peso 2");

    // Busca.
    await page.getByLabel("Buscar avaliação").fill("final");
    await expect(page.getByText("1 avaliação", { exact: true })).toBeVisible();
    await page.getByLabel("Buscar avaliação").fill("xyz");
    await expect(rowOf(page, "Prova final")).toHaveCount(0);
    await page.getByLabel("Buscar avaliação").fill("");

    // Excluir pelo clique direito, com confirmacao.
    await rowOf(page, "Prova final").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Excluir" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Excluir avaliação?");
    await expect(confirm).toContainText("Prova final e as notas lançadas saem do boletim dos alunos.");
    await confirm.getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByText("Avaliação excluída.")).toBeVisible();
    await expect(page.getByText("Nenhuma avaliação ainda.")).toBeVisible();
  });

  test("criar e lançar notas entram na auditoria com o tipo 'Avaliação'", async ({ page }) => {
    await seedSchool(page);
    await openAssessments(page);
    await page.getByRole("button", { name: "Nova avaliação" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Nova avaliação" });
    await dialog.getByLabel("Nome").fill("Prova oral");
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Avaliação criada.")).toBeVisible();

    await page.getByRole("button", { name: /^Prova oral/ }).first().click();
    const sheet = page.getByRole("dialog", { name: "Lançar notas" });
    await sheet.getByLabel("Aluno Alfa").fill("9");
    await sheet.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Notas salvas.")).toBeVisible();
    await waitForStore(page, (raw) => raw.includes("lançou as notas"));

    await page.goto("/audit");
    await page.getByRole("combobox", { name: "Filtrar por tipo" }).click();
    await page.getByRole("option", { name: "Avaliação", exact: true }).click();
    const list = page.getByRole("main");
    await expect(list.getByText(/criou a avaliação/).first()).toBeVisible();
    await expect(list.getByText(/lançou as notas de Prova oral da turma Inglês Noite/)).toBeVisible();
  });
});

test.describe("lançar notas", () => {
  test("0 a 10: vírgula, abaixo da mínima, média ao vivo, faltou, sem nota e nota inválida", { tag: "@smoke" }, async ({ page }) => {
    await seedSchool(page, {
      extra: (t) => {
        t.assessments = [assessment("as-1", "cg-ing", "m-ing", "Prova 1", { levelId: "lvl-mod-basic" })];
      },
    });
    const sheet = await openSheet(page, "Prova 1");
    // Ordem alfabetica e teclado decimal.
    await expect(sheet.locator("label")).toHaveText(["Aluno Alfa", "Aluno Beta", "Aluno Gama"]);
    const alfa = sheet.getByLabel("Aluno Alfa");
    await expect(alfa).toHaveAttribute("inputmode", "decimal");
    await expect(sheet).toContainText("Lançadas 0 de 3 · Mínima 6");
    await expect(sheet).toContainText("Média–");

    await alfa.fill("8,5");
    await sheet.getByLabel("Aluno Beta").fill("5");
    await expect(sheet).toContainText("Lançadas 2 de 3");
    await expect(sheet).toContainText("Média6,8");
    // Abaixo da minima: linha e campo em vermelho.
    await expect(sheetRow(sheet, "Aluno Beta")).toHaveClass(/bg-red-50/);
    await expect(sheetRow(sheet, "Aluno Alfa")).not.toHaveClass(/bg-red-50/);

    await sheetRow(sheet, "Aluno Gama").getByRole("button", { name: "Faltou" }).click();
    await expect(sheetRow(sheet, "Aluno Gama").getByRole("button", { name: "Faltou" })).toHaveAttribute("aria-pressed", "true");
    await expect(sheet).toContainText("Lançadas 3 de 3");
    await expect(sheet).toContainText("Média6,8");

    // Nota invalida: aviso na linha e nada salva.
    await sheet.getByLabel("Aluno Beta").fill("11");
    await expect(sheetRow(sheet, "Aluno Beta")).toContainText("A nota vai de 0 a 10.");
    await sheet.getByLabel("Aluno Beta").fill("7,55");
    await expect(sheetRow(sheet, "Aluno Beta")).toContainText("Use no máximo uma casa decimal.");
    await sheet.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Confira as notas destacadas.")).toBeVisible();
    await expect(sheet).toBeVisible();
    await sheet.getByLabel("Aluno Beta").fill("5");
    await sheet.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Notas salvas.")).toBeVisible();
    await expect(sheet).toBeHidden();

    const row = rowOf(page, "Prova 1");
    await expect(row).toContainText("3 de 3 lançadas");
    await expect(row).toContainText("6,8");
    await expect(page.getByText(/Média da turma/)).toContainText("6,8");

    // Reabrir: o que foi salvo volta; "Sem nota" apaga a do Alfa.
    await page.getByRole("button", { name: /^Prova 1/ }).first().click();
    await expect(sheet.getByLabel("Aluno Alfa")).toHaveValue("8,5");
    await expect(sheetRow(sheet, "Aluno Gama").getByRole("button", { name: "Faltou" })).toHaveAttribute("aria-pressed", "true");
    await sheetRow(sheet, "Aluno Alfa").getByRole("button", { name: "Sem nota" }).click();
    await expect(sheet.getByLabel("Aluno Alfa")).toHaveValue("");
    await expect(sheetRow(sheet, "Aluno Alfa").getByRole("button", { name: "Sem nota" })).toHaveAttribute("aria-pressed", "true");
    await expect(sheet).toContainText("Média5");
    await sheet.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Notas salvas.")).toBeVisible();
    await expect(row).toContainText("2 de 3 lançadas");
    // Media 5 abaixo da minima: em vermelho.
    await expect(row.locator("span.rounded-full").filter({ hasText: /^5$/ })).toHaveClass(/text-red-700/);
  });

  test("fechar sem mudar nada não salva; Cancelar descarta", async ({ page }) => {
    await seedSchool(page, {
      extra: (t) => {
        t.assessments = [assessment("as-1", "cg-ing", "m-ing", "Prova 1", { grades: [grade("c-a", 7)] })];
      },
    });
    const sheet = await openSheet(page, "Prova 1");
    await sheet.getByRole("button", { name: "Salvar" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText("Notas salvas.")).toHaveCount(0);

    await page.getByRole("button", { name: /^Prova 1/ }).first().click();
    await sheet.getByLabel("Aluno Alfa").fill("2");
    await sheet.getByRole("button", { name: "Cancelar" }).click();
    await expect(sheet).toBeHidden();
    await expect(rowOf(page, "Prova 1")).toContainText("1 de 3 lançadas");
    await expect(rowOf(page, "Prova 1")).toContainText("7");
  });

  test("0 a 100: teclado numérico, nota inteira, mínima 60", async ({ page }) => {
    await seedSchool(page, {
      scale: "zero_hundred",
      extra: (t) => {
        t.assessments = [assessment("as-1", "cg-ing", "m-ing", "Simulado")];
      },
    });
    const sheet = await openSheet(page, "Simulado");
    await expect(sheet).toContainText("Mínima 60");
    const alfa = sheet.getByLabel("Aluno Alfa");
    await expect(alfa).toHaveAttribute("inputmode", "numeric");
    await alfa.fill("75,5");
    await expect(sheetRow(sheet, "Aluno Alfa")).toContainText("Use uma nota inteira.");
    await alfa.fill("101");
    await expect(sheetRow(sheet, "Aluno Alfa")).toContainText("A nota vai de 0 a 100.");
    await alfa.fill("90");
    await sheet.getByLabel("Aluno Beta").fill("59");
    await expect(sheetRow(sheet, "Aluno Beta")).toHaveClass(/bg-red-50/);
    await expect(sheet).toContainText("Média75");
    await sheet.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Notas salvas.")).toBeVisible();
    await expect(rowOf(page, "Simulado")).toContainText("2 de 3 lançadas");
    await expect(rowOf(page, "Simulado")).toContainText("75");
    await expect(page.getByText("0 a 100 · Mínima 60 · Média da turma")).toBeVisible();
  });

  test("conceito A a E: botões, desmarcar, abaixo da mínima e média em letra", async ({ page }) => {
    await seedSchool(page, {
      scale: "concept",
      extra: (t) => {
        t.assessments = [assessment("as-1", "cg-ing", "m-ing", "Redação")];
      },
    });
    const sheet = await openSheet(page, "Redação");
    await expect(sheet).toContainText("Mínima C");
    await expect(sheet.getByRole("textbox")).toHaveCount(0);
    const alfa = sheet.getByRole("radiogroup", { name: "Conceito de Aluno Alfa" });
    const beta = sheet.getByRole("radiogroup", { name: "Conceito de Aluno Beta" });
    await expect(alfa.getByRole("radio")).toHaveText(["A", "B", "C", "D", "E"]);
    await alfa.getByRole("radio", { name: "A", exact: true }).click();
    await expect(alfa.getByRole("radio", { name: "A", exact: true })).toHaveAttribute("aria-checked", "true");
    await beta.getByRole("radio", { name: "D", exact: true }).click();
    await expect(beta.getByRole("radio", { name: "D", exact: true })).toHaveClass(/text-red-700/);
    await expect(sheetRow(sheet, "Aluno Beta")).toHaveClass(/bg-red-50/);
    // A=10 e D=4: media 7 = B.
    await expect(sheet).toContainText("MédiaB");
    // Tocar de novo desmarca.
    await beta.getByRole("radio", { name: "D", exact: true }).click();
    await expect(beta.getByRole("radio", { name: "D", exact: true })).toHaveAttribute("aria-checked", "false");
    await expect(sheet).toContainText("MédiaA");
    await beta.getByRole("radio", { name: "E", exact: true }).click();
    await sheet.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Notas salvas.")).toBeVisible();
    // A=10 e E=2: media 6 = C.
    await expect(rowOf(page, "Redação")).toContainText("2 de 3 lançadas");
    await expect(rowOf(page, "Redação").locator("span.rounded-full")).toHaveText("C");
    await expect(page.getByText("A a E · Mínima C · Média da turma")).toBeVisible();
  });

  test("apto ou não apto: botões, fração de aptos e aprovação pela maioria", async ({ page }) => {
    await seedSchool(page, {
      scale: "pass_fail",
      extra: (t) => {
        t.assessments = [assessment("as-1", "cg-ing", "m-ing", "Exame prático")];
      },
    });
    const sheet = await openSheet(page, "Exame prático");
    await expect(sheet).toContainText("Mínima: apto");
    for (const [name, result] of [
      ["Aluno Alfa", "Apto"],
      ["Aluno Beta", "Não apto"],
      ["Aluno Gama", "Apto"],
    ] as const) {
      await sheet.getByRole("radiogroup", { name: `Resultado de ${name}` }).getByRole("radio", { name: result, exact: true }).click();
    }
    await expect(sheetRow(sheet, "Aluno Beta").getByRole("radio", { name: "Não apto", exact: true })).toHaveClass(/text-red-700/);
    await expect(sheet).toContainText("Média67% aptos");
    await sheet.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Notas salvas.")).toBeVisible();
    await expect(rowOf(page, "Exame prático")).toContainText("3 de 3 lançadas");
    await expect(rowOf(page, "Exame prático")).toContainText("67% aptos");
    await expect(page.getByText("Apto ou não · Mínima: apto · Média da turma")).toBeVisible();
  });

  test("turma sem alunos: lançamento vazio", async ({ page }) => {
    await seedSchool(page, {
      extra: (t) => {
        t.enrollments = [];
        t.assessments = [assessment("as-1", "cg-ing", "m-ing", "Prova 1")];
      },
    });
    const sheet = await openSheet(page, "Prova 1");
    await expect(sheet).toContainText("Nenhum aluno matriculado nesta turma.");
    await expect(sheet).toContainText("Lançadas 0 de 0");
  });
});

/** Ingles com notas em dois modulos e uma sem etapa; Alfa tambem tem Musica (0 a 100). */
function reportCardWorld(t: Tenant) {
  t.categories.push(
    modality("m-mus", "Teoria Musical", 2, {
      progressionTrack: MODULES_TRACK,
      assessments: gradedSettings("zero_hundred"),
    }),
  );
  t.classGroups.push(classGroup("cg-mus", "Teoria Sábado", { modalityId: "m-mus" }));
  t.enrollments.push(enrollment("e-mus", "cg-mus", "c-a"));
  t.assessments = [
    assessment("as-1", "cg-ing", "m-ing", "Prova do módulo 1", {
      date: "2026-09-01",
      levelId: "lvl-mod-basic",
      grades: [grade("c-a", 9), grade("c-b", 4)],
    }),
    assessment("as-2", "cg-ing", "m-ing", "Prova do módulo 2", {
      date: "2026-09-10",
      weight: 2,
      levelId: "lvl-mod-pre",
      grades: [grade("c-a", 6), grade("c-b", undefined, "absent")],
    }),
    assessment("as-3", "cg-ing", "m-ing", "Trabalho", {
      date: "2026-09-15",
      grades: [grade("c-a", 5.5)],
    }),
    assessment("as-4", "cg-mus", "m-mus", "Ditado", { date: "2026-09-12", grades: [grade("c-a", 80)] }),
  ];
  t.clients.find((c: Tenant) => c.id === "c-a").progressions = {
    "m-ing": progression("m-ing", "Inglês", "lvl-mod-pre", "Módulo Pré-intermediário"),
  };
}

/** Confere o boletim do Aluno Alfa em Ingles. */
async function expectAlfaReportCard(dialog: Locator) {
  await expect(dialog).toContainText("Aluno Alfa");
  // Geral ponderada: (9*1 + 6*2 + 5,5*1) / 4 = 6,625 -> 6,6.
  const overall = dialog.locator("div.rounded-lg").filter({ hasText: "Média geral" });
  await expect(overall).toContainText("0 a 10 · Mínima 6");
  await expect(overall).toContainText("6,6");
  await expect(dialog.getByText("Média por módulo")).toBeVisible();
  const levels = dialog.locator("ul").first().getByRole("listitem");
  await expect(levels).toHaveText([/Módulo Básico\s*9/, /Módulo Pré-intermediário\s*6/, /Sem módulo\s*5,5/]);
  await expect(dialog.getByText("Avaliações (3)")).toBeVisible();
  const entries = dialog.locator("ul").nth(1).getByRole("listitem");
  // Mais recente primeiro; abaixo da minima em destaque.
  await expect(entries.nth(0)).toContainText("Trabalho");
  await expect(entries.nth(0)).toContainText("15/09/2026 · Peso 1 · Inglês Noite");
  await expect(entries.nth(0)).toHaveClass(/bg-red-50/);
  await expect(entries.nth(1)).toContainText("Prova do módulo 2");
  await expect(entries.nth(1)).toContainText("10/09/2026 · Peso 2 · Módulo Pré-intermediário · Inglês Noite");
  await expect(entries.nth(1)).not.toHaveClass(/bg-red-50/);
  await expect(entries.nth(2)).toContainText("Prova do módulo 1");
}

test.describe("boletim 'Notas'", () => {
  test("pelo menu do aluno em Alunos: médias por módulo e geral, e a troca de modalidade", async ({ page }) => {
    await seedSchool(page, { extra: reportCardWorld });
    await skipClientsCoachmark(page);
    await page.goto("/clients");
    await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
    await page.getByRole("menuitem", { name: "Notas" }).click();
    const dialog = page.getByRole("dialog", { name: "Notas" });
    const picker = dialog.getByRole("tablist", { name: "Modalidade" });
    await expect(picker.getByRole("tab")).toHaveText(["Inglês", "Teoria Musical"]);
    await expectAlfaReportCard(dialog);

    await picker.getByRole("tab", { name: "Teoria Musical" }).click();
    await expect(picker.getByRole("tab", { name: "Teoria Musical" })).toHaveAttribute("aria-selected", "true");
    await expect(dialog).toContainText("0 a 100 · Mínima 60");
    await expect(dialog).toContainText("Ditado");
    await expect(dialog).toContainText("80");
    await expect(dialog.getByText("Avaliações (1)")).toBeVisible();
  });

  test("faltou aparece no boletim e fica fora da média", async ({ page }) => {
    await seedSchool(page, { extra: reportCardWorld });
    await skipClientsCoachmark(page);
    await page.goto("/clients");
    await page.getByRole("button", { name: "Ações de Aluno Beta", exact: true }).click();
    await page.getByRole("menuitem", { name: "Notas" }).click();
    const dialog = page.getByRole("dialog", { name: "Notas" });
    // Beta so tem Ingles: sem a troca de modalidade.
    await expect(dialog.getByRole("tablist", { name: "Modalidade" })).toHaveCount(0);
    const overall = dialog.locator("div.rounded-lg").filter({ hasText: "Média geral" });
    await expect(overall).toContainText("4");
    await expect(overall.locator("span.rounded-full")).toHaveClass(/text-red-700/);
    await expect(dialog.getByRole("listitem").filter({ hasText: "Prova do módulo 2" })).toContainText("Faltou");
    // Trabalho sem nota do Beta aparece como "Sem nota".
    await expect(dialog.getByRole("listitem").filter({ hasText: "Trabalho" })).toContainText("Sem nota");
  });

  test("pela lista da turma, pela chamada e pela ficha do aluno", async ({ page }) => {
    await seedSchool(page, { extra: reportCardWorld });
    await page.goto(CLASS_URL);
    await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
    await page.getByRole("menuitem", { name: "Notas" }).click();
    await expectAlfaReportCard(page.getByRole("dialog", { name: "Notas" }));
    await page.keyboard.press("Escape");

    await page.goto(`/classes/sessions/${encodeURIComponent(SESSION)}`);
    await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
    await page.getByRole("menuitem", { name: "Notas" }).click();
    await expectAlfaReportCard(page.getByRole("dialog", { name: "Notas" }));
    await page.keyboard.press("Escape");

    // Ficha: o botao "Notas" do card de Ingles abre o boletim nessa modalidade.
    await page.goto("/clients/c-a?tab=evolution");
    const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "Inglês" }) });
    await expect(card).toContainText("Módulo Pré-intermediário");
    await card.getByRole("button", { name: "Notas" }).click();
    const dialog = page.getByRole("dialog", { name: "Notas" });
    await expect(dialog.getByRole("tab", { name: "Inglês" })).toHaveAttribute("aria-selected", "true");
    await expectAlfaReportCard(dialog);
  });

  test("sem modalidade com avaliações, o 'Notas' some de Alunos, da turma e da chamada", async ({ page }) => {
    await seedSchool(page, {
      extra: (t) => {
        t.categories[1].assessments = { enabled: false, scale: "zero_ten", passingGrade: 6 };
      },
    });
    await skipClientsCoachmark(page);
    await page.goto("/clients");
    await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Registros de aula" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Notas" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.goto(CLASS_URL);
    await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Registros de aula" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Notas" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.goto(`/classes/sessions/${encodeURIComponent(SESSION)}`);
    await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Módulos" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Notas" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.goto("/clients/c-a?tab=evolution");
    await expect(page.getByRole("heading", { name: "Inglês" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Notas" })).toHaveCount(0);
  });

  test("aluno que saiu da turma sai do lançamento, mas a nota fica no boletim", async ({ page }) => {
    await seedSchool(page, {
      extra: (t) => {
        reportCardWorld(t);
        t.enrollments = t.enrollments.map((e: Tenant) =>
          e.id === "e-b" ? { ...e, status: "canceled", canceledAt: "2026-09-20T12:00:00.000Z" } : e,
        );
      },
    });
    await openAssessments(page);
    // Prova 1: so Alfa conta (Beta saiu): 1 de 2 lancadas.
    await expect(rowOf(page, "Prova do módulo 1")).toContainText("1 de 2 lançadas");
    await page.getByRole("button", { name: /^Prova do módulo 1/ }).first().click();
    const sheet = page.getByRole("dialog", { name: "Lançar notas" });
    await expect(sheet.locator("label")).toHaveText(["Aluno Alfa", "Aluno Gama"]);
    await page.keyboard.press("Escape");

    await skipClientsCoachmark(page);
    await page.goto("/clients");
    await page.getByRole("button", { name: "Ações de Aluno Beta", exact: true }).click();
    await page.getByRole("menuitem", { name: "Notas" }).click();
    await expect(page.getByRole("dialog", { name: "Notas" })).toContainText("Prova do módulo 1");
  });
});

test.describe("fase A: soma dos pontos, recuperação e frequência mínima (31/10/2026)", () => {
  test("modalidade: soma dos pontos troca a mínima por total; frequência mínima de 1 a 100", async ({ page }) => {
    await seedSchool(page);
    await page.goto("/classes/modalities");
    await page.getByRole("button", { name: "Ações de Inglês", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Editar/ }).click();
    const dialog = page.getByRole("dialog", { name: "Editar modalidade" });
    const mode = dialog.getByRole("radiogroup", { name: "Como fecha o resultado" });
    await expect(mode.getByRole("radio", { name: "Média com pesos" })).toHaveAttribute("aria-checked", "true");
    await expect(dialog.getByText("Cada avaliação tem um peso na média.")).toBeVisible();
    await mode.getByRole("radio", { name: "Soma dos pontos" }).click();
    await expect(dialog.getByText("Cada avaliação vale uma parte dos 10 pontos.")).toBeVisible();
    await expect(dialog.getByLabel("Total mínimo para aprovar")).toHaveValue("6");
    // Conceito e apto nao somam pontos.
    await dialog.getByRole("radiogroup", { name: "Escala da nota" }).getByRole("radio", { name: "A a E", exact: true }).click();
    await expect(mode).toHaveCount(0);
    await dialog.getByRole("radiogroup", { name: "Escala da nota" }).getByRole("radio", { name: "0 a 10", exact: true }).click();

    await dialog.getByLabel("Frequência mínima (%)").fill("0");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(dialog.getByText("Use um número inteiro de 1 a 100.")).toBeVisible();
    await dialog.getByLabel("Frequência mínima (%)").fill("75");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Modalidade atualizada com sucesso.")).toBeVisible();

    await openAssessments(page);
    await expect(page.getByText("0 a 10 · Mínimo 6 de 10 · Frequência mínima 75% · Total da turma")).toBeVisible();
  });

  test("soma dos pontos: cada avaliação vale uma parte e o boletim mostra o total", async ({ page }) => {
    await seedSchool(page, {
      extra: (t) => {
        t.categories[1].assessments = { ...gradedSettings("zero_ten"), resultMode: "sum" };
        t.assessments = [
          assessment("as-1", "cg-ing", "m-ing", "Prova 1", { points: 4, grades: [grade("c-a", 3)] }),
          assessment("as-2", "cg-ing", "m-ing", "Trabalho", { date: "2026-09-16", points: 6, grades: [grade("c-a", 5)] }),
        ];
      },
    });
    await openAssessments(page);
    await expect(rowOf(page, "Prova 1")).toContainText("15/09/2026 · Vale 4");

    const sheet = await openSheet(page, "Prova 1");
    await expect(sheet).toContainText("Mínimo 6 de 10 · Vale 4");
    await sheet.getByLabel("Aluno Beta").fill("4,5");
    await expect(sheet.getByText("A nota vai de 0 a 4.")).toBeVisible();
    await sheet.getByRole("button", { name: "Cancelar" }).click();

    await skipClientsCoachmark(page);
    await page.goto("/clients");
    await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
    await page.getByRole("menuitem", { name: "Notas" }).click();
    const card = page.getByRole("dialog", { name: "Notas" });
    const total = card.locator("div.rounded-lg").filter({ hasText: "Total" }).first();
    await expect(total).toContainText("8");
    await expect(total).toContainText("de 10");
    await expect(total).toContainText("Nota acima da mínima");
  });

  test("recuperação: escolhe a prova, mostra a nota original e o boletim usa a maior", async ({ page }) => {
    await seedSchool(page, {
      extra: (t) => {
        t.assessments = [
          assessment("as-1", "cg-ing", "m-ing", "Prova 1", { grades: [grade("c-a", 4), grade("c-b", undefined, "absent")] }),
        ];
      },
    });
    await openAssessments(page);
    await page.getByRole("button", { name: "Nova avaliação" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Nova avaliação" });
    await dialog.getByLabel("Nome").fill("Recuperação");
    await dialog.getByRole("combobox", { name: /Recuperação de/ }).click();
    await page.getByRole("menuitem", { name: "Prova 1" }).click();
    // A recuperacao herda o peso: sem o campo.
    await expect(dialog.getByLabel("Peso")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Avaliação criada.")).toBeVisible();
    await expect(rowOf(page, "Recuperação")).toContainText("Recuperação de Prova 1");

    await page.getByRole("button", { name: /^Recuperação/ }).first().click();
    const sheet = page.getByRole("dialog", { name: "Lançar notas" });
    await expect(sheet).toContainText("Recuperação de Prova 1: vale a maior nota de cada aluno.");
    await expect(sheetRow(sheet, "Aluno Alfa")).toContainText("Prova 1: 4");
    await expect(sheetRow(sheet, "Aluno Beta")).toContainText("Prova 1: faltou");
    await sheet.getByLabel("Aluno Alfa").fill("7");
    await sheet.getByLabel("Aluno Beta").fill("8");
    await sheet.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Notas salvas.")).toBeVisible();

    await skipClientsCoachmark(page);
    await page.goto("/clients");
    await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
    await page.getByRole("menuitem", { name: "Notas" }).click();
    const card = page.getByRole("dialog", { name: "Notas" });
    await expect(card.locator("div.rounded-lg").filter({ hasText: "Média geral" }).first()).toContainText("7");
    await expect(
      card.getByRole("listitem").filter({ has: page.getByText("Prova 1", { exact: true }) }),
    ).toContainText("Ficou 7 com a recuperação");
  });

  test("frequência mínima: o boletim mostra a frequência nas turmas da modalidade", async ({ page }) => {
    await seedSchool(page, {
      extra: (t) => {
        t.categories[1].assessments = { ...gradedSettings("zero_ten"), minAttendancePercent: 75 };
        t.assessments = [assessment("as-1", "cg-ing", "m-ing", "Prova 1", { grades: [grade("c-a", 8)] })];
        t.attendances = [
          { id: "at-1", sessionId: "cg-ing~2026-09-14~17:00", studentId: "c-a", status: "present", markedAt: "2026-09-14T20:00:00.000Z" },
          { id: "at-2", sessionId: "cg-ing~2026-09-15~17:00", studentId: "c-a", status: "absent", markedAt: "2026-09-15T20:00:00.000Z" },
        ];
      },
    });
    await skipClientsCoachmark(page);
    await page.goto("/clients");
    await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
    await page.getByRole("menuitem", { name: "Notas" }).click();
    const card = page.getByRole("dialog", { name: "Notas" });
    await expect(card).toContainText("Frequência mínima 75%");
    await expect(card).toContainText("Nota acima da mínima");
    await expect(card).toContainText("Frequência 50%, abaixo da mínima");
  });
});
