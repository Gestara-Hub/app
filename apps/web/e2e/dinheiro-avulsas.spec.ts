import { expect, seedAcademy, skipWelcome, student, test } from "./fixtures";
import {
  charge,
  contextMenuItems,
  menuAction,
  noPlan,
  openMenuItems,
  pickField,
  pickSelect,
  rowOf,
  stepMonth,
  waitForTenant,
} from "./dinheiro-fixtures";

/**
 * Cobranca avulsa (doc 15, "Cobrança avulsa"; doc 20, fase A): lancar pela
 * tela Cobranças, pelo menu do aluno e pela ficha; parcelas; acoes de
 * dinheiro; aluno inativo. Relogio fixo em 22/09/2026.
 */

test.describe.configure({ timeout: 60_000 });

test("Nova cobrança em 12x: erros de campo, parcela de R$ 0 recusada, conta longa e o mês da 1ª parcela", async ({
  page,
}) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [noPlan("c-a", "Aluna Ativa"), noPlan("c-i", "Aluno Inativo", { status: "inactive" })];
    },
  });
  await page.goto("/classes/billing");
  await page.getByRole("button", { name: "Nova cobrança" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova cobrança" });
  await expect(dialog).toContainText("Taxa, material, uniforme ou evento, à vista ou parcelado.");

  // Aluno inativo nao aparece para cobrar.
  await dialog.getByRole("combobox", { name: "Aluno" }).click();
  await expect(page.getByRole("option", { name: "Aluna Ativa" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Aluno Inativo" })).toHaveCount(0);
  await page.getByRole("option", { name: "Aluna Ativa" }).click();

  // Lutas: a sugestao fala em faixa.
  await expect(dialog.getByRole("button", { name: "+ Exame de faixa" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "+ Exame de graduação" })).toHaveCount(0);

  // Descricao longa demais.
  await dialog.getByLabel("Descrição").fill("x".repeat(81));
  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(dialog.getByText("Use no máximo 80 caracteres.")).toBeVisible();
  await expect(dialog.getByText("Informe o valor.")).toBeVisible();

  // R$ 0,02 em 3x: parcela de R$ 0 nao e cobranca (o servico recusa no campo Parcelas).
  await dialog.getByRole("button", { name: "+ Uniforme" }).click();
  await expect(dialog.getByLabel("Descrição")).toHaveValue("Uniforme");
  await dialog.getByLabel("Valor").fill("2");
  await expect(dialog.getByLabel("Valor")).toHaveValue("0,02");
  await pickField(page, dialog, "Parcelas", "3x");
  await expect(dialog.getByTestId("installments-summary")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(dialog.getByText("Cada parcela precisa de pelo menos R$ 0,01.")).toBeVisible();

  // R$ 1.200 em 12x a partir de 31/10: dia 31 cai no ultimo dia dos meses curtos.
  await dialog.getByLabel("Valor").fill("120000");
  await pickField(page, dialog, "Parcelas", "12x");
  await dialog.locator("input[name=firstDueDate]").fill("2026-10-31");
  await expect(dialog.getByTestId("installments-summary")).toHaveText("12x de R$ 100,00: de 31/10/2026 a 30/09/2027.");
  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("12 parcelas lançadas.")).toBeVisible();
  await expect(dialog).toBeHidden();

  // A tela abre o mes da primeira parcela.
  await expect(page).toHaveURL(/month=2026-10/);
  const row = rowOf(page, "Aluna Ativa");
  await expect(row).toContainText("Uniforme");
  await expect(row).toContainText("parcela 1 de 12");
  await expect(row).toContainText("vence 31/10");
  await expect(row).toContainText("R$ 100,00");
  await stepMonth(page, "next", "2026-11");
  await expect(rowOf(page, "Aluna Ativa")).toContainText("parcela 2 de 12");
  await expect(rowOf(page, "Aluna Ativa")).toContainText("vence 30/11");
  for (const month of ["2026-12", "2027-01", "2027-02"]) await stepMonth(page, "next", month);
  await expect(page).toHaveURL(/month=2027-02/);
  await expect(rowOf(page, "Aluna Ativa")).toContainText("parcela 5 de 12");
  await expect(rowOf(page, "Aluna Ativa")).toContainText("vence 28/02");
  await stepMonth(page, "next", "2027-03");
  await expect(rowOf(page, "Aluna Ativa")).toContainText("vence 31/03");
});

test("gastronomia: sugestão \"Exame de graduação\" e nova cobrança pela ficha do aluno", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.organization.classSegment = "gastronomy";
      t.clients = [noPlan("c-f", "Aluna Ficha")];
    },
  });
  await page.goto("/clients/c-f");
  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: "Nova cobrança" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova cobrança" });
  await expect(dialog).toContainText("Cobrança avulsa para Aluna Ficha, à vista ou parcelada.");
  await expect(dialog.getByRole("combobox", { name: "Aluno" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "+ Exame de faixa" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "+ Material" }).click();
  await dialog.getByLabel("Valor").fill("4500");
  await dialog.locator("input[name=firstDueDate]").fill("2026-09-30");
  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("Cobrança lançada.")).toBeVisible();
  await expect(dialog).toBeHidden();

  // Extrato da ficha mostra a avulsa.
  await page.getByRole("tab", { name: "Cobranças" }).click();
  const statement = page.getByRole("tabpanel");
  await expect(statement).toContainText("Material");
  await expect(statement).toContainText("vence 30/09");
  await expect(statement).toContainText("R$ 45,00");
  await waitForTenant(page, (t) => t.charges.some((c: { description?: string }) => c.description === "Material"));

  // Em Cobranças, a busca acha pela descricao.
  await page.goto("/classes/billing");
  await page.getByRole("textbox", { name: "Buscar aluno" }).fill("materi");
  await expect(rowOf(page, "Aluna Ficha")).toContainText("Material");
  await expect(page.getByText("1 cobrança", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Buscar aluno" }).fill("kimono");
  await expect(page.getByText("Nenhuma cobrança de “kimono” com estes filtros no mês.")).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).first().click();
  await expect(rowOf(page, "Aluna Ficha")).toBeVisible();
});

