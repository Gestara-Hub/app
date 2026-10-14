import type { Locator, Page } from "@playwright/test";
import { classGroup, enrollment, expect, seedAcademy, student, test } from "./fixtures";

const TS = "2026-09-01T12:00:00.000Z";

// Turma ativa de seg/ter/qua 17h com o Aluno A20 matriculado.
const withClass = (t: Record<string, unknown>) => {
  t.clients = [student("c-a", "Aluno A20")];
  t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
  t.enrollments = [enrollment("e-1", "cg-1", "c-a")];
};

// O aluno da lista de espera ja esta matriculado: promover e recusado pelo service (409).
const withRefusedPromotion = (t: Record<string, unknown>) => {
  withClass(t);
  t.waitlist = [{ id: "w-1", classGroupId: "cg-1", studentId: "c-a", position: 1, status: "waiting", createdAt: TS }];
};

const errorToasts = (page: Page) => page.locator("[data-sonner-toast][data-type=error]");

/** Um unico aviso de erro, e continua um so depois da janela do fallback global (150 ms). */
async function expectSingleErrorToast(page: Page, message: string | RegExp): Promise<void> {
  await expect(errorToasts(page)).toHaveCount(1);
  await expect(errorToasts(page)).toContainText(message);
  await page.waitForTimeout(600);
  await expect(errorToasts(page)).toHaveCount(1);
}

/** O controle aponta para o texto do erro: aria-invalid + aria-describedby="<id>-error". */
async function expectFieldError(page: Page, control: Locator, id: string, message: string): Promise<void> {
  await expect(control).toHaveAttribute("aria-invalid", "true");
  await expect(control).toHaveAttribute("aria-describedby", `${id}-error`);
  await expect(page.locator(`[id="${id}-error"]`)).toHaveText(message);
}

const sidebarLink = (page: Page, name: string) => page.getByRole("link", { name, exact: true });

