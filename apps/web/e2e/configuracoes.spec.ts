import type { Page } from "@playwright/test";
import { editWorld, expect, loginAs, seedAcademy, student, test } from "./fixtures";

/** Com a cobranca ja configurada, as Regras da mensalidade abrem pelo clique. */
async function openBillingRules(page: Page) {
  const trigger = page.getByRole("button", { name: /Regras da mensalidade/ });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
}

test("prévia das regras da mensalidade mostra as 4 combinações", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/settings#billing-rules");
  await openBillingRules(page);
  const preview = page.locator("[aria-live=polite]").filter({ hasText: "Simulação" });
  // Linha da tabela da previa: vencimento, valor e periodo de aulas.
  const expectRow = async (due: string, amount: string, reference: string) => {
    const row = preview.locator("tr").filter({ hasText: due }).filter({ hasText: amount });
    await expect(row.first()).toContainText(reference);
  };

  const choose = async (timing: string, strategy: string) => {
    await page.getByRole("radio", { name: new RegExp(`^${timing}`) }).click();
    await page.getByRole("radio", { name: new RegExp(`^${strategy}`) }).click();
  };

  await choose("Antecipado", "Proporcional");
  await expectRow("20/09", "R$ 55,00", "20/09 a 30/09 (11 dias)");
  await expectRow("10/10", "R$ 150,00", "outubro");

  await choose("Antecipado", "Mês cheio");
  await expectRow("20/09", "R$ 150,00", "20/09 a 19/10");

  await choose("Depois do uso", "Proporcional");
  await expectRow("10/10", "R$ 55,00", "20/09 a 30/09 (11 dias)");
  await expectRow("10/11", "R$ 150,00", "outubro");

  await choose("Depois do uso", "Mês cheio");
  await expectRow("20/10", "R$ 150,00", "20/09 a 19/10");
});

test("dia de vencimento aceita de 1 a 31 (29 a 31 no último dia dos meses curtos)", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/settings#billing-rules");
  await openBillingRules(page);
  await page.locator("input[name=defaultDueDay]").fill("31");
  await expect(page.getByText("Nos meses mais curtos, vence no último dia.")).toBeVisible();
  await page.locator("input[name=defaultDueDay]").fill("35");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText("Use um dia de 1 a 31.")).toBeVisible();
});

test("fechar um dia com aula avisa as turmas afetadas", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.classGroups = [
        {
          id: "cg-1",
          organizationId: "org-academia-x",
          unitId: "unit-academia-x",
          name: "Jiu-Jitsu Adulto",
          modalityId: "m-jj",
          instructorId: "pr-1",
          capacity: 10,
          meetingSlots: [{ weekday: 1, start: "17:00", end: "18:00" }],
          startDate: "2026-09-14",
          status: "active",
          createdAt: "2026-09-01T12:00:00.000Z",
          updatedAt: "2026-09-01T12:00:00.000Z",
        },
      ];
    },
  });
  await page.goto("/settings?tab=horarios");
  // Salvar antes de a lista de turmas carregar pula o aviso (business-hours-card
  // usa `activeGroups ?? []`). Sob carga isso acontecia; espera a leitura do mock.
  await page.waitForTimeout(1000);
  await page.getByRole("switch").nth(1).click(); // segunda-feira
  await page.getByRole("button", { name: "Salvar horários" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Jiu-Jitsu Adulto (Segunda 17:00)");
  await confirm.getByRole("button", { name: "Voltar" }).click();
  await expect(page.getByText("Horários de funcionamento salvos.")).toHaveCount(0);
});

