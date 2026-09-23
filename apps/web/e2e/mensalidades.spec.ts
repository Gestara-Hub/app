import type { Page } from "@playwright/test";
import { editWorld, expect, seedAcademy, student, test } from "./fixtures";

/** A linha inteira (texto + valor + acoes) de um aluno na lista de Mensalidades. */
const rowOf = (page: Page, name: string) => page.locator("div.group").filter({ hasText: name });

test.describe("cadastro e geração de mensalidades", () => {
  test("depois do uso + proporcional: 1ª cobrança em 10/10 e nada em setembro", async ({ page }) => {
    await seedAcademy(page, { timing: "postpaid", strategy: "prorated" });

    await page.goto("/clients");
    await page.getByRole("button", { name: "Novo aluno" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome do aluno").fill("Aluno Pós");
    await dialog.getByLabel("Telefone (WhatsApp)").fill("11977776602");
    await dialog.getByRole("combobox", { name: "Plano de acesso" }).click();
    await page.getByRole("menuitem", { name: /Mensal Jiu-Jitsu/ }).click();
    await dialog.locator("input[name=planStartDate]").fill("2026-09-20");

    await expect(dialog.locator("input[name=firstChargeAmount]")).toHaveValue("55,00");
    await expect(dialog.locator("input[name=firstChargeDueDate]")).toHaveValue("2026-10-10");
    await expect(dialog.getByText("Referente a 20/09 a 30/09.")).toBeVisible();
    await dialog.getByRole("button", { name: "Cadastrar aluno" }).click();
    await expect(page.getByText("Aluno criado com sucesso.")).toBeVisible();

    await page.goto("/classes/billing");
    await expect(page.getByText("Setembro de 2026")).toBeVisible();
    await page.getByRole("button", { name: "Gerar cobranças" }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Gerar cobranças" }).click();
    await expect(page.getByText("Nenhuma cobrança nesta competência.")).toBeVisible();

    await page.getByRole("button", { name: "Próxima competência" }).click();
    const row = rowOf(page, "Aluno Pós");
    await expect(row).toContainText("R$ 55,00");
    await expect(row).toContainText("vence 10/10");
    await expect(row).toContainText("referente a 20/09 a 30/09");
  });
});

test.describe("operações de cobrança", () => {
  test.beforeEach(async ({ page }) => {
    await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno A20"), student("c-b", "Aluno B20")]) });
    await page.goto("/classes/billing");
    await page.getByRole("button", { name: "Gerar cobranças" }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Gerar cobranças" }).click();
    await expect(page.getByText("2 cobrança(s) gerada(s).")).toBeVisible();
  });

  test("marcar pago exige a forma de pagamento e desfazer pede confirmação", async ({ page }) => {
    const row = rowOf(page, "Aluno A20");
    await expect(row).toContainText("Atrasado");
    await row.getByRole("button", { name: "Marcar pago" }).click();

    const dialog = page.getByRole("dialog", { name: "Registrar pagamento" });
    await expect(dialog.getByRole("button", { name: "Registrar pagamento" })).toBeDisabled();
    await dialog.getByRole("radio", { name: "Pix" }).click();
    await dialog.getByRole("button", { name: "Registrar pagamento" }).click();
    await expect(page.getByText("Pagamento registrado (Pix).")).toBeVisible();
    await expect(row).toContainText("pago via Pix");

    await row.getByTitle("Desfazer pagamento").click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Desfazer pagamento?");
    await confirm.getByRole("button", { name: "Desfazer pagamento" }).click();
    await expect(page.getByText("Pagamento desfeito.")).toBeVisible();
    await expect(page.getByText("pago via Pix")).toHaveCount(0);
  });

  test("resetar a competência mantém as cobranças pagas", async ({ page }) => {
    const row = rowOf(page, "Aluno A20");
    await row.getByRole("button", { name: "Marcar pago" }).click();
    const dialog = page.getByRole("dialog", { name: "Registrar pagamento" });
    await dialog.getByRole("radio", { name: "Dinheiro" }).click();
    await dialog.getByRole("button", { name: "Registrar pagamento" }).click();
    await expect(page.getByText("pago via Dinheiro")).toBeVisible();

    await page.getByRole("button", { name: /Resetar cobranças/ }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Cobranças pagas são mantidas.");
    await confirm.getByRole("button", { name: "Resetar cobranças" }).click();

    await expect(page.getByText("1 cobrança(s) removida(s), 1 paga(s) mantida(s).")).toBeVisible();
    await expect(page.getByText("Aluno A20")).toBeVisible();
    await expect(page.getByText("Aluno B20")).toHaveCount(0);
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
