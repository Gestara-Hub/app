import { editWorld, expect, loginAs, seedAcademy, student, test } from "./fixtures";

test("prévia das regras de cobrança mostra as 4 combinações", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/settings#billing-rules");
  const preview = page.locator("[aria-live=polite]").filter({ hasText: "Na prática" });

  const choose = async (timing: string, strategy: string) => {
    await page.getByRole("radio", { name: new RegExp(`^${timing}`) }).click();
    await page.getByRole("radio", { name: new RegExp(`^${strategy}`) }).click();
  };

  await choose("Antecipado", "Proporcional");
  await expect(preview).toContainText("20/09R$ 55,0020 a 30/09 (11 dias)");
  await expect(preview).toContainText("10/10R$ 150,00outubro");

  await choose("Antecipado", "Mês cheio");
  await expect(preview).toContainText("20/09R$ 150,0020/09 a 19/10");

  await choose("Depois do uso", "Proporcional");
  await expect(preview).toContainText("10/10R$ 55,0020 a 30/09 (11 dias)");
  await expect(preview).toContainText("10/11R$ 150,00outubro");

  await choose("Depois do uso", "Mês cheio");
  await expect(preview).toContainText("20/10R$ 150,0020/09 a 19/10");
});

test("dia de vencimento aceita só de 1 a 28", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/settings#billing-rules");
  await page.locator("input[name=defaultDueDay]").fill("35");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Use um dia de 1 a 28.")).toBeVisible();
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
  await page.getByRole("switch").nth(1).click(); // segunda-feira
  await page.getByRole("button", { name: "Salvar horários" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Jiu-Jitsu Adulto (Segunda 17:00)");
  await confirm.getByRole("button", { name: "Voltar" }).click();
  await expect(page.getByText("Horários de funcionamento salvos.")).toHaveCount(0);
});

test("salvar o horário no onboarding leva ao topo e destaca o Continuar", async ({ page }) => {
  await loginAs(page, "Ana Ribeiro");
  await editWorld(page, "org-academia-x", (t) => {
    t.unit.businessHours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, closed: true, shifts: [] }));
  });
  await page.goto("/settings?tab=horarios");
  const cont = page.getByRole("link", { name: "Continuar" });
  await expect(cont).toBeVisible();
  await expect(cont).not.toHaveClass(/animate-attention-loop/);

  await page.getByRole("switch").nth(1).click(); // segunda-feira
  await page.getByRole("button", { name: "Salvar horários" }).click();

  await expect(page.getByText("Definir regras de cobrança")).toBeVisible();
  await expect(cont).toBeFocused();
  await expect(cont).toHaveClass(/animate-attention-loop/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  // Continua pulsando enquanto o usuario estiver na tela.
  await page.waitForTimeout(3500);
  await expect(cont).toHaveClass(/animate-attention-loop/);

  // O Continuar leva as Regras de Cobranca ja abertas e com foco.
  await cont.click();
  await expect(page).toHaveURL(/tab=geral#billing-rules$/);
  const billing = page.getByRole("button", { name: /Regras de Cobrança/ });
  await expect(billing).toHaveAttribute("aria-expanded", "true");
  await expect(billing).toBeFocused();
  await expect(page.getByRole("radio", { name: /^Antecipado/ })).toBeVisible();
  // O cartao pulsa ate o usuario clicar nele.
  const billingCard = page.locator("#billing-rules");
  await expect(billingCard).toHaveClass(/animate-attention-ring/);
  await page.getByRole("radio", { name: /^Depois do uso/ }).click();
  await expect(billingCard).not.toHaveClass(/animate-attention-ring/);
  await expect(cont).not.toHaveClass(/animate-attention-loop/);
});

test("no dashboard o Continuar do checklist pulsa", async ({ page }) => {
  await loginAs(page, "Ana Ribeiro");
  await page.goto("/");
  const welcome = page.getByRole("dialog", { name: /Bem-vindo/ });
  await welcome.getByRole("button", { name: "Configurar meu negócio" }).click();
  await expect(welcome).toBeHidden();
  const cont = page.getByRole("link", { name: "Continuar" });
  await expect(cont).toHaveClass(/animate-attention-loop/);

  // Continua pulsando em outras visitas (boas-vindas ja respondidas).
  await page.reload();
  await expect(cont).toHaveClass(/animate-attention-loop/);
});

test("hash repetido na URL ainda abre as Regras de Cobrança", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/settings?tab=geral#billing-rules#billing-rules");
  await expect(page.getByRole("button", { name: /Regras de Cobrança/ })).toHaveAttribute("aria-expanded", "true");
});

test("fora da tela do próximo passo o Continuar pulsa; nela, fica parado", async ({ page }) => {
  // Tudo pronto menos a turma: o proximo passo e "Criar a primeira turma" (/classes).
  await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno A20")]) });
  const cont = page.getByRole("link", { name: "Continuar" });

  for (const route of ["/classes/modalities", "/classes/calendar", "/classes/billing"]) {
    await page.goto(route);
    await expect(page.getByText(/Próximo passo · Passo 7 de 7/)).toBeVisible();
    await expect(cont).toHaveClass(/animate-attention-loop/);
  }

  await cont.click();
  await expect(page).toHaveURL(/\/classes$/);
  await expect(page.getByText(/Passo atual · Passo 7 de 7/)).toBeVisible();
  await expect(cont).not.toHaveClass(/animate-attention-loop/);
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
