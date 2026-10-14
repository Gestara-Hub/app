import type { Page } from "@playwright/test";
import { expect, seedAcademy, student, test } from "./fixtures";

/** Cobranca avulsa (doc 20, fase A). Relogio fixo em 22/09/2026. */

const TS = "2026-09-01T12:00:00.000Z";

/** A linha inteira (texto + valor + acoes) de um aluno na lista de Mensalidades. */
const rowOf = (page: Page, name: string) => page.locator("div.group").filter({ hasText: name });

/** Abre o menu ⋮ da cobranca e escolhe a acao. */
async function rowAction(page: Page, name: string, action: string) {
  await page.getByRole("button", { name: `Ações de ${name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: action }).click();
}

/** Aluno sem plano (sem mensalidade), so com cobrancas avulsas. */
const noPlan = (id: string, name: string) => student(id, name, { planId: undefined });

/** Cobranca avulsa em aberto gravada direto no mundo do mock. */
function extraCharge(id: string, studentId: string, over: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: "org-academia-x",
    unitId: "unit-academia-x",
    studentId,
    kind: "extra",
    description: "Kimono",
    competence: "2026-09",
    dueDate: "2026-09-25",
    amountCents: 25000,
    status: "pending",
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

test("Mensalidades: nova cobrança com sugestão e 3 parcelas, filtro por tipo na URL", async ({ page }) => {
  await seedAcademy(page, { extra: (t) => (t.clients = [noPlan("c-e", "Aluno Extra")]) });
  await page.goto("/classes/billing");
  await expect(page.getByText("Nenhuma cobrança nesta competência.")).toBeVisible();

  await page.getByRole("button", { name: "Nova cobrança" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova cobrança" });

  // Erros de campo antes de enviar.
  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(dialog.getByText("Selecione o aluno.")).toBeVisible();
  await expect(dialog.getByText("Descreva a cobrança.")).toBeVisible();
  await expect(dialog.getByText("Informe o valor.")).toBeVisible();

  await dialog.getByRole("combobox", { name: "Aluno" }).click();
  await page.getByRole("option", { name: "Aluno Extra" }).click();
  await dialog.getByRole("button", { name: "+ Taxa de matrícula" }).click();
  await expect(dialog.getByLabel("Descrição")).toHaveValue("Taxa de matrícula");
  await dialog.getByLabel("Valor").fill("10000");
  await expect(dialog.getByLabel("Valor")).toHaveValue("100,00");
  await expect(dialog.locator("input[name=firstDueDate]")).toHaveValue("2026-09-22");
  await dialog.getByRole("combobox", { name: "Parcelas" }).click();
  await page.getByRole("menuitem", { name: "3x", exact: true }).click();
  await expect(dialog.getByTestId("installments-summary")).toHaveText(
    "3x de R$ 33,34 (a primeira) e R$ 33,33: 22/09, 22/10 e 22/11.",
  );
  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("3 parcelas lançadas.")).toBeVisible();
  await expect(dialog).toBeHidden();

  const row = rowOf(page, "Aluno Extra");
  await expect(row).toContainText("Taxa de matrícula");
  await expect(row).toContainText("parcela 1 de 3");
  await expect(row).toContainText("R$ 33,34");
  await expect(row).toContainText("vence 22/09");
  await expect(row).toContainText("Pendente");

  // Filtro "Cobranças avulsas" vai para a URL.
  await page.getByRole("combobox", { name: "Filtrar por tipo" }).click();
  await page.getByRole("option", { name: "Cobranças avulsas" }).click();
  await expect(page).toHaveURL(/kind=extra/);
  await expect(page.getByText("1 cobrança")).toBeVisible();

  // As outras parcelas, uma por mês.
  await page.getByRole("button", { name: "Próximo mês" }).click();
  await expect(rowOf(page, "Aluno Extra")).toContainText("parcela 2 de 3");
  await expect(rowOf(page, "Aluno Extra")).toContainText("R$ 33,33");
  await expect(page).toHaveURL(/kind=extra/);
  await page.getByRole("button", { name: "Próximo mês" }).click();
  await expect(rowOf(page, "Aluno Extra")).toContainText("parcela 3 de 3");
  await expect(rowOf(page, "Aluno Extra")).toContainText("vence 22/11");

  // Só mensalidades: a avulsa some.
  await page.getByRole("combobox", { name: "Filtrar por tipo" }).click();
  await page.getByRole("option", { name: "Mensalidades" }).click();
  await expect(rowOf(page, "Aluno Extra")).toHaveCount(0);
});

test("Mensalidades: marcar a avulsa como paga com Pix e cancelar outra com motivo", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [noPlan("c-k1", "Aluno K1"), noPlan("c-k2", "Aluno K2")];
      t.charges = [
        extraCharge("x-1", "c-k1", { installmentGroupId: "g-1", cycleIndex: 1, cycleTotal: 2, amountCents: 12500 }),
        extraCharge("x-2", "c-k2", { description: "Evento" }),
      ];
    },
  });
  await page.goto("/classes/billing?kind=extra");
  await expect(rowOf(page, "Aluno K1")).toContainText("Kimono");
  await expect(rowOf(page, "Aluno K1")).toContainText("parcela 1 de 2");

  // Avulsa não tem lembrete de WhatsApp (os modelos falam de mensalidade).
  await page.getByRole("button", { name: "Ações de Aluno K1", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Marcar pago" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Cobrar online/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Lembrar no WhatsApp" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Marcar pago" }).click();

  const pay = page.getByRole("dialog", { name: "Registrar pagamento" });
  await expect(pay).toContainText("Cobrança avulsa");
  await expect(pay).toContainText("Kimono (parcela 1 de 2)");
  await pay.getByRole("radio", { name: "Pix" }).click();
  await pay.getByRole("button", { name: "Registrar pagamento" }).click();
  await expect(page.getByText("Pagamento registrado (Pix).")).toBeVisible();
  await expect(rowOf(page, "Aluno K1")).toContainText("pago via Pix");

  await rowAction(page, "Aluno K2", "Cancelar cobrança");
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("(Evento)");
  await confirm.getByRole("button", { name: "+ Lançada por engano" }).click();
  await expect(confirm.getByLabel("Motivo (opcional)")).toHaveValue("Lançada por engano");
  await confirm.getByRole("button", { name: "Cancelar cobrança" }).click();
  await expect(page.getByText("Cobrança cancelada com sucesso.")).toBeVisible();
  const canceled = rowOf(page, "Aluno K2");
  await expect(canceled).toContainText("Cancelado");
  await expect(canceled).toContainText("Lançada por engano");
  await expect(canceled.getByRole("button", { name: "Reverter" })).toBeVisible();
});

test("Alunos: nova cobrança pelo menu do aluno, com o aluno fixo", async ({ page }) => {
  await seedAcademy(page, { extra: (t) => (t.clients = [noPlan("c-f", "Aluno Ficha")]) });
  await page.goto("/clients");
  await page.evaluate(() => localStorage.setItem("gestarahub_coachmark_view_mode_clients", "1"));

  await page.getByRole("button", { name: "Ações de Aluno Ficha", exact: true }).last().click();
  await page.getByRole("menuitem", { name: "Nova cobrança" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova cobrança" });
  await expect(dialog).toContainText("Cobrança avulsa para Aluno Ficha, à vista ou parcelada.");
  await expect(dialog.getByRole("combobox", { name: "Aluno" })).toHaveCount(0);

  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(dialog.getByText("Descreva a cobrança.")).toBeVisible();
  await expect(dialog.getByText("Informe o valor.")).toBeVisible();

  await dialog.getByRole("button", { name: "+ Exame de faixa" }).click();
  await dialog.getByLabel("Valor").fill("8000");
  // À vista: sem a conta das parcelas.
  await expect(dialog.getByTestId("installments-summary")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("Cobrança lançada.")).toBeVisible();

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("gestarahub:db")?.includes("Exame de faixa") ?? false))
    .toBe(true);
  await page.goto("/classes/billing?kind=extra");
  const row = rowOf(page, "Aluno Ficha");
  await expect(row).toContainText("Exame de faixa");
  await expect(row).toContainText("R$ 80,00");
  await expect(row).not.toContainText("parcela");
});