test("avulsa: pagar, desfazer, cancelar com motivo e reabrir; clique direito espelha cada estado", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [noPlan("c-1", "Aluno Pago"), noPlan("c-2", "Aluno Aberto"), noPlan("c-3", "Aluno Atrasado")];
      t.charges = [
        charge("x-1", "c-1", { description: "Evento", amountCents: 12000 }),
        charge("x-2", "c-2", { description: "Uniforme", amountCents: 9000 }),
        charge("x-3", "c-3", { description: "Taxa de matrícula", dueDate: "2026-09-05", amountCents: 5000 }),
      ];
    },
  });
  await page.goto("/classes/billing?kind=extra");
  await expect(rowOf(page, "Aluno Atrasado")).toContainText("Atrasado");
  await expect(rowOf(page, "Aluno Aberto")).toContainText("Pendente");

  // Cartoes do mes: R$ 260 ativos, R$ 50 em atraso.
  const card = (title: string) => page.locator("div.rounded-xl.shadow-2xs").filter({ has: page.getByText(title, { exact: true }) });
  await expect(card("Total ativo")).toContainText("R$ 260,00");
  await expect(card("Total ativo")).toContainText("3 ativas");
  await expect(card("Em atraso")).toContainText("R$ 50,00");
  await expect(card("Em atraso")).toContainText("1 em atraso");

  // Em aberto: menu ⋮ e clique direito com as mesmas acoes (gratis: online travado).
  const openActions = ["Marcar pago", "Lembrar no WhatsApp", "Cobrar online (Plano Pro)", "Cancelar cobrança"];
  expect(await openMenuItems(page, "Aluno Aberto")).toEqual(openActions);
  expect(await contextMenuItems(page, rowOf(page, "Aluno Aberto"))).toEqual(openActions);
  await page.getByRole("button", { name: "Ações de Aluno Aberto", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Cobrar online (Plano Pro)" })).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");

  // Pagar em dinheiro.
  await menuAction(page, "Aluno Pago", "Marcar pago");
  const pay = page.getByRole("dialog", { name: "Registrar pagamento" });
  await expect(pay).toContainText("Cobrança avulsa");
  await expect(pay).toContainText("Evento");
  await pay.getByRole("radio", { name: "Dinheiro" }).click();
  await pay.getByRole("button", { name: "Registrar pagamento" }).click();
  await expect(page.getByText("Pagamento registrado (Dinheiro).")).toBeVisible();
  const paid = rowOf(page, "Aluno Pago");
  await expect(paid).toContainText("Pago");
  await expect(paid).toContainText("pago via Dinheiro");
  await expect(card("Recebido")).toContainText("R$ 120,00");
  expect(await contextMenuItems(page, paid)).toEqual(["Desfazer pagamento"]);

  // Desfazer pelo botao da linha.
  await paid.getByRole("button", { name: "Desfazer pagamento" }).click();
  const undo = page.getByRole("alertdialog", { name: "Desfazer pagamento?" });
  await expect(undo).toContainText("A cobrança de Aluno Pago (R$ 120,00) volta a ficar em aberto e o registro via Dinheiro é apagado.");
  await undo.getByRole("button", { name: "Desfazer pagamento" }).click();
  await expect(page.getByText("Pagamento desfeito.")).toBeVisible();
  await expect(paid).toContainText("Pendente");
  await expect(card("Recebido")).toContainText("R$ 0,00");

  // Cancelar a atrasada com motivo digitado, pelo clique direito.
  await rowOf(page, "Aluno Atrasado").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Cancelar cobrança" }).click();
  const cancel = page.getByRole("alertdialog");
  await expect(cancel).toContainText("(Taxa de matrícula)");
  await expect(cancel.getByRole("button", { name: "+ Plano errado" })).toHaveCount(0);
  await cancel.getByLabel("Motivo (opcional)").fill("Aluno ganhou desconto");
  await cancel.getByRole("button", { name: "Cancelar cobrança" }).click();
  await expect(page.getByText("Cobrança cancelada com sucesso.")).toBeVisible();
  const canceled = rowOf(page, "Aluno Atrasado");
  await expect(canceled).toContainText("Cancelado");
  await expect(canceled).toContainText("Aluno ganhou desconto");
  await expect(card("Cancelado")).toContainText("R$ 50,00");
  await expect(card("Em atraso")).toContainText("R$ 0,00");
  expect(await contextMenuItems(page, canceled)).toEqual(["Reverter cancelamento"]);

  // Reabrir: volta atrasada (o vencimento ja passou).
  await canceled.getByRole("button", { name: "Reverter" }).click();
  const reopen = page.getByRole("alertdialog", { name: "Reabrir cobrança?" });
  await expect(reopen).toContainText("A cobrança de Aluno Atrasado (R$ 50,00) volta a compor o total a receber.");
  await reopen.getByRole("button", { name: "Reabrir cobrança" }).click();
  await expect(page.getByText("Cobrança reaberta.")).toBeVisible();
  await expect(canceled).toContainText("Atrasado");
  await expect(canceled).not.toContainText("Aluno ganhou desconto");

  // Filtro de situacao com contagem; "Canceladas" vazio mostra o aviso e limpa.
  await pickSelect(page, "Filtrar por situação", /Atrasadas/);
  await expect(page).toHaveURL(/status=overdue/);
  await expect(page.getByText("1 cobrança", { exact: true })).toBeVisible();
  await pickSelect(page, "Filtrar por situação", /Canceladas/);
  await expect(page.getByText("Nenhuma cobrança com esta situação no mês.")).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).first().click();
  await expect(page).not.toHaveURL(/status=|kind=/);
  await expect(page.getByText("3 cobranças", { exact: true })).toBeVisible();
});

