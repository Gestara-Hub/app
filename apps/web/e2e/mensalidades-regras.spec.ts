import type { Page } from "@playwright/test";
import { expect, seedAcademy, student, test } from "./fixtures";

// Fluxos longos (login + varias telas): com o `pnpm dev` ocupado, 30 s nao bastam.
test.describe.configure({ timeout: 60_000 });

const TS = "2026-09-01T12:00:00.000Z";

/** A linha inteira (texto + valor + acoes) de um aluno na lista de Cobranças. */
const rowOf = (page: Page, name: string) => page.locator("div.group").filter({ hasText: name });

/** Abre o menu ⋮ da mensalidade e escolhe a acao. */
async function rowAction(page: Page, name: string, action: string) {
  await page.getByRole("button", { name: `Ações de ${name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: action }).click();
}

/** Escolhe uma opcao de um Select de filtro (as opcoes trazem a contagem ao lado). */
async function pickFilter(page: Page, filter: string, option: string) {
  await page.getByRole("combobox", { name: filter }).click();
  await page.getByRole("option", { name: new RegExp(`^${option}( \\d+)?$`) }).click();
}

/** Abre "Novo aluno" com nome e telefone preenchidos. */
async function newStudentDialog(page: Page, name: string) {
  await page.goto("/clients");
  await page.getByRole("button", { name: "Novo aluno" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome do aluno").fill(name);
  await dialog.getByLabel("Telefone (WhatsApp)").fill("11977776610");
  return dialog;
}

test("cancelar com motivo sugerido mostra o motivo na linha; reabrir limpa", async ({ page }) => {
  await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno A20")]) });
  await page.goto("/classes/billing?status=all");
  const row = rowOf(page, "Aluno A20");
  await expect(row).toContainText("Atrasado");

  await rowAction(page, "Aluno A20", "Cancelar cobrança");
  const confirm = page.getByRole("alertdialog", { name: "Cancelar a cobrança?" });
  await confirm.getByRole("button", { name: "+ Plano errado" }).click();
  await expect(confirm.getByLabel("Motivo (opcional)")).toHaveValue("Plano errado");
  await confirm.getByRole("button", { name: "Cancelar cobrança" }).click();
  await expect(page.getByText("Cobrança cancelada com sucesso.")).toBeVisible();
  await expect(row).toContainText("Cancelado");
  await expect(row).toContainText("Plano errado");
  await expect(page.getByText("1 cancelada", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Reverter" }).click();
  await page.getByRole("alertdialog", { name: "Reabrir cobrança?" }).getByRole("button", { name: "Reabrir cobrança" }).click();
  await expect(page.getByText("Cobrança reaberta.")).toBeVisible();
  await expect(row).toContainText("Atrasado");
  await expect(row).not.toContainText("Plano errado");
});

test("bolsista integral pelo cadastro: linha \"Bolsista\", sem valor a cobrar e sem menu", async ({ page }) => {
  await seedAcademy(page);
  const dialog = await newStudentDialog(page, "Aluna Bolsista");
  await dialog.getByRole("radio", { name: /^Bolsista/ }).click();
  await expect(dialog.getByRole("radio", { name: /^Integral/ })).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByText("As mensalidades aparecem como Isento, sem cobrança.")).toBeVisible();
  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("Aluno criado com sucesso.")).toBeVisible();

  await page.goto("/classes/billing?status=all");
  const row = rowOf(page, "Aluna Bolsista");
  await expect(row).toContainText("Bolsista");
  await expect(row).toContainText("Bolsa integral");
  await expect(row).toContainText("R$ 0,00");
  // Integral mostra so o selo "Bolsista" (sem "Isento") e nao tem acoes.
  await expect(row).not.toContainText("Isento");
  await expect(page.getByRole("button", { name: "Ações de Aluna Bolsista" })).toHaveCount(0);
  await expect(page.getByText("0 ativas · 1 isenta")).toBeVisible();

  await pickFilter(page, "Filtrar por situação", "Isentas");
  await expect(page).toHaveURL(/status=waived/);
  await expect(row).toBeVisible();
  await pickFilter(page, "Filtrar por situação", "Pendentes");
  await expect(row).toHaveCount(0);
});

test("bolsa parcial de 50%: cobra metade com o valor do plano riscado", async ({ page }) => {
  await seedAcademy(page);
  const dialog = await newStudentDialog(page, "Aluno Meia Bolsa");
  await dialog.getByRole("radio", { name: /^Bolsista/ }).click();
  await dialog.getByRole("radio", { name: /^Parcial/ }).click();
  await dialog.getByRole("combobox", { name: "Plano", exact: true }).click();
  await page.getByRole("option", { name: /Mensal Jiu-Jitsu/ }).click();
  await expect(dialog.getByLabel("Bolsa (%)")).toHaveValue("50");
  await expect(dialog.getByText("Plano R$ 150,00 → paga R$ 75,00 (bolsa de 50%)")).toBeVisible();
  // Comeca no dia 1: primeiro periodo cheio (sem proporcional).
  await dialog.locator("input[name=planStartDate]").fill("2026-09-01");
  await expect(dialog.locator("input[name=firstChargeAmount]")).toHaveValue("75,00");
  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("Aluno criado com sucesso.")).toBeVisible();

  await page.goto("/classes/billing?status=all");
  const row = rowOf(page, "Aluno Meia Bolsa");
  await expect(row).toContainText("Bolsa 50%");
  await expect(row.locator(".line-through")).toHaveText("R$ 150,00");
  await expect(row).toContainText("R$ 75,00");
  // Bolsa parcial continua cobravel.
  await expect(page.getByRole("button", { name: "Ações de Aluno Meia Bolsa" })).toBeVisible();
});

test("trocar o plano substitui a cobrança em aberto; \"Substituídas\" mostra a antiga", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.plans.push({ id: "p-plus", organizationId: "org-academia-x", name: "Mensal Plus", priceCents: 21000, period: "monthly", status: "active", createdAt: TS, updatedAt: TS });
      t.clients = [student("c-a", "Aluno A20", { planStartDate: "2026-09-01" })];
    },
  });
  // A mensalidade de setembro nasce ao abrir a tela.
  await page.goto("/classes/billing?status=all");
  await expect(rowOf(page, "Aluno A20")).toContainText("Mensal Jiu-Jitsu");
  await expect(rowOf(page, "Aluno A20")).toContainText("R$ 150,00");

  await page.goto("/clients");
  await page.getByRole("button", { name: "Ações de Aluno A20", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "Editar cadastro" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Plano e mensalidade/ }).click();
  await dialog.getByRole("combobox", { name: "Plano de acesso" }).click();
  await page.getByRole("option", { name: /Mensal Plus/ }).click();
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Aluno atualizado com sucesso.")).toBeVisible();

  await page.goto("/classes/billing?status=all");
  const row = rowOf(page, "Aluno A20");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Mensal Plus");
  // A antiga nao conta como cancelada nem aparece por padrao.
  await expect(page.getByText("0 canceladas")).toBeVisible();
  await expect(page.getByText("1 cobrança substituída por troca de plano ou regra está oculta.")).toBeVisible();

  await page.getByRole("button", { name: "Mostrar" }).click();
  await expect(page).toHaveURL(/status=replaced/);
  await expect(page.getByRole("combobox", { name: "Filtrar por situação" })).toHaveText("Substituídas");
  await expect(row).toContainText("Substituída");
  await expect(row).toContainText("Mensal Jiu-Jitsu");
  await expect(row).not.toContainText("Mensal Plus");
  await expect(page.getByRole("button", { name: "Ações de Aluno A20" })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Reverter" })).toHaveCount(0);
});

test("filtros de situação e tipo vão para a URL e voltam com \"Limpar filtros\"", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) =>
      (t.clients = [
        student("c-a", "Aluno Atrasado"),
        // Comeca hoje: a 1a cobranca vence hoje (pendente, nao atrasada).
        student("c-b", "Aluno Em Dia", { planStartDate: "2026-09-22" }),
      ]),
  });
  await page.goto("/classes/billing?status=overdue");
  await expect(page.getByRole("combobox", { name: "Filtrar por situação" })).toHaveText("Atrasadas");
  await expect(rowOf(page, "Aluno Atrasado")).toBeVisible();
  await expect(rowOf(page, "Aluno Em Dia")).toHaveCount(0);
  await expect(page.getByText(/(^|· )1 cobrança$/)).toBeVisible();

  await pickFilter(page, "Filtrar por situação", "Pendentes");
  await expect(page).toHaveURL(/status=pending/);
  await expect(rowOf(page, "Aluno Em Dia")).toBeVisible();
  await expect(rowOf(page, "Aluno Atrasado")).toHaveCount(0);

  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page).not.toHaveURL(/status=/);
  await expect(rowOf(page, "Aluno Atrasado")).toBeVisible();
  await expect(rowOf(page, "Aluno Em Dia")).toBeVisible();

  // Tipo tambem vai para a URL e sobrevive a troca de mes.
  await pickFilter(page, "Filtrar por tipo", "Mensalidades");
  await expect(page).toHaveURL(/kind=membership/);
  await page.getByRole("button", { name: "Mês anterior" }).click();
  await expect(page).toHaveURL(/month=2026-08/);
  await expect(page).toHaveURL(/kind=membership/);
  await pickFilter(page, "Filtrar por tipo", "Todos os tipos");
  await expect(page).not.toHaveURL(/kind=/);
  await expect(page).toHaveURL(/month=2026-08/);
});

// SUSPEITA DE BUG (billing-view.tsx, BillingView): o filtro "Tipo" vai para a
// consulta; quando ele esvazia a lista, a tela cai no vazio generico ("Nenhum
// aluno com mensalidade ou aula avulsa neste mes.") sem "Limpar filtros",
// mesmo havendo mensalidades no mes. Ativar quando corrigido.
test("filtro de tipo que esvazia a lista oferece \"Limpar filtros\"", async ({ page }) => {
  await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno A20")]) });
  await page.goto("/classes/billing?status=all");
  await expect(rowOf(page, "Aluno A20")).toBeVisible();
  await pickFilter(page, "Filtrar por tipo", "Aulas avulsas");
  await expect(page.getByRole("button", { name: "Limpar filtros" })).toBeVisible();
  await expect(page.getByText("Nenhuma aula avulsa neste mês.")).toBeVisible();
  await expect(page.getByText("Nenhum aluno com mensalidade ou aula avulsa neste mês.")).toHaveCount(0);
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(rowOf(page, "Aluno A20")).toBeVisible();
});

test("filtro de situação abre direto pela URL em outro mês", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) =>
      (t.clients = [
        student("c-a", "Aluno Agosto", { planStartDate: "2026-08-01" }),
        student("c-b", "Aluno Setembro", { planStartDate: "2026-09-01" }),
      ]),
  });
  // Agosto ja passou: a mensalidade dele nasce ao abrir o mes e esta atrasada.
  await page.goto("/classes/billing?month=2026-08&status=overdue");
  await expect(page.getByRole("button", { name: "Escolher mês (Agosto de 2026)" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Filtrar por situação" })).toHaveText("Atrasadas");
  await expect(rowOf(page, "Aluno Agosto")).toContainText("vence 01/08");
  await expect(rowOf(page, "Aluno Setembro")).toHaveCount(0);
});

test.describe("cobrança online", () => {
  test("desligado nas Configurações, \"Cobrar online\" fica bloqueado com o motivo", async ({ page }) => {
    await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno A20")]) });
    await page.goto("/classes/billing?status=all");
    await page.getByRole("button", { name: "Ações de Aluno A20", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Cobrar online (desligado nas Configurações)" })).toBeDisabled();
    await expect(page.getByRole("menuitem", { name: "Marcar pago" })).toBeEnabled();
  });

  test("Pix gerado e pagamento simulado ficam \"Pago online\" sem desfazer", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        t.clients = [student("c-a", "Aluno A20")];
        // Cobranca online vale no Gratis tambem; ligada nas configuracoes do espaco.
        t.organization.settings = { ...t.organization.settings, onlinePayments: { enabled: true, defaultExpiresInMinutes: 1440 } };
      },
    });

    await page.goto("/classes/billing?status=all");
    const row = rowOf(page, "Aluno A20");
    await rowAction(page, "Aluno A20", "Cobrar online");
    const dialog = page.getByRole("dialog", { name: "Cobrar online" });
    await expect(dialog).toContainText("Aluno A20 · R$ 55,00");
    await expect(dialog.getByRole("radio", { name: /^Pix/ })).toHaveAttribute("aria-checked", "true");
    await dialog.getByRole("button", { name: "Gerar Pix" }).click();
    await expect(page.getByText("Pix gerado.")).toBeVisible();
    await expect(dialog.getByLabel("Código Pix copia e cola")).toBeVisible();

    await dialog.getByRole("button", { name: "Simular pagamento" }).click();
    await expect(page.getByText("Pagamento online confirmado.")).toBeVisible();
    await expect(dialog).toBeHidden();

    await expect(row).toContainText("Pago online");
    await expect(row).toContainText("pago online via Pix");
    // Pago online nao se desfaz (seria estorno): so o (i) com o detalhe no lugar do botao.
    await expect(row.getByTitle("Desfazer pagamento")).toHaveCount(0);
    await expect(row.getByRole("button", { name: /Ver detalhes do pagamento online/ })).toBeVisible();
  });
});
