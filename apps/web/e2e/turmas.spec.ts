import type { Page } from "@playwright/test";
import { classGroup, enrollment, expect, seedAcademy, student, test } from "./fixtures";

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

  // Aula futura: sem botões de presença, só o aviso de quando a chamada abre.
  await page.goto("/classes/sessions/cg-1~2026-09-23~17%3A00");
  await expect(page.getByText("Próxima aula")).toBeVisible();
  await expect(page.getByText("Chamada abre em 23/09")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Presente:/ })).toHaveCount(0);

  // Aula passada: chamada liberada, com resumo e "marcar todos".
  await page.goto("/classes/sessions/cg-1~2026-09-21~17%3A00");
  await expect(page.getByText("Realizada")).toBeVisible();
  await expect(page.getByText(/Chamada abre em/)).toHaveCount(0);
  const present = page.getByRole("button", { name: "Presente: Aluno A20" });
  await expect(present).toHaveAttribute("aria-pressed", "false");
  await present.click();
  await expect(present).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Faltou: Aluno A20" })).toHaveAttribute("aria-pressed", "false");
});

test("avulso gera cobrança e remover da aula pede confirmação e a cancela", async ({ page }) => {
  await seedAcademy(page, { extra: withClass });
  await page.goto("/classes/sessions/cg-1~2026-09-21~17%3A00");

  await page.getByRole("button", { name: "Adicionar aluno nesta aula" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Aluno" }).click();
  await page.getByRole("option", { name: "Aluno Avulso" }).click();
  await dialog.getByRole("button", { name: "Confirmar inscrição" }).click();
  await expect(page.getByText("Aluno avulso adicionado com cobrança gerada.")).toBeVisible();

  await page.getByRole("button", { name: "Remover Aluno Avulso da aula" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Remover da aula?");
  await confirm.getByRole("button", { name: "Remover" }).click();
  await expect(page.getByText("Aluno removido da aula.")).toBeVisible();

  await page.goto("/classes/billing");
  await page.getByRole("button", { name: "Aulas Avulsas" }).click();
  const row = page.locator("div.group").filter({ hasText: "Aluno Avulso" });
  await expect(row).toContainText("Cancelado");
  // Cancelada pelo sistema (saida da aula): nao reabre, e o motivo fica no tooltip.
  await expect(row.getByRole("button", { name: "Reverter" })).toBeDisabled();
  await expect(row.locator("span[title^='Cancelada automaticamente pelo sistema']")).toHaveCount(1);
});

test("cancelar matrícula individual pede confirmação", async ({ page }) => {
  await seedAcademy(page, { extra: withClass });
  await page.goto("/classes/cg-1");
  await page.getByRole("button", { name: "Ações de Aluno A20" }).click();
  await page.getByRole("menuitem", { name: "Cancelar matrícula" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("A mensalidade do aluno não muda.");
  await confirm.getByRole("button", { name: "Cancelar matrícula" }).click();
  await expect(page.getByText("Matrícula cancelada.")).toBeVisible();
});

async function createClass(page: Page, name: string, moveToWednesday = false) {
  await page.goto("/classes");
  await page.getByRole("button", { name: "Nova turma" }).first().click();
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

const SESSION_PAST = "/classes/sessions/cg-1~2026-09-21~17%3A00";

async function addToSession(page: Page, name: string) {
  await page.getByRole("button", { name: "Adicionar aluno nesta aula" }).click();
  const dialog = page.getByRole("dialog", { name: "Adicionar aluno nesta aula" });
  await dialog.getByRole("combobox", { name: "Aluno" }).click();
  await page.getByRole("option", { name }).click();
  await dialog.getByRole("button", { name: "Confirmar inscrição" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("aula", () => {
  test("turma sem avulso oferece só a aula experimental", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        withClass(t);
        t.classGroups[0].allowDropin = false;
      },
    });
    await page.goto(SESSION_PAST);
    await page.getByRole("button", { name: "Adicionar aluno nesta aula" }).click();
    const dialog = page.getByRole("dialog", { name: "Adicionar aluno nesta aula" });
    await expect(dialog).toContainText("Esta turma não aceita aula avulsa.");
    await expect(dialog.getByRole("button", { name: /Aula avulsa/ })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: /Experimental/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("aula lotada ainda deixa adicionar avulso ou experimental", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        withClass(t);
        t.classGroups[0].capacity = 1;
      },
    });
    await page.goto(SESSION_PAST);
    await expect(page.getByText("Turma lotada")).toBeVisible();
    await expect(page.getByRole("button", { name: "Adicionar aluno nesta aula" })).toBeEnabled();
  });

  test("todos os alunos já na aula: botão desabilitado com o motivo", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        withClass(t);
        t.clients = [t.clients[0]];
      },
    });
    await page.goto(SESSION_PAST);
    await expect(page.getByRole("button", { name: "Adicionar aluno nesta aula" })).toBeDisabled();
    await expect(page.getByText("Todos os alunos ativos já estão nesta aula.")).toBeVisible();
  });

  test("ocupação igual no calendário e na aula depois de um avulso", async ({ page }) => {
    await seedAcademy(page, { extra: withClass });
    await page.goto(SESSION_PAST);
    await addToSession(page, "Aluno Avulso");
    await expect(page.getByText("2/10 vagas ocupadas")).toBeVisible();

    await page.goto("/classes/calendar?view=list");
    const card = page.getByRole("link", { name: /Jiu-Jitsu Adulto/ }).filter({ hasText: "17:00" }).first();
    await expect(card).toContainText("2/10 vagas");
    // Os outros dias da semana so tem o matriculado.
    await expect(page.getByRole("link", { name: /Jiu-Jitsu Adulto/ }).nth(1)).toContainText("1/10 vagas");
  });

  test("marcar todos como presentes só marca quem está pendente", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        withClass(t);
        t.clients.push(student("c-c", "Aluna Carla"));
        t.enrollments.push(enrollment("e-2", "cg-1", "c-c"));
      },
    });
    await page.goto(SESSION_PAST);
    await page.getByRole("button", { name: "Faltou: Aluna Carla" }).click();
    await expect(page.getByRole("button", { name: "Faltou: Aluna Carla" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Marcar todos como presentes" }).click();
    await expect(page.getByRole("button", { name: "Presente: Aluno A20" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Faltou: Aluna Carla" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Presente: Aluna Carla" })).toHaveAttribute("aria-pressed", "false");
  });
});