test("configuração inicial: o Continuar leva ao passo e às Regras da mensalidade abertas", async ({ page }) => {
  await loginAs(page, "Ana Ribeiro");
  await editWorld(page, "org-academia-x", (t) => {
    t.unit.businessHours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, closed: true, shifts: [] }));
    delete t.organization.settings.billingTiming;
  });
  await page.goto("/clients");
  const banner = page.getByRole("complementary", { name: "Progresso da configuração inicial" });
  await expect(banner).toContainText("Definir horário de funcionamento");
  const cont = banner.getByRole("link", { name: "Continuar" });
  // Fora da tela do passo, o Continuar pulsa chamando para la.
  await expect(cont).toHaveClass(/animate-attention-loop/);
  await cont.click();
  await expect(page).toHaveURL(/tab=horarios/);
  // Na tela do passo, sem Continuar.
  await expect(banner.getByRole("link", { name: "Continuar" })).toHaveCount(0);

  await page.getByRole("switch").nth(1).click(); // segunda-feira
  await page.getByRole("button", { name: "Salvar horários" }).click();
  await expect(banner).toContainText("Definir regras da mensalidade");

  // O Continuar leva as Regras da mensalidade ja abertas; o cartao pulsa ate o clique.
  await banner.getByRole("link", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/tab=geral#billing-rules$/);
  await expect(page.getByRole("button", { name: /Regras da mensalidade/ })).toHaveAttribute("aria-expanded", "true");
  // O botao de confirmar treme ate o clique (o destaque saiu do cartao).
  const confirm = page.getByRole("button", { name: /Confirmar regras/ });
  await expect(confirm).toHaveClass(/animate-attention/);
  await confirm.click();
  await expect(page.getByText("● Falta confirmar")).toHaveCount(0);
});

test("boas-vindas: \"Ir para os primeiros passos\" mostra o roteiro no Dashboard", async ({ page }) => {
  await loginAs(page, "Ana Ribeiro");
  await page.goto("/dashboard");
  const welcome = page.getByRole("dialog", { name: /Bem-vindo/ });
  await welcome.getByRole("button", { name: /Ir para os primeiros passos/ }).click();
  await expect(welcome).toBeHidden();
  await expect(page.getByRole("heading", { name: "Primeiros passos", exact: true })).toBeVisible();
});

test("hash repetido na URL ainda abre as Regras da mensalidade", async ({ page }) => {
  await seedAcademy(page);
  // O link abre o cartao sozinho enquanto a cobranca nao foi configurada.
  await editWorld(page, "org-academia-x", (t) => delete t.organization.settings.billingTiming);
  await page.goto("/settings?tab=geral#billing-rules#billing-rules");
  await expect(page.getByRole("button", { name: /Regras da mensalidade/ })).toHaveAttribute("aria-expanded", "true");
});

test("fora da tela do próximo passo o Continuar pulsa; nela, some", async ({ page }) => {
  // Tudo pronto menos a turma: o proximo passo e "Criar a primeira turma" (/classes).
  await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno A20")]) });
  const banner = page.getByRole("complementary", { name: "Progresso da configuração inicial" });
  const cont = banner.getByRole("link", { name: "Continuar" });

  for (const route of ["/classes/modalities", "/classes/billing"]) {
    await page.goto(route);
    await expect(banner).toContainText("Criar a primeira turma");
    await expect(cont).toHaveClass(/animate-attention-loop/);
  }

  await cont.click();
  await expect(page).toHaveURL(/\/classes$/);
  await expect(banner).toContainText("Criar a primeira turma");
  await expect(cont).toHaveCount(0);
});

test("+ Turno sugere depois do último turno e desabilita sem espaço", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/settings?tab=horarios");
  // Segunda do seed: 06:00 até 22:00. Deixa o 1o turno terminar as 12:00.
  await page.getByRole("button", { name: "Editar horários de Segunda" }).click();
  await page.getByLabel("Segunda turno 1 fim").fill("12:00");
  const add = page.getByRole("button", { name: "Adicionar turno em Segunda" });
  await add.click();
  await expect(page.getByLabel("Segunda turno 2 início")).toHaveValue("13:00");
  await expect(page.getByLabel("Segunda turno 2 fim")).toHaveValue("17:00");
  await add.click();
  await expect(page.getByLabel("Segunda turno 3 início")).toHaveValue("18:00");
  await expect(page.getByLabel("Segunda turno 3 fim")).toHaveValue("22:00");
  await add.click();
  await expect(page.getByLabel("Segunda turno 4 início")).toHaveValue("23:00");
  await expect(page.getByLabel("Segunda turno 4 fim")).toHaveValue("23:55");
  await expect(add).toBeDisabled();
});

