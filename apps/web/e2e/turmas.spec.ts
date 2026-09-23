import { expect, seedAcademy, student, test } from "./fixtures";

const TS = "2026-09-01T12:00:00.000Z";

// Turma de seg/ter/qua às 17h desde 14/09; hoje é terça 22/09.
const withClass = (t: Record<string, unknown>) => {
  t.clients = [student("c-a", "Aluno A20"), student("c-b", "Aluno Avulso", { planId: undefined })];
  t.classGroups = [
    {
      id: "cg-1",
      organizationId: "org-academia-x",
      unitId: "unit-academia-x",
      name: "Jiu-Jitsu Adulto",
      modalityId: "m-jj",
      instructorId: "pr-1",
      capacity: 10,
      allowDropin: true,
      sessionPriceCents: 4000,
      meetingSlots: [1, 2, 3].map((weekday) => ({ weekday, start: "17:00", end: "18:00" })),
      startDate: "2026-09-14",
      status: "active",
      createdAt: TS,
      updatedAt: TS,
    },
  ];
  t.enrollments = [{ id: "e-1", classGroupId: "cg-1", studentId: "c-a", status: "active", enrolledAt: TS }];
};

test("chamada bloqueada em aula futura e liberada em aula passada", async ({ page }) => {
  await seedAcademy(page, { extra: withClass });

  await page.goto("/classes/sessions/cg-1~2026-09-23~17%3A00");
  await expect(page.getByText("A presença fica liberada no dia da aula.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Presente" })).toBeDisabled();

  await page.goto("/classes/sessions/cg-1~2026-09-21~17%3A00");
  await expect(page.getByText("A presença fica liberada no dia da aula.")).toHaveCount(0);
  await page.getByRole("button", { name: "Presente" }).click();
  await expect(page.getByRole("button", { name: "Presente" })).toBeEnabled();
});

test("avulso gera cobrança e remover da aula pede confirmação e a cancela", async ({ page }) => {
  await seedAcademy(page, { extra: withClass });
  await page.goto("/classes/sessions/cg-1~2026-09-21~17%3A00");

  await page.getByRole("button", { name: "Adicionar aluno nesta aula" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").first().selectOption({ label: "Aluno Avulso" });
  await dialog.getByRole("button", { name: "Confirmar inscrição" }).click();
  await expect(page.getByText("Aluno avulso adicionado com cobrança gerada.")).toBeVisible();

  await page.getByTitle("Remover da aula").click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Remover da aula?");
  await confirm.getByRole("button", { name: "Remover" }).click();
  await expect(page.getByText("Aluno removido da aula.")).toBeVisible();

  await page.goto("/classes/billing");
  await page.getByRole("button", { name: "Aulas Avulsas" }).click();
  await expect(page.locator("div.group").filter({ hasText: "Aluno Avulso" })).toContainText("Cancelado");
});

test("cancelar matrícula individual pede confirmação", async ({ page }) => {
  await seedAcademy(page, { extra: withClass });
  await page.goto("/classes/cg-1");
  await page.getByRole("button", { name: "Ações da matrícula" }).click();
  await page.getByRole("menuitem", { name: "Cancelar matrícula" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("A mensalidade do aluno não muda.");
  await confirm.getByRole("button", { name: "Cancelar matrícula" }).click();
  await expect(page.getByText("Matrícula cancelada.")).toBeVisible();
});

async function createClass(page: import("@playwright/test").Page, name: string, moveToWednesday = false) {
  await page.goto("/classes");
  await page.getByRole("button", { name: "Nova turma" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome da turma").fill(name);
  await dialog.getByRole("combobox", { name: /Modalidade/ }).click();
  await page.getByRole("menuitem", { name: "Jiu-Jitsu" }).click();
  await dialog.getByRole("combobox", { name: /Professor/ }).click();
  await page.getByRole("menuitem", { name: "Carlos Silva" }).click();
  if (moveToWednesday) {
    // Evita conflito com a 1a turma (mesmo professor, terca 19h).
    await dialog.getByRole("button", { name: "Qua", exact: true }).click();
    await dialog.getByRole("button", { name: "Ter", exact: true }).click();
  }
  await dialog.getByRole("button", { name: "Criar turma" }).click();
}

test("turma que conclui o cadastro básico abre a comemoração; as seguintes, o aviso simples", async ({ page }) => {
  await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno A20")]) });
  await createClass(page, "Jiu-Jitsu Noturno");
  const party = page.getByRole("alertdialog", { name: /Sua academia está pronta/ });
  await expect(party).toBeVisible();
  await expect(party).toContainText("Jiu-Jitsu Noturno");
  await party.getByRole("button", { name: "Fazer isso mais tarde" }).click();
  await expect(party).toBeHidden();

  await createClass(page, "Jiu-Jitsu Kids", true);
  await expect(page.getByRole("alertdialog", { name: "Turma criada com sucesso!" })).toBeVisible();
  await expect(party).toHaveCount(0);
});

test("primeira turma com cadastro incompleto (sem alunos) não comemora", async ({ page }) => {
  await seedAcademy(page);
  await createClass(page, "Jiu-Jitsu Noturno");
  await expect(page.getByRole("alertdialog", { name: "Turma criada com sucesso!" })).toBeVisible();
  await expect(page.getByRole("alertdialog", { name: /Sua academia está pronta/ })).toHaveCount(0);
});
