import type { Page } from "@playwright/test";
import { classGroup, enrollment, expect, openProfileSection, seedAcademy, student, test } from "./fixtures";
import { skipClientsCoachmark } from "./ficha-notas-fixtures";

/**
 * Testes e medidas (doc 21 §2.4, fase B de 31/10/2026): a modalidade liga e
 * define as medidas; a avaliacao e por aluno; a ficha mostra a evolucao (a
 * mudanca verde quando melhora pela direcao da medida). Hoje e 22/09/2026.
 */

const TS = "2026-09-01T12:00:00.000Z";
const MEASURES = [
  { id: "me-peso", name: "Peso", unit: "kg", better: "lower" },
  { id: "me-prancha", name: "Prancha", unit: "s", better: "higher" },
];

/** Jiu-Jitsu com medidas ligadas, Aluno Alfa matriculado e uma avaliacao de 01/09. */
async function seedMeasured(page: Page, opts: { history?: boolean } = {}) {
  await seedAcademy(page, {
    extra: (t) => {
      t.categories[0].measurements = { enabled: true, measures: MEASURES };
      t.clients = [student("c-a", "Aluno Alfa", { planId: undefined })];
      t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
      t.enrollments = [enrollment("e-a", "cg-1", "c-a")];
      t.studentMeasurements = opts.history
        ? [
            {
              id: "sm-1",
              organizationId: "org-academia-x",
              studentId: "c-a",
              modalityId: "m-jj",
              date: "2026-09-01",
              values: { "me-peso": 80, "me-prancha": 30 },
              createdBy: "usr-ac-ana",
              createdAt: TS,
              updatedAt: TS,
            },
          ]
        : [];
    },
  });
}

async function openFromList(page: Page) {
  await skipClientsCoachmark(page);
  await page.goto("/clients");
  await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
  await page.getByRole("menuitem", { name: "Testes e medidas" }).click();
  const dialog = page.getByRole("dialog", { name: "Testes e medidas" });
  await expect(dialog).toContainText("Aluno Alfa");
  return dialog;
}

const measureRow = (page: Page, name: string) =>
  page.getByRole("dialog", { name: "Testes e medidas" }).getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) });

test("modalidade: ligar testes e medidas, usar as sugestões, trocar a direção e salvar", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/classes/modalities");
  await page.getByRole("button", { name: "Ações de Jiu-Jitsu", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Editar/ }).click();
  const dialog = page.getByRole("dialog", { name: "Editar modalidade" });
  await dialog.getByRole("switch", { name: "Esta modalidade tem testes e medidas" }).click();
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog.getByText("Adicione pelo menos uma medida.")).toBeVisible();

  await dialog.getByRole("button", { name: "+ Peso (kg)" }).click();
  await dialog.getByRole("button", { name: "+ Prancha (s)" }).click();
  // A sugestao usada sai da lista.
  await expect(dialog.getByRole("button", { name: "+ Peso (kg)" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /^Peso: melhor descer/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Adicionar medida" }).click();
  await dialog.getByLabel("Nome da medida 3").fill("Agachamentos");
  await dialog.getByLabel("Unidade de Agachamentos").fill("rep");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Modalidade atualizada com sucesso.")).toBeVisible();

  // Reabrir mostra as tres medidas.
  await page.getByRole("button", { name: "Ações de Jiu-Jitsu", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Editar/ }).click();
  const again = page.getByRole("dialog", { name: "Editar modalidade" });
  await expect(again.getByLabel("Nome da medida 1")).toHaveValue("Peso");
  await expect(again.getByLabel("Nome da medida 3")).toHaveValue("Agachamentos");
  await expect(again.getByRole("button", { name: /^Agachamentos: melhor subir/ })).toBeVisible();
});

test("aluno: nova avaliação pela lista, evolução pela direção, editar e excluir", async ({ page }) => {
  await seedMeasured(page, { history: true });
  const dialog = await openFromList(page);
  await expect(measureRow(page, "Peso")).toContainText("80 kg");

  await dialog.getByRole("button", { name: "Nova avaliação" }).click();
  const form = page.getByRole("dialog", { name: "Nova avaliação" });
  await expect(form).toContainText("Aluno Alfa · Jiu-Jitsu");
  await form.getByRole("button", { name: "Adicionar" }).click();
  await expect(form.getByText("Preencha pelo menos uma medida.")).toBeVisible();
  await form.getByLabel("Peso (kg)").fill("78,5");
  await form.getByLabel("Prancha (s)").fill("abc");
  await form.getByRole("button", { name: "Adicionar" }).click();
  await expect(form.getByText("Use um número, como 12,5.")).toBeVisible();
  await form.getByLabel("Prancha (s)").fill("45");
  await form.getByLabel("Observação (opcional)").fill("Sem dor no joelho.");
  await form.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("Avaliação registrada.")).toBeVisible();

  // Peso desceu (melhor descer) e prancha subiu (melhor subir): as duas em verde.
  await expect(measureRow(page, "Peso")).toContainText("−1,5 kg");
  await expect(measureRow(page, "Peso")).toContainText("antes 80 kg");
  await expect(measureRow(page, "Peso").getByTitle("Melhorou")).toBeVisible();
  await expect(measureRow(page, "Prancha")).toContainText("+15 s");
  await expect(dialog).toContainText("Avaliações (2)");
  await expect(dialog).toContainText("Sem dor no joelho.");

  // Editar a de hoje: peso maior vira piora (vermelho).
  await dialog.getByRole("button", { name: "Ações da avaliação de 22/09/2026" }).click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  const edit = page.getByRole("dialog", { name: "Editar avaliação" });
  await expect(edit.getByLabel("Peso (kg)")).toHaveValue("78,5");
  await edit.getByLabel("Peso (kg)").fill("81");
  await edit.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Avaliação atualizada.")).toBeVisible();
  await expect(measureRow(page, "Peso")).toContainText("+1 kg");
  await expect(measureRow(page, "Peso").getByTitle("Piorou")).toBeVisible();

  // Excluir pede confirmacao.
  await dialog.getByRole("button", { name: "Ações da avaliação de 22/09/2026" }).click();
  await page.getByRole("menuitem", { name: "Excluir" }).click();
  await page.getByRole("alertdialog", { name: "Excluir avaliação?" }).getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByText("Avaliação excluída.")).toBeVisible();
  await expect(dialog).toContainText("Avaliações (1)");
});

test("ficha: o atalho 'Testes e medidas' aparece na Evolução, mesmo sem trilha", async ({ page }) => {
  await seedMeasured(page);
  await page.goto("/clients/c-a");
  const evolution = await openProfileSection(page, "Evolução");
  await evolution.getByRole("button", { name: "Testes e medidas" }).click();
  const dialog = page.getByRole("dialog", { name: "Testes e medidas" });
  await expect(dialog).toContainText("Sem medida ainda");
  await expect(dialog).toContainText("Nenhuma avaliação ainda.");
});

test("sem modalidade com medidas, o item some do menu do aluno", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [student("c-a", "Aluno Alfa", { planId: undefined })];
    },
  });
  await skipClientsCoachmark(page);
  await page.goto("/clients");
  await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Notas" }).or(page.getByRole("menuitem").first())).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Testes e medidas" })).toHaveCount(0);
});