async function promoteFromWaitlist(page: Page): Promise<void> {
  await page.getByRole("tab", { name: /Lista de espera/ }).click();
  await page.getByRole("button", { name: "Promover" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Promover da lista de espera?");
  await confirm.getByRole("button", { name: "Matricular" }).click();
}

test.describe("aviso de erro de ação", () => {
  // O teste do aviso global depende de trocar de tela dentro da latencia do
  // mock (350 ms). Com a suite inteira rodando, a maquina as vezes perde a
  // corrida: ele falha (nunca passa sem testar o fallback) e tenta de novo.
  test.describe.configure({ retries: 2 });
  test("erro tratado no onError do mutate mostra um único aviso", async ({ page }) => {
    await seedAcademy(page, { extra: withRefusedPromotion });
    await page.goto("/classes/cg-1");

    await promoteFromWaitlist(page);
    await expectSingleErrorToast(page, "Aluno A20 já está matriculado nesta turma.");
  });

  test("erro tratado no catch do mutateAsync mostra um único aviso", async ({ page }) => {
    // Turma inativa cujo horario foi ocupado por outra turma do mesmo professor.
    await seedAcademy(page, {
      extra: (t) => {
        withClass(t);
        t.classGroups.push(classGroup("cg-2", "Jiu-Jitsu Kids", { status: "inactive" }));
      },
    });
    await page.goto("/classes");

    await page.getByRole("combobox", { name: "Filtrar por status" }).click();
    await page.getByRole("option", { name: "Inativas" }).click();
    await page.getByRole("button", { name: "Ações de Jiu-Jitsu Kids", exact: true }).click();
    await page.getByRole("menuitem", { name: "Reativar" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Reativar turma?");
    await confirm.getByRole("button", { name: "Reativar" }).click();

    await expectSingleErrorToast(page, /^Carlos Silva já dá aula .+ na turma "Jiu-Jitsu Adulto"\. Escolha outro horário ou outro professor\.$/);
  });

  test("erro sem tratamento na tela (tela já fechada) cai no aviso global, uma vez só", async ({ page }) => {
    await seedAcademy(page, { extra: withRefusedPromotion });
    // Compila a rota de destino antes: a troca de tela precisa acontecer durante a latencia do mock.
    await page.goto("/clients");
    await page.goto("/classes/cg-1");

    await promoteFromWaitlist(page);
    // Sai da tela antes da resposta: o onError do mutate nao roda mais, so o fallback global.
    // O mock responde em 350 ms: a tela tem de sumir antes disso (senao o teste cairia no onError local).
    await sidebarLink(page, "Alunos").click();
    await expect(page.getByRole("tab", { name: /Lista de espera/ })).toHaveCount(0, { timeout: 300 });
    await expect(page).toHaveURL(/\/clients$/);

    await expectSingleErrorToast(page, "Aluno A20 já está matriculado nesta turma.");
  });
});

test("auditoria mostra no topo a ação feita em outra tela, sem recarregar", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.auditLog = [
        {
          id: "au-old",
          organizationId: "org-academia-x",
          unitId: "unit-academia-x",
          timestamp: TS,
          actor: { userId: "usr-ac-ana", name: "Ana Ribeiro", profile: "owner" },
          action: "created",
          target: { type: "plan", id: "p-m", label: "Mensal Jiu-Jitsu" },
          summary: "Ana Ribeiro criou o plano Mensal Jiu-Jitsu (R$ 150,00)",
          security: false,
        },
      ];
    },
  });
  await page.goto("/audit");
  const rows = page.getByRole("button", { name: /^Detalhes: / });
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAccessibleName("Detalhes: Ana Ribeiro criou o plano Mensal Jiu-Jitsu (R$ 150,00)");

  // Marca a pagina: se houver recarga, a marca some.
  await page.evaluate(() => ((window as unknown as { __semRecarga: boolean }).__semRecarga = true));

  await sidebarLink(page, "Planos").click();
  await expect(page).toHaveURL(/\/classes\/plans$/);
  await page.getByRole("button", { name: "Ações de Mensal Jiu-Jitsu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Inativar" }).click();
  await page.getByRole("button", { name: "Inativar plano" }).click();
  await expect(page.getByText('Plano "Mensal Jiu-Jitsu" inativado.')).toBeVisible();

  await sidebarLink(page, "Auditoria").click();
  await expect(page).toHaveURL(/\/audit$/);
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toHaveAccessibleName("Detalhes: Ana Ribeiro inativou o plano Mensal Jiu-Jitsu");
  expect(await page.evaluate(() => (window as unknown as { __semRecarga?: boolean }).__semRecarga)).toBe(true);
});

test.describe("erro de campo", () => {
  test("texto e combobox inválidos apontam para a mensagem do erro", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        // Duas modalidades: o formulario nao escolhe sozinho.
        t.categories.push({ id: "m-mt", organizationId: "org-academia-x", name: "Muay Thai", position: 1, status: "active", createdAt: TS, updatedAt: TS });
      },
    });
    await page.goto("/classes");
    await page.getByRole("button", { name: "Nova turma" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Adicionar", exact: true }).click();

    await expectFieldError(page, dialog.getByRole("textbox", { name: "Nome da turma" }), "name", "Informe o nome da turma.");
    await expectFieldError(page, dialog.getByRole("combobox", { name: "Modalidade" }), "modalityId", "Selecione a modalidade da turma.");
    await expect(errorToasts(page)).toHaveCount(0);
  });

  test("recusa do service por campo vira erro no campo, sem aviso", async ({ page }) => {
    // Plano com aluno ativo: mudar a periodicidade e recusado pelo service (422 com campo).
    await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno A20")]) });
    await page.goto("/classes/plans");
    await page.getByRole("button", { name: "Ações de Mensal Jiu-Jitsu", exact: true }).click();
    await page.getByRole("menuitem", { name: "Editar" }).click();
    const dialog = page.getByRole("dialog");
    const period = dialog.getByRole("combobox", { name: "Periodicidade" });
    await period.click();
    await page.getByRole("menuitem", { name: "Semanal" }).click();
    await dialog.getByRole("button", { name: "Salvar" }).click();

    await expectFieldError(
      page,
      period,
      "period",
      "Não é possível mudar a periodicidade de um plano com alunos ativos. Crie um novo plano.",
    );
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(600);
    await expect(errorToasts(page)).toHaveCount(0);
  });
});