test("cancelar em lote com busca ativa cancela exatamente os selecionados", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [student("c-a", "Aluno A20"), student("c-b", "Bruno Lima"), student("c-c", "Carla Souza")];
      t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
      t.enrollments = [enrollment("e-1", "cg-1", "c-a"), enrollment("e-2", "cg-1", "c-b"), enrollment("e-3", "cg-1", "c-c")];
    },
  });
  await page.goto("/classes/cg-1");
  await page.getByRole("checkbox", { name: "Selecionar Aluno A20" }).click();
  await page.getByRole("checkbox", { name: "Selecionar Bruno Lima" }).click();
  // A busca so filtra a lista: a selecao fora dela continua valendo.
  await page.getByRole("textbox", { name: "Buscar aluno matriculado" }).fill("Bruno");
  await expect(page.getByText("2 selecionados")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar matrícula" }).click();

  const confirm = page.getByRole("alertdialog", { name: "Cancelar 2 matrículas?" });
  await confirm.getByRole("button", { name: "Cancelar matrículas" }).click();
  await expect(page.getByText("2 matrículas canceladas.")).toBeVisible();
  await expect(confirm).toBeHidden();

  await page.getByRole("button", { name: "Limpar busca" }).click();
  await expect(page.getByRole("checkbox", { name: "Selecionar Carla Souza" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Selecionar Aluno A20" })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Selecionar Bruno Lima" })).toHaveCount(0);
});

