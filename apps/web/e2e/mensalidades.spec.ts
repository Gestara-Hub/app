import type { Page } from "@playwright/test";
import { classGroup, editWorld, enrollment, expect, expectOverdueRow, monthPicker, pageAction, seedAcademy, student, test } from "./fixtures";

/** A linha inteira (texto + valor + acoes) de um aluno na lista de Cobranças. */
const rowOf = (page: Page, name: string) => page.locator("div.group").filter({ hasText: name });

/** Abre o menu ⋮ da mensalidade e escolhe a acao. */
async function rowAction(page: Page, name: string, action: string) {
  await page.getByRole("button", { name: `Ações de ${name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: action }).click();
}

async function payWith(page: Page, method: string) {
  const dialog = page.getByRole("dialog", { name: "Registrar pagamento" });
  await expect(dialog.getByRole("button", { name: "Registrar pagamento" })).toBeDisabled();
  await dialog.getByRole("radio", { name: method }).click();
  await dialog.getByRole("button", { name: "Registrar pagamento" }).click();
}

test.describe("cadastro e geração de mensalidades", () => {
  test("depois do uso + proporcional: 1ª cobrança em 10/10 e nada em setembro", { tag: "@smoke" }, async ({ page }) => {
    await seedAcademy(page, { timing: "postpaid", strategy: "prorated" });

    await page.goto("/clients");
    await page.getByRole("button", { name: "Novo aluno" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome do aluno").fill("Aluno Pós");
    await dialog.getByLabel("Telefone (WhatsApp)").fill("11977776602");
    await dialog.getByRole("combobox", { name: "Plano de acesso" }).click();
    await page.getByRole("option", { name: /Mensal Jiu-Jitsu/ }).click();
    await dialog.locator("input[name=planStartDate]").fill("2026-09-20");

    await expect(dialog.locator("input[name=firstChargeAmount]")).toHaveValue("55,00");
    await expect(dialog.locator("input[name=firstChargeDueDate]")).toHaveValue("2026-10-10");
    await expect(dialog.getByText("Referente a 20/09 a 30/09.")).toBeVisible();
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Aluno criado com sucesso.")).toBeVisible();

    // Setembro (mes atual): depois do uso, nada a cobrar ainda.
    await page.goto("/classes/billing?status=all");
    await expect(monthPicker(page, "Setembro de 2026")).toBeVisible();
    await expect(page.getByText("Nenhuma cobrança nesta competência.")).toBeVisible();

    await page.getByRole("button", { name: "Próximo mês" }).click();
    const row = rowOf(page, "Aluno Pós");
    await expect(row).toContainText("R$ 55,00");
    await expect(row).toContainText("vence 10/10");
  });
});

test.describe("operações de cobrança", () => {
  test.beforeEach(async ({ page }) => {
    await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno A20"), student("c-b", "Aluno B20")]) });
    // As mensalidades do mes atual nascem sozinhas ao abrir a tela.
    await page.goto("/classes/billing?status=all");
    await expect(rowOf(page, "Aluno A20")).toBeVisible();
    await expect(rowOf(page, "Aluno B20")).toBeVisible();
  });

  test("marcar pago exige a forma de pagamento e desfazer pede confirmação", { tag: "@smoke" }, async ({ page }) => {
    const row = rowOf(page, "Aluno A20");
    // Sem selo "Atrasado" na lista (10/11/2026): a data vencida fica em vermelho.
    await expectOverdueRow(row, "20/09");
    await rowAction(page, "Aluno A20", "Marcar pago");
    await payWith(page, "Pix");
    await expect(page.getByText("Pagamento registrado (Pix).")).toBeVisible();
    await expect(row).toContainText("pago via Pix");

    await row.getByTitle("Desfazer pagamento").click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Desfazer pagamento?");
    await confirm.getByRole("button", { name: "Desfazer pagamento" }).click();
    await expect(page.getByText("Pagamento desfeito.")).toBeVisible();
    await expect(page.getByText("pago via Pix")).toHaveCount(0);
  });

  test("a geração automática não duplica ao recarregar", async ({ page }) => {
    await rowAction(page, "Aluno A20", "Marcar pago");
    await payWith(page, "Dinheiro");
    await expect(page.getByText("pago via Dinheiro")).toBeVisible();

    await page.reload();
    await expect(page.getByText("2 cobranças")).toBeVisible();
    await expect(rowOf(page, "Aluno A20")).toHaveCount(1);
    await expect(rowOf(page, "Aluno B20")).toHaveCount(1);
  });

  test("cobrança vencida aparece como atrasada nos cards", async ({ page }) => {
    await expect(page.getByText("R$ 110,00").first()).toBeVisible(); // 2 x R$ 55 em atraso
    await expect(page.getByText("2 em atraso")).toBeVisible();
  });
});

test("dados do mock ficam isolados por teste", async ({ page }) => {
  await seedAcademy(page);
  await editWorld(page, "org-academia-x", (t) => expect(t.charges).toEqual([]));
});

test("cinco alunos com plano geram cinco mensalidades sozinhas", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => (t.clients = [1, 2, 3, 4, 5].map((n) => student(`c-${n}`, `Aluno ${n}`))),
  });
  await page.goto("/classes/billing?status=all");
  await expect(page.getByText("5 cobranças")).toBeVisible();
});

test("filtro de tipo separa aulas avulsas das mensalidades", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [student("c-a", "Aluno A20"), student("c-d", "Aluno Avulso", { planId: undefined })];
      t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
      t.enrollments = [enrollment("e-1", "cg-1", "c-a")];
    },
  });
  // Aula avulsa gera uma cobranca de R$ 40 em setembro.
  await page.goto("/classes/sessions/cg-1~2026-09-21~17%3A00");
  await pageAction(page, "Mais ações da aula", "Adicionar aluno nesta aula");
  const dialog = page.getByRole("dialog", { name: "Adicionar aluno nesta aula" });
  await dialog.getByRole("combobox", { name: "Aluno" }).click();
  await page.getByRole("option", { name: "Aluno Avulso" }).click();
  await dialog.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByText("Aluno avulso adicionado com cobrança gerada.")).toBeVisible();

  await page.goto("/classes/billing?status=all");
  await expect(rowOf(page, "Aluno A20")).toBeVisible();
  await page.getByRole("combobox", { name: "Filtrar por tipo" }).click();
  await page.getByRole("option", { name: "Aulas avulsas" }).click();
  await expect(rowOf(page, "Aluno Avulso")).toContainText("R$ 40,00");
  await expect(page.getByText("Aluno A20")).toHaveCount(0);
});

test("plano com alunos ativos não muda de periodicidade", async ({ page }) => {
  await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno A20")]) });
  await page.goto("/classes/plans");
  await page.getByRole("button", { name: "Ações de Mensal Jiu-Jitsu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  const dialog = page.getByRole("dialog");
  // A tela ja trava a periodicidade e explica (o servidor tambem recusa).
  await expect(dialog.getByRole("combobox", { name: /Periodicidade/ })).toBeDisabled();
  await expect(dialog.getByText("Plano com alunos: para mudar, crie outro plano.")).toBeVisible();
});
