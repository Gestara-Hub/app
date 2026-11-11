import type { Page } from "@playwright/test";
import { expect, seedAcademy, student, test } from "./fixtures";

// Fluxos longos (login + varias telas): com o `pnpm dev` ocupado, 30 s nao bastam.
test.describe.configure({ timeout: 60_000 });

const ORG = "org-academia-x";
const TS = "2026-09-01T12:00:00.000Z";
const category = (key: string) => `fcat-${ORG}-${key}`;

/** Lancamento manual ja gravado no mundo do mock (padrao: saida pendente de material). */
function entry(id: string, description: string, over: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: ORG,
    unitId: "unit-academia-x",
    type: "expense",
    categoryId: category("equipment"),
    description,
    amountCents: 32000,
    dueDate: "2026-09-25",
    status: "pending",
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

/** Conta fixa que se repete todo dia 15 desde setembro (gera setembro e outubro na leitura). */
function monthlyRent(amountCents = 150000) {
  return {
    id: "rec-aluguel",
    organizationId: ORG,
    type: "expense",
    categoryId: category("rent"),
    description: "Aluguel da sala",
    amountCents,
    dayOfMonth: 15,
    startCompetence: "2026-09",
    status: "active",
    createdAt: TS,
    updatedAt: TS,
  };
}

/** A linha do lancamento na aba Lancamentos (ListRow com aria-label = descricao). */
const entryRow = (page: Page, description: string) => page.locator(`div.group[aria-label="${description}"]`);

async function openEntryMenu(page: Page, description: string) {
  await page.getByRole("button", { name: `Ações de ${description}`, exact: true }).click();
}

async function entryAction(page: Page, description: string, action: string) {
  await openEntryMenu(page, description);
  await page.getByRole("menuitem", { name: action, exact: true }).click();
}

test.describe("lançamentos", () => {
  test("despesa que se repete aparece neste mês, no próximo e no Resumo", { tag: "@smoke" }, async ({ page }) => {
    await seedAcademy(page);
    await page.goto("/finance?tab=lancamentos");
    await expect(page.getByText("Nenhum lançamento em setembro de 2026")).toBeVisible();

    await page.getByRole("button", { name: "Novo lançamento" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Novo lançamento" });
    await expect(dialog.getByRole("radio", { name: /Saída/ })).toHaveAttribute("aria-checked", "true");
    await dialog.getByRole("combobox").filter({ hasText: "Selecione a categoria" }).click();
    await page.getByRole("menuitem", { name: "Aluguel" }).click();
    await dialog.getByLabel("Descrição").fill("Aluguel da sala");
    await dialog.getByLabel("Valor").fill("150000");
    await expect(dialog.getByLabel("Valor")).toHaveValue("1.500,00");
    await dialog.locator("input[name=dueDate]").fill("2026-09-15");
    await dialog.getByRole("switch", { name: "Repetir todo mês" }).click();
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Lançamento criado. Ele vai se repetir todo mês.")).toBeVisible();

    // Setembro: venceu dia 15 e ainda nao foi pago.
    const row = entryRow(page, "Aluguel da sala");
    await expect(row).toContainText("Atrasado");
    await expect(row).toContainText("vence 15/09");
    await expect(row).toContainText("mensal");
    await expect(row).toContainText("R$ 1.500,00");

    // Outubro ja nasce com o lancamento do mes seguinte.
    await page.getByRole("button", { name: "Próximo mês" }).click();
    await expect(page).toHaveURL(/month=2026-10/);
    await expect(row).toContainText("Pendente");
    await expect(row).toContainText("vence 15/10");

    // Resumo de outubro: a conta entra no que falta pagar.
    await page.getByRole("tab", { name: "Resumo" }).click();
    await expect(page).toHaveURL(/tab=resumo/);
    await expect(page).toHaveURL(/month=2026-10/);
    await expect(page.getByText("+ R$ 1.500,00 a pagar até o fim do mês")).toBeVisible();
  });

  test("marcar pago exige a forma e desfazer pede confirmação; depois não exclui mais", { tag: "@smoke" }, async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => (t.financialEntries = [entry("fe-kimonos", "Kimonos para revenda")]),
    });
    await page.goto("/finance?tab=lancamentos");
    const row = entryRow(page, "Kimonos para revenda");
    await expect(row).toContainText("Pendente");

    // Nunca pago: pode excluir.
    await openEntryMenu(page, "Kimonos para revenda");
    await expect(page.getByRole("menuitem", { name: "Excluir" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Marcar pago" }).click();

    const pay = page.getByRole("dialog", { name: "Registrar pagamento" });
    await expect(pay).toContainText("R$ 320,00");
    await expect(pay.getByRole("button", { name: "Marcar como pago" })).toBeDisabled();
    await pay.getByRole("radio", { name: "Pix" }).click();
    await pay.getByRole("button", { name: "Marcar como pago" }).click();
    await expect(page.getByText("Pagamento registrado (Pix).")).toBeVisible();
    await expect(row).toContainText("Pago");
    await expect(row).toContainText("pago via Pix");

    // Pago: nao exclui.
    await openEntryMenu(page, "Kimonos para revenda");
    await expect(page.getByRole("menuitem", { name: "Excluir" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Desfazer pagamento" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Desfazer pagamento?" });
    await expect(confirm).toContainText("o registro via Pix é apagado");
    await confirm.getByRole("button", { name: "Desfazer pagamento" }).click();
    await expect(page.getByText("Pagamento desfeito.")).toBeVisible();
    await expect(row).toContainText("Pendente");
    await expect(row).not.toContainText("pago via Pix");

    // Ja foi pago uma vez: continua sem Excluir (so Cancelar).
    await openEntryMenu(page, "Kimonos para revenda");
    await expect(page.getByRole("menuitem", { name: "Cancelar" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Excluir" })).toHaveCount(0);
  });

  test("excluir apaga de vez só o lançamento que nunca foi pago", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) =>
        (t.financialEntries = [
          entry("fe-luz", "Conta de luz", { categoryId: category("utilities"), amountCents: 21000 }),
          entry("fe-cartaz", "Cartazes", { categoryId: category("marketing"), amountCents: 9000 }),
        ]),
    });
    await page.goto("/finance?tab=lancamentos");
    await expect(page.getByText("2 lançamentos", { exact: true })).toBeVisible();

    await entryAction(page, "Conta de luz", "Excluir");
    const confirm = page.getByRole("alertdialog", { name: "Excluir lançamento?" });
    await expect(confirm).toContainText("Esta ação não pode ser desfeita.");
    await confirm.getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByText("Lançamento excluído.")).toBeVisible();
    await expect(entryRow(page, "Conta de luz")).toHaveCount(0);
    await expect(entryRow(page, "Cartazes")).toBeVisible();
    await expect(page.getByText("1 lançamento", { exact: true })).toBeVisible();
  });

  test("conta que se repete: \"Este e os próximos\" muda este mês e os seguintes, sem Excluir", async ({ page }) => {
    await seedAcademy(page, { extra: (t) => (t.financialRecurrences = [monthlyRent()]) });
    await page.goto("/finance?tab=lancamentos");
    const row = entryRow(page, "Aluguel da sala");
    await expect(row).toContainText("R$ 1.500,00");

    // Repeticao nao se exclui: encerra.
    await openEntryMenu(page, "Aluguel da sala");
    await expect(page.getByRole("menuitem", { name: "Encerrar repetição" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Excluir" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Editar" }).click();

    const dialog = page.getByRole("dialog", { name: "Editar lançamento" });
    await dialog.getByLabel("Valor").fill("160000");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    const scope = page.getByRole("alertdialog", { name: "Alterar lançamento que se repete" });
    await scope.getByRole("button", { name: "Este e os próximos" }).click();
    await expect(page.getByText("Lançamento e próximos atualizados.")).toBeVisible();
    await expect(row).toContainText("R$ 1.600,00");

    await page.getByRole("button", { name: "Próximo mês" }).click();
    await expect(row).toContainText("vence 15/10");
    await expect(row).toContainText("R$ 1.600,00");
  });

  test("\"Só este\" muda apenas o mês editado", async ({ page }) => {
    await seedAcademy(page, { extra: (t) => (t.financialRecurrences = [monthlyRent()]) });
    await page.goto("/finance?tab=lancamentos");
    const row = entryRow(page, "Aluguel da sala");

    await entryAction(page, "Aluguel da sala", "Editar");
    const dialog = page.getByRole("dialog", { name: "Editar lançamento" });
    await dialog.getByLabel("Valor").fill("175000");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Só este" }).click();
    await expect(page.getByText("Lançamento atualizado.")).toBeVisible();
    await expect(row).toContainText("R$ 1.750,00");

    await page.getByRole("button", { name: "Próximo mês" }).click();
    await expect(row).toContainText("vence 15/10");
    await expect(row).toContainText("R$ 1.500,00");
  });
});

test("seletor de mês: \"Hoje\" só fora do mês atual e o mês vai para a URL", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/finance?tab=lancamentos");
  const picker = page.getByRole("button", { name: "Escolher mês (Setembro de 2026)" });
  await expect(picker).toContainText("Atual");
  await expect(page.getByRole("button", { name: "Hoje" })).toHaveCount(0);

  await page.getByRole("button", { name: "Próximo mês" }).click();
  await expect(page).toHaveURL(/month=2026-10/);
  await expect(page.getByRole("button", { name: "Escolher mês (Outubro de 2026)" })).not.toContainText("Atual");

  await page.getByRole("button", { name: "Hoje" }).click();
  await expect(page).toHaveURL(/month=2026-09/);
  await expect(picker).toBeVisible();
  await expect(page.getByRole("button", { name: "Hoje" })).toHaveCount(0);

  // Grade de meses: escolhe dezembro e a aba nova mantem o mes.
  await picker.click();
  await page.getByRole("button", { name: "Dezembro de 2026" }).click();
  await expect(page).toHaveURL(/month=2026-12/);
  await page.getByRole("tab", { name: "Instrutores" }).click();
  await expect(page).toHaveURL(/tab=professores/);
  await expect(page).toHaveURL(/month=2026-12/);
  await expect(page.getByRole("button", { name: "Escolher mês (Dezembro de 2026)" })).toBeVisible();
});

test("professor: regra, ajuste, fechar o mês, pagar via Pix e desfazer", { tag: "@smoke" }, async ({ page }) => {
  await seedAcademy(page);
  // Agosto ja terminou: pode fechar sem o aviso de mes em andamento.
  await page.goto("/finance?tab=professores&month=2026-08");

  await page.getByRole("button", { name: "Configurar pagamento" }).click();
  const rule = page.getByRole("dialog", { name: "Configurar pagamento" });
  await expect(rule).toContainText("Como Carlos Silva recebe por mês.");
  await rule.getByLabel("Valor mensal").fill("200000");
  await expect(rule.getByRole("combobox", { name: "Vale a partir de" })).toHaveText("Agosto de 2026");
  await rule.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByText("Pagamento configurado.")).toBeVisible();

  const payoutRow = page.getByRole("button", { name: "Ver pagamento de Carlos Silva" });
  await expect(payoutRow).toContainText("Prévia");
  await expect(payoutRow).toContainText("R$ 2.000,00");
  await payoutRow.click();

  const detail = page.getByRole("dialog").filter({ hasText: "Carlos Silva" });
  await expect(detail).toContainText("Prévia do mês");
  await detail.getByRole("button", { name: "Adicionar ajuste" }).click();
  await detail.getByLabel("Descrição").fill("Bônus do evento");
  await detail.locator("#adjustment-amount").fill("15000");
  await detail.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByText("Ajuste salvo.")).toBeVisible();
  await expect(detail).toContainText("Bônus do evento");
  await expect(detail).toContainText("R$ 2.150,00");

  await detail.getByRole("button", { name: "Fechar mês" }).click();
  const closeConfirm = page.getByRole("alertdialog", { name: "Fechar Agosto de 2026?" });
  await expect(closeConfirm).toContainText("fica congelado em R$ 2.150,00, com 1 ajuste");
  await closeConfirm.getByRole("button", { name: "Fechar mês" }).click();
  await expect(page.getByText("Mês fechado.")).toBeVisible();
  await expect(detail).toContainText("Valor a pagar");
  await expect(detail.getByRole("button", { name: "Adicionar ajuste" })).toHaveCount(0);

  await detail.getByRole("button", { name: "Pagar" }).click();
  const pay = page.getByRole("dialog", { name: "Registrar pagamento" });
  await expect(pay).toContainText("Agosto de 2026");
  await expect(pay.getByRole("button", { name: "Registrar pagamento" })).toBeDisabled();
  await pay.getByRole("radio", { name: "Pix" }).click();
  await pay.getByRole("button", { name: "Registrar pagamento" }).click();
  await expect(page.getByText("Pagamento registrado (Pix).")).toBeVisible();
  await expect(detail).toContainText("Valor pago");
  await expect(detail).toContainText("via Pix");
  await expect(detail.getByRole("button", { name: "Pagar" })).toHaveCount(0);

  await detail.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: "Desfazer pagamento" }).click();
  const undo = page.getByRole("alertdialog", { name: "Desfazer pagamento?" });
  await expect(undo).toContainText("volta para fechado");
  await undo.getByRole("button", { name: "Desfazer pagamento" }).click();
  await expect(page.getByText("Pagamento desfeito.")).toBeVisible();
  await expect(detail).toContainText("Valor a pagar");
  await expect(detail.getByRole("button", { name: "Pagar" })).toBeVisible();

  // Fechar pelo X nao pergunta nada (o ajuste ja foi salvo).
  await detail.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(detail).toBeHidden();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(payoutRow).toContainText("Fechado");
  await expect(payoutRow).toContainText("R$ 2.150,00");
});