test.describe("não encontrado", () => {
  test("turma inexistente", async ({ page }) => {
    await seedAcademy(page);
    await page.goto("/classes/xyz");
    await expect(page.getByText("Turma não encontrada")).toBeVisible();
    await expect(page.getByRole("link", { name: "Turmas" }).last()).toHaveAttribute("href", "/classes");
  });

  test("aula inexistente", async ({ page }) => {
    await seedAcademy(page);
    await page.goto("/classes/sessions/xyz");
    await expect(page.getByText("Aula não encontrada")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toHaveCount(0);
  });
});

test.describe("formulário de turma", () => {
  async function openNewClass(page: Page) {
    await page.goto("/classes");
    await page.getByRole("button", { name: "Nova turma" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome da turma").fill("Turma Nova");
    await dialog.getByRole("combobox", { name: /Modalidade/ }).click();
    await page.getByRole("menuitem", { name: "Jiu-Jitsu" }).click();
    return dialog;
  }

  test("avulso ligado exige o valor da aula", async ({ page }) => {
    await seedAcademy(page);
    const dialog = await openNewClass(page);
    await dialog.getByRole("switch", { name: "Permitir alunos avulsos nesta turma" }).click();
    await dialog.getByRole("button", { name: "Criar turma" }).click();
    await expect(dialog.getByText("Informe o valor da aula avulsa.")).toBeVisible();
  });

  test("bloco que muda de dia se ajusta ao expediente do novo dia", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        t.unit.businessHours = [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
          weekday === 1
            ? { weekday, closed: false, start: "08:00", end: "12:00", shifts: [{ start: "08:00", end: "12:00" }] }
            : weekday === 2
              ? { weekday, closed: false, start: "14:00", end: "20:00", shifts: [{ start: "14:00", end: "20:00" }] }
              : { weekday, closed: true, shifts: [] },
        );
      },
    });
    const dialog = await openNewClass(page);
    // Comeca numa segunda: o bloco vem seg 08:00-09:00.
    await dialog.locator("input[name=startDate]").fill("2026-09-28");
    const start = dialog.getByLabel("Início do encontro");
    const end = dialog.getByLabel("Fim do encontro");
    await expect(start).toHaveValue("08:00");
    await expect(end).toHaveValue("09:00");

    // Seg + Ter: nenhum horario serve aos dois, o alerta fica.
    await dialog.getByRole("button", { name: "Ter", exact: true }).click();
    const alert = dialog.getByText(/Horário fora do expediente da unidade \(Terça/);
    await expect(alert).toBeVisible();
    await expect(start).toHaveValue("08:00");

    // So Ter: o bloco vai para a abertura da terca e o alerta some.
    await dialog.getByRole("button", { name: "Seg", exact: true }).click();
    await expect(start).toHaveValue("14:00");
    await expect(end).toHaveValue("15:00");
    await expect(dialog.getByText(/Horário fora do expediente/)).toHaveCount(0);
  });

  test("conflito do professor aparece no bloco na hora", async ({ page }) => {
    await seedAcademy(page, { extra: withClass });
    const dialog = await openNewClass(page);
    // Carlos e o unico professor de Jiu-Jitsu: ja vem escolhido.
    await expect(dialog.getByRole("combobox", { name: /Professor/ })).toContainText("Carlos Silva");
    const conflict = dialog.getByText(/Carlos Silva já dá aula .* na turma "Jiu-Jitsu Adulto"/);
    await expect(conflict).toHaveCount(0);

    await dialog.getByLabel("Início do encontro").fill("17:00");
    await dialog.getByLabel("Fim do encontro").fill("18:00");
    await expect(conflict).toBeVisible();

    // Encostar no fim da outra turma (18:00) nao e conflito.
    await dialog.getByLabel("Fim do encontro").fill("19:00");
    await dialog.getByLabel("Início do encontro").fill("18:00");
    await expect(conflict).toHaveCount(0);
  });
});

test("filtros do calendário ficam na URL e sobrevivem ao reload", async ({ page }) => {
  await seedAcademy(page, { extra: withClass });
  await page.goto("/classes/calendar");
  await expect(page.getByRole("tab", { name: "Grade" })).toHaveAttribute("aria-selected", "true");

  // Cada filtro espera a URL anterior: trocas em sequencia rapida leem a query
  // antiga e uma sobrescreve a outra (ver relatorio).
  await page.getByRole("tab", { name: "Lista" }).click();
  await expect(page).toHaveURL(/view=list/);
  await page.getByRole("combobox", { name: "Filtrar por instrutor" }).click();
  await page.getByRole("option", { name: "Carlos Silva" }).click();
  await expect(page).toHaveURL(/instructor=Carlos\+Silva/);
  await page.getByRole("button", { name: "Próxima semana" }).click();
  await expect(page).toHaveURL(/week=2026-09-28/);
  await expect(page).toHaveURL(/view=list&instructor=Carlos\+Silva&week=2026-09-28$/);

  await page.reload();
  await expect(page.getByRole("tab", { name: "Lista" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("combobox", { name: "Filtrar por instrutor" })).toContainText("Carlos Silva");
  await expect(page.getByText("28/09 – 04/10/2026")).toBeVisible();
});