test("inativar mantém as avulsas em aberto (até as futuras) mesmo cancelando a mensalidade; inativo não recebe cobrança", async ({
  page,
}) => {
  await seedAcademy(page, {
    extra: (t) => {
      // Aluno com plano desde 20/09 (mensalidade proporcional de R$ 55, venceu 20/09).
      t.clients = [student("c-1", "Aluno Saindo"), noPlan("c-2", "Aluna Fica"), noPlan("c-3", "Aluna Três")];
      t.charges = [
        charge("x-1", "c-1", { installmentGroupId: "g-1", cycleIndex: 1, cycleTotal: 3, amountCents: 10000 }),
        charge("x-2", "c-1", { installmentGroupId: "g-1", cycleIndex: 2, cycleTotal: 3, amountCents: 10000, competence: "2026-10", dueDate: "2026-10-25" }),
        charge("x-3", "c-1", { installmentGroupId: "g-1", cycleIndex: 3, cycleTotal: 3, amountCents: 10000, competence: "2026-11", dueDate: "2026-11-25" }),
      ];
    },
  });
  await skipWelcome(page);
  await page.evaluate(() => localStorage.setItem("gestarahub_coachmark_view_mode_clients", "1"));
  await page.goto("/classes/billing");
  await expect(rowOf(page, "Aluno Saindo").filter({ hasText: "Mensal Jiu-Jitsu" })).toContainText("Atrasado");
  await waitForTenant(page, (t) => t.charges.some((c: { kind: string }) => c.kind === "membership"));

  await page.goto("/clients");
  await page.getByRole("button", { name: "Ações de Aluno Saindo", exact: true }).last().click();
  await page.getByRole("menuitem", { name: "Inativar" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Inativar aluno?" });
  await expect(dialog).toContainText("As 3 cobranças avulsas em aberto continuam para receber.");
  await expect(dialog).toContainText("1 mensalidade em aberto · R$ 55,00.");
  await dialog.getByRole("radio", { name: /Cancelar a cobrança/ }).click();
  await dialog.getByRole("button", { name: "Inativar" }).click();
  await expect(page.getByText("Aluno inativado.")).toBeVisible();
  await waitForTenant(page, (t) => t.clients.find((c: { id: string }) => c.id === "c-1")?.status === "inactive");

  // As tres parcelas seguem em aberto; a mensalidade foi cancelada com o motivo.
  await page.goto("/classes/billing?kind=extra");
  await expect(rowOf(page, "Aluno Saindo")).toContainText("parcela 1 de 3");
  await expect(rowOf(page, "Aluno Saindo")).toContainText("Pendente");
  await stepMonth(page, "next", "2026-10");
  await expect(rowOf(page, "Aluno Saindo")).toContainText("parcela 2 de 3");
  await expect(rowOf(page, "Aluno Saindo")).toContainText("Pendente");
  await stepMonth(page, "next", "2026-11");
  await expect(rowOf(page, "Aluno Saindo")).toContainText("parcela 3 de 3");
  await expect(rowOf(page, "Aluno Saindo")).toContainText("Pendente");
  await pickSelect(page, "Filtrar por tipo", "Mensalidades");
  // Espera o filtro chegar na URL antes de trocar o mes (senao a troca o apaga).
  await expect(page).toHaveURL(/kind=membership/);
  await stepMonth(page, "prev", "2026-10");
  await expect(page).toHaveURL(/kind=membership/);
  await stepMonth(page, "prev", "2026-09");
  await expect(rowOf(page, "Aluno Saindo")).toContainText("Cancelado");
  await expect(rowOf(page, "Aluno Saindo")).toContainText("Aluno inativado");

  // Inativo: sem "Nova cobrança" nem "Vender pacote" na ficha, na lista e no dialogo.
  await page.goto("/clients/c-1");
  await page.getByRole("button", { name: "Mais ações" }).click();
  await expect(page.getByRole("menuitem", { name: "Reativar" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Nova cobrança" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Vender pacote" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.goto("/clients");
  await pickSelect(page, "Filtrar por status", "Inativos");
  const items = await openMenuItemsLast(page, "Aluno Saindo");
  expect(items).not.toContain("Nova cobrança");
  expect(items).not.toContain("Vender pacote");
  expect(items).toContain("Reativar");

  await page.goto("/classes/billing");
  await page.getByRole("button", { name: "Nova cobrança" }).click();
  const create = page.getByRole("dialog", { name: "Nova cobrança" });
  await create.getByRole("combobox", { name: "Aluno" }).click();
  await expect(page.getByRole("option", { name: "Aluna Fica" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Aluno Saindo" })).toHaveCount(0);
  await page.getByRole("option", { name: "Aluna Três" }).click();
  await expect(create.getByRole("combobox", { name: "Aluno" })).toContainText("Aluna Três");
});

/** Menu ⋮ do aluno na lista (a linha tambem e um botao com o mesmo nome: usa o ultimo). */
async function openMenuItemsLast(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: `Ações de ${name}`, exact: true }).last().click();
  const items = page.getByRole("menuitem");
  await expect(items.first()).toBeVisible();
  const texts = (await items.allInnerTexts()).map((t) => t.trim());
  await page.keyboard.press("Escape");
  return texts;
}