test("Resumo: o que entrou, o que saiu e as bolsas concedidas na visão avançada", async ({ page }) => {
  const paidAt = "2026-09-10T15:00:00.000Z";
  await seedAcademy(page, {
    extra: (t) => {
      t.financialEntries = [
        entry("fe-venda", "Venda de kimonos", { type: "income", categoryId: category("products"), amountCents: 50000, dueDate: "2026-09-10", status: "paid", paidAt, method: "pix" }),
        entry("fe-luz", "Conta de luz", { categoryId: category("utilities"), amountCents: 21000, dueDate: "2026-09-10", status: "paid", paidAt, method: "cash" }),
      ];
      // Bolsista integral: mensalidade isenta de R$ 150 (nao entra no caixa).
      t.clients = [
        student("c-bolsa", "Aluna Bolsista", {
          planStartDate: "2026-09-01",
          discount: { type: "percentage", value: 100, scholarship: true },
        }),
      ];
    },
  });
  await page.goto("/finance");
  const card = (title: string) =>
    page.locator("div.rounded-2xl").filter({ has: page.getByText(title, { exact: true }) });
  await expect(card("Saldo do mês")).toContainText("R$ 290,00");
  await expect(card("Entrou")).toContainText("R$ 500,00");
  await expect(card("Entrou")).toContainText("Todas as mensalidades recebidas");
  await expect(card("Saiu")).toContainText("R$ 210,00");

  // Tela unica desde 11/11/2026: bolsas no pe das entradas por categoria.
  await expect(page.getByText("Bolsas concedidas", { exact: true }).locator("..")).toContainText("R$ 150,00");
});
