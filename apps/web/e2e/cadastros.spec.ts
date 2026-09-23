import { expect, loginAs, seedAcademy, student, test } from "./fixtures";

test("reativar aluno pede confirmação", async ({ page }) => {
  await seedAcademy(page, { extra: (t) => (t.clients = [student("c-x", "Aluno Inativo", { status: "inactive" })]) });
  await page.goto("/clients");
  await page.getByRole("button", { name: "Ações do aluno" }).last().click();
  await page.getByRole("menuitem", { name: "Reativar" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Reativar aluno?");
  await confirm.getByRole("button", { name: "Reativar" }).click();
  await expect(page.getByText("Aluno reativado.")).toBeVisible();
});

test("plano não aceita valor zero", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/classes/plans");
  await page.getByRole("button", { name: "Novo plano" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Plano grátis");
  await dialog.getByRole("button", { name: "Criar plano" }).click();
  await expect(dialog.getByText("Informe um valor maior que zero.")).toBeVisible();
});

test("busca de aluno por telefone formatado", async ({ page }) => {
  await seedAcademy(page, { extra: (t) => (t.clients = [student("c-m", "Maria", { phone: "11977776603" })]) });
  await page.goto("/clients");
  await page.getByPlaceholder("Buscar por nome ou telefone...").fill("97777-6603");
  await expect(page.getByText("1 aluno cadastrado")).toBeVisible();
});

test("barbearia: agenda abre sem erros", async ({ page }) => {
  await loginAs(page, "Marcelo Andrade");
  await page.goto("/schedule");
  await expect(page.getByRole("heading", { name: /Agenda/ })).toBeVisible();
});