test("horários: resumo por dia, edição em modal e aplicar a outros dias", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/settings?tab=horarios");
  const summary = (weekday: number) => page.getByTestId(`hours-summary-${weekday}`);
  await expect(summary(1)).toHaveText("06:00–22:00");
  await expect(page.getByLabel("Segunda turno 1 início")).toHaveCount(0);

  await page.getByRole("button", { name: "Editar horários de Segunda" }).click();
  const dialog = page.getByRole("dialog", { name: "Horários de Segunda" });
  await dialog.getByLabel("Segunda turno 1 fim").fill("12:00");
  await dialog.getByRole("button", { name: "Adicionar turno em Segunda" }).click();
  await dialog.getByRole("button", { name: "Ter", exact: true }).click();
  await dialog.getByRole("button", { name: "Aplicar" }).click();
  await expect(dialog).toBeHidden();
  await expect(summary(1)).toHaveText("06:00–12:0013:00–17:00");
  await expect(summary(2)).toHaveText("06:00–12:0013:00–17:00");
  await expect(summary(3)).toHaveText("06:00–22:00");

  // Turno invalido nao aplica: a validacao fica no modal.
  await page.getByRole("button", { name: "Editar horários de Quarta" }).click();
  const wednesday = page.getByRole("dialog", { name: "Horários de Quarta" });
  await wednesday.getByLabel("Quarta turno 1 fim").fill("05:00");
  await wednesday.getByRole("button", { name: "Aplicar" }).click();
  await expect(wednesday.getByText("O horário de início deve ser anterior ao de fim.")).toBeVisible();
  await expect(wednesday.getByLabel("Quarta turno 1 início")).toBeFocused();
  await wednesday.getByRole("button", { name: "Cancelar" }).click();
  await expect(summary(3)).toHaveText("06:00–22:00");
});

test("horários: indicador de não salvo, confirmação ao trocar de aba e salvar", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/settings?tab=horarios");
  const panel = page.locator("#settings-panel-horarios");
  await expect(panel.getByText("Todas as alterações estão salvas")).toBeVisible();

  await panel.getByRole("switch").nth(1).click(); // fecha a segunda
  await expect(panel.getByText("● Alterações não salvas")).toBeVisible();

  await page.getByRole("tab", { name: /Geral/ }).click();
  const confirm = page.getByRole("alertdialog", { name: "Alterações não salvas" });
  await expect(confirm).toContainText("Você tem alterações não salvas na aba Horários");
  await confirm.getByRole("button", { name: "Continuar editando" }).click();
  await expect(confirm).toBeHidden();
  await expect(page).toHaveURL(/tab=horarios/);
  await expect(panel.getByText("● Alterações não salvas")).toBeVisible();

  await panel.getByRole("button", { name: "Salvar horários" }).click();
  await expect(page.getByText("Horários de funcionamento salvos.")).toBeVisible();
  await expect(panel.getByText("Todas as alterações estão salvas")).toBeVisible();

  // Salvo: troca de aba sem perguntar.
  await page.getByRole("tab", { name: /Geral/ }).click();
  await expect(page).toHaveURL(/tab=geral/);
  await expect(confirm).toHaveCount(0);
});

test("aba Dados: apagar os dados da demonstração pede confirmação", async ({ page }) => {
  await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno A20")]) });
  await page.goto("/settings?tab=dados");
  await page.getByRole("button", { name: "Apagar dados da demonstração" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Apagar dados da demonstração?" });
  await expect(confirm).toContainText("Esta ação não pode ser desfeita.");
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await expect(confirm).toBeHidden();

  await page.getByRole("button", { name: "Apagar dados da demonstração" }).click();
  await confirm.getByRole("button", { name: "Apagar tudo" }).click();
  // Apagar encerra a sessao e o mundo volta ao inicial (sem o aluno).
  await page.waitForURL((url) => url.pathname === "/login");
  const hasStudent = await page.evaluate(() => (localStorage.getItem("gestarahub:db") ?? "").includes("Aluno A20"));
  expect(hasStudent).toBe(false);
});

test("horários: 'Aplicar também a' lista os 7 dias com o dia em edição travado", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/settings?tab=horarios");
  await page.getByRole("button", { name: "Editar horários de Segunda" }).click();
  const dialog = page.getByRole("dialog", { name: "Horários de Segunda" });
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  for (const d of days) await expect(dialog.getByRole("button", { name: d, exact: true })).toBeVisible();

  const monday = dialog.getByRole("button", { name: "Seg", exact: true });
  await expect(monday).toHaveAttribute("aria-pressed", "true");
  await expect(monday).toBeDisabled();

  const friday = dialog.getByRole("button", { name: "Sex", exact: true });
  await expect(friday).toHaveAttribute("aria-pressed", "false");
  await friday.click();
  await expect(friday).toHaveAttribute("aria-pressed", "true");
  await friday.click();
  await expect(friday).toHaveAttribute("aria-pressed", "false");
});
