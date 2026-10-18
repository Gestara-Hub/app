import type { Page } from "@playwright/test";
import {
  attendanceAction,
  classGroup,
  enrollment,
  expect,
  pageAction,
  rollCallRow,
  seedAcademy,
  student,
  test,
} from "./fixtures";
import { modality } from "./ficha-notas-fixtures";
import { TS, waitWorld, type Tenant } from "./geral-fixtures";

/**
 * Turmas em geral: criar, editar, desativar e reativar; horarios contra o
 * expediente e o professor; trocar instrutor de uma aula; chamada (presente,
 * falta, justificada e desmarcar); lista de espera; avulso e experimental na
 * aula; filtros do calendario; turma e aula inexistentes.
 * Hoje e terca 22/09/2026; Jiu-Jitsu Adulto e seg/ter/qua 17h.
 */

const ORG = "org-academia-x";
const SESSION_PAST = `/classes/sessions/${encodeURIComponent("cg-1~2026-09-21~17:00")}`;

const PAULA = {
  id: "pr-2",
  organizationId: ORG,
  unitId: "unit-academia-x",
  name: "Paula Souza",
  modalityIds: ["m-jj", "m-yoga"],
  serviceIds: [],
  workingHours: [],
  status: "active",
  createdAt: TS,
  updatedAt: TS,
};

async function seedClasses(page: Page, extra?: (t: Tenant) => void) {
  await seedAcademy(page, {
    extra: (t) => {
      t.categories.push(modality("m-yoga", "Yoga", 1));
      t.professionals.push(PAULA);
      t.clients = [
        student("c-a", "Aluno A20"),
        student("c-b", "Bruno Lima", { planId: undefined }),
        student("c-c", "Carla Souza", { planId: undefined }),
      ];
      t.classGroups = [
        classGroup("cg-1", "Jiu-Jitsu Adulto"),
        classGroup("cg-y", "Yoga Manhã", {
          modalityId: "m-yoga",
          instructorId: "pr-2",
          meetingSlots: [{ weekday: 4, start: "08:00", end: "09:00" }],
        }),
      ];
      t.enrollments = [enrollment("e-1", "cg-1", "c-a")];
      extra?.(t);
    },
  });
  await page.evaluate(() => localStorage.setItem("gestarahub_coachmark_view_mode_clients", "1"));
}

async function openNewClass(page: Page) {
  await page.goto("/classes");
  await page.getByRole("button", { name: "Nova turma" }).first().click();
  return page.getByRole("dialog");
}

test.describe("cadastro de turma", () => {
  test("criar, editar pela lista e ver o detalhe", async ({ page }) => {
    await seedClasses(page);
    const dialog = await openNewClass(page);
    await dialog.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(dialog.getByText(/Informe o nome da turma/)).toBeVisible();

    await dialog.getByLabel("Nome da turma").fill("Yoga Noite");
    await dialog.getByRole("combobox", { name: /Modalidade/ }).click();
    await page.getByRole("option", { name: "Yoga" }).click();
    // Paula e a unica professora de Yoga.
    await expect(dialog.getByRole("combobox", { name: /Professor/ })).toContainText("Paula Souza");
    await dialog.getByLabel("Início do encontro").fill("20:00");
    await dialog.getByLabel("Fim do encontro").fill("21:00");
    await dialog.getByLabel("Capacidade (vagas)").fill("12");
    await dialog.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(page.getByText('Turma "Yoga Noite" criada com sucesso.')).toBeVisible();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Ações de Yoga Noite", exact: true }).click();
    await page.getByRole("menuitem", { name: "Editar" }).click();
    const edit = page.getByRole("dialog");
    await expect(edit.getByLabel("Nome da turma")).toHaveValue("Yoga Noite");
    await edit.getByLabel("Nome da turma").fill("Yoga Noturno");
    await edit.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Turma atualizada com sucesso.")).toBeVisible();
    // Editar pela lista nao navega.
    await expect(page).toHaveURL(/\/classes$/);

    await page.getByText("Yoga Noturno", { exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Yoga Noturno" })).toBeVisible();
    // Uma linha de informacao: horarios, instrutor, cobranca e vagas.
    const meta = page.getByTestId("class-billing-summary");
    await expect(meta).toContainText("Paula Souza");
    await expect(meta).toContainText("0 de 12 vagas");
  });

  test("editar pelo detalhe muda a capacidade", async ({ page }) => {
    await seedClasses(page);
    await page.goto("/classes/cg-1");
    await expect(page.getByTestId("class-billing-summary")).toContainText("1 de 10 vagas");
    await pageAction(page, "Mais ações da turma", "Editar turma");
    const edit = page.getByRole("dialog");
    await edit.getByLabel("Capacidade (vagas)").fill("20");
    await edit.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Turma atualizada com sucesso.")).toBeVisible();
    await expect(page.getByTestId("class-billing-summary")).toContainText("1 de 20 vagas");
  });

  test("desativar e reativar com confirmação", async ({ page }) => {
    await seedClasses(page);
    await page.goto("/classes");
    await page.getByRole("button", { name: "Ações de Yoga Manhã", exact: true }).click();
    await page.getByRole("menuitem", { name: "Desativar" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Desativar turma?" });
    await expect(confirm).toContainText("Yoga Manhã");
    await confirm.getByRole("button", { name: "Desativar" }).click();
    await expect(page.getByText('Turma "Yoga Manhã" desativada.')).toBeVisible();
    // A lista abre so com as ativas.
    await expect(page.getByRole("button", { name: "Ações de Yoga Manhã", exact: true })).toHaveCount(0);

    await waitWorld(page, ORG, (t) => t.classGroups.find((g: Tenant) => g.id === "cg-y").status === "inactive");
    // Inativa sai do calendario.
    await page.goto("/classes/calendar?view=list&week=2026-09-28");
    await expect(page.getByRole("link", { name: /Yoga Manhã/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Jiu-Jitsu Adulto/ }).first()).toBeVisible();

    await page.goto("/classes");
    await page.getByRole("combobox", { name: "Filtrar por status" }).click();
    await page.getByRole("option", { name: "Inativas" }).click();
    await page.getByRole("button", { name: "Ações de Yoga Manhã", exact: true }).click();
    await page.getByRole("menuitem", { name: "Reativar" }).click();
    await page.getByRole("alertdialog", { name: "Reativar turma?" }).getByRole("button", { name: "Reativar" }).click();
    await expect(page.getByText('Turma "Yoga Manhã" reativada.')).toBeVisible();
  });

  test("encontro fora do expediente não salva", async ({ page }) => {
    await seedClasses(page);
    const dialog = await openNewClass(page);
    await dialog.getByLabel("Nome da turma").fill("Turma da Madrugada");
    await dialog.getByRole("combobox", { name: /Modalidade/ }).click();
    await page.getByRole("option", { name: "Yoga" }).click();
    // Domingo aparece como fechado; e terca as 05h a unidade ainda nao abriu.
    await expect(dialog.getByRole("button", { name: "Dom fechado" })).toBeVisible();
    await dialog.getByLabel("Início do encontro").fill("05:00");
    await dialog.getByLabel("Fim do encontro").fill("05:45");
    await expect(dialog.getByText(/Horário fora do expediente da unidade \(Terça/)).toBeVisible();
    await dialog.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(page.getByText(/criada com sucesso/)).toHaveCount(0);
    await waitWorld(page, ORG, (t) => t.classGroups.length === 2);
  });

  test("professor ocupado no mesmo horário não salva", async ({ page }) => {
    await seedClasses(page);
    const dialog = await openNewClass(page);
    await dialog.getByLabel("Nome da turma").fill("Jiu-Jitsu Extra");
    await dialog.getByRole("combobox", { name: /Modalidade/ }).click();
    await page.getByRole("option", { name: "Jiu-Jitsu" }).click();
    await dialog.getByRole("combobox", { name: /Professor/ }).click();
    await page.getByRole("option", { name: "Carlos Silva" }).click();
    await dialog.getByLabel("Início do encontro").fill("17:30");
    await dialog.getByLabel("Fim do encontro").fill("18:30");
    const conflict = dialog.getByText(/Carlos Silva já dá aula .* na turma "Jiu-Jitsu Adulto"/);
    await expect(conflict).toBeVisible();
    await dialog.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(page.getByText(/criada com sucesso/)).toHaveCount(0);

    // Com outro professor o mesmo horario passa.
    await dialog.getByRole("combobox", { name: /Professor/ }).click();
    await page.getByRole("option", { name: "Paula Souza" }).click();
    await expect(conflict).toHaveCount(0);
    await dialog.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(page.getByText('Turma "Jiu-Jitsu Extra" criada com sucesso.')).toBeVisible();
  });
});

test.describe("aula", () => {
  test("trocar o instrutor só nesta aula e restaurar o titular", async ({ page }) => {
    await seedClasses(page);
    await page.goto(SESSION_PAST);
    await expect(page.getByRole("main")).toContainText("Segunda-feira, 21 de setembro, 17:00 · Carlos Silva");
    await pageAction(page, "Mais ações da aula", "Trocar instrutor");
    const dialog = page.getByRole("dialog", { name: "Trocar instrutor desta aula" });
    await expect(dialog).toContainText("21/09/2026");
    await expect(dialog.getByRole("button", { name: "Confirmar alteração" })).toBeDisabled();
    await dialog.getByRole("combobox", { name: "Instrutor substituto" }).click();
    await page.getByRole("option", { name: /Paula Souza/ }).click();
    await dialog.getByPlaceholder("Informe o motivo da substituição (opcional)").fill("Carlos em viagem");
    await dialog.getByRole("button", { name: "Confirmar alteração" }).click();
    await expect(page.getByText("Instrutor da aula atualizado com sucesso.")).toBeVisible();
    // O cabecalho diz quem da a aula e quem ele substitui.
    await expect(page.getByRole("main")).toContainText("17:00 · Paula Souza (substituto)");
    await expect(page.getByText("Substitui Carlos Silva · Carlos em viagem")).toBeVisible();

    // As outras aulas seguem com o titular.
    await page.goto(`/classes/sessions/${encodeURIComponent("cg-1~2026-09-22~17:00")}`);
    await expect(page.getByRole("main")).toContainText("Hoje, 17:00 · Carlos Silva");
    await expect(page.getByText(/\(substituto\)/)).toHaveCount(0);

    await page.goto(SESSION_PAST);
    await page.getByRole("button", { name: "Mais ações da aula", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Alterar substituto", exact: true })).toBeVisible();
    await page.getByRole("menuitem", { name: "Restaurar titular", exact: true }).click();
    await expect(page.getByText("Instrutor titular restaurado com sucesso.")).toBeVisible();
    await expect(page.getByRole("main")).toContainText("17:00 · Carlos Silva");
    await expect(page.getByText(/\(substituto\)/)).toHaveCount(0);
    await expect(page.getByText(/^Substitui /)).toHaveCount(0);
  });

  test("chamada: presente, falta, justificada e desmarcar", async ({ page }) => {
    await seedClasses(page, (t) => {
      t.enrollments.push(enrollment("e-2", "cg-1", "c-b"), enrollment("e-3", "cg-1", "c-c"));
    });
    await page.goto(SESSION_PAST);
    const a20 = rollCallRow(page, "Aluno A20");
    const bruno = rollCallRow(page, "Bruno Lima");
    const carla = rollCallRow(page, "Carla Souza");
    await expect(page.getByText("Toque em quem veio")).toBeVisible();
    await expect(page.getByText("0 de 3 presentes")).toBeVisible();

    // Tocar na linha marca presente; falta e justificada ficam no menu do aluno.
    await a20.click();
    await expect(a20).toHaveAccessibleName("Aluno A20: Presente");
    await attendanceAction(page, "Bruno Lima", "Marcar falta");
    await expect(bruno).toHaveAccessibleName("Bruno Lima: Faltou");
    await attendanceAction(page, "Carla Souza", "Justificar falta");
    await expect(carla).toHaveAccessibleName("Carla Souza: Justificada");
    await expect(page.getByText("1 presente · 1 falta · 1 justificada")).toBeVisible();
    await expect(page.getByText("Chamada concluída.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Todos vieram" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Concluir chamada" })).toHaveCount(0);

    // Trocar a marca: tocar na falta vira presente; com a chamada concluida, tocar no presente vira falta.
    await bruno.click();
    await expect(bruno).toHaveAccessibleName("Bruno Lima: Presente");
    await expect(page.getByText("2 presentes · 1 justificada")).toBeVisible();
    await bruno.click();
    await expect(bruno).toHaveAccessibleName("Bruno Lima: Faltou");

    // Desmarcar pelo menu reabre a chamada; com alguem a marcar, tocar no presente desmarca.
    await attendanceAction(page, "Bruno Lima", "Desmarcar");
    await expect(bruno).toHaveAccessibleName("Bruno Lima: sem marcação");
    await expect(page.getByText("1 de 3 presentes")).toBeVisible();
    await a20.click();
    await expect(a20).toHaveAccessibleName("Aluno A20: sem marcação");
    await a20.click();
    await expect(a20).toHaveAccessibleName("Aluno A20: Presente");

    // Persistiu: recarregar mantem as marcas.
    await waitWorld(page, ORG, (t) => t.attendances.length === 2);
    await page.reload();
    await expect(a20).toHaveAccessibleName("Aluno A20: Presente");
    await expect(carla).toHaveAccessibleName("Carla Souza: Justificada");
    await expect(bruno).toHaveAccessibleName("Bruno Lima: sem marcação");
  });

  test("aula experimental e avulso com valor na aula", async ({ page }) => {
    await seedClasses(page);
    await page.goto(SESSION_PAST);
    await pageAction(page, "Mais ações da aula", "Adicionar aluno nesta aula");
    let dialog = page.getByRole("dialog", { name: "Adicionar aluno nesta aula" });
    await dialog.getByRole("combobox", { name: "Aluno" }).click();
    await page.getByRole("option", { name: "Carla Souza" }).click();
    await dialog.getByRole("button", { name: /Experimental/ }).click();
    await expect(dialog.getByText("Valor da cobrança")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Confirmar inscrição" }).click();
    await expect(page.getByText("Aluno inscrito como experimental.")).toBeVisible();
    await expect(page.getByRole("main")).toContainText("Experimental");

    await pageAction(page, "Mais ações da aula", "Adicionar aluno nesta aula");
    dialog = page.getByRole("dialog", { name: "Adicionar aluno nesta aula" });
    await dialog.getByRole("combobox", { name: "Aluno" }).click();
    await page.getByRole("option", { name: "Bruno Lima" }).click();
    await expect(dialog.getByRole("button", { name: /Aula avulsa/ })).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByText("Valor da cobrança")).toBeVisible();
    await dialog.getByRole("button", { name: "Confirmar inscrição" }).click();
    await expect(page.getByText("Aluno avulso adicionado com cobrança gerada.")).toBeVisible();
    // Os tres na chamada (a aula nao mostra mais as vagas).
    await expect(page.getByRole("button", { name: /: sem marcação$/ })).toHaveCount(3);
    await waitWorld(page, ORG, (t) =>
      t.charges.some((c: Tenant) => c.kind === "dropin" && c.studentId === "c-b" && c.amountCents === 4000),
    );
    // Experimental nao gera cobranca.
    await waitWorld(page, ORG, (t) => !t.charges.some((c: Tenant) => c.studentId === "c-c"));
  });
});

test.describe("lista de espera", () => {
  async function seedFull(page: Page) {
    await seedClasses(page, (t) => {
      t.classGroups[0].capacity = 1;
    });
  }

  test("turma lotada: pôr na espera, promover e remover", async ({ page }) => {
    await seedFull(page);
    await page.goto("/classes/cg-1");
    await page.getByRole("button", { name: "Matricular alunos" }).click();
    const dialog = page.getByRole("dialog", { name: "Matricular alunos" });
    await expect(dialog).toContainText("turma lotada");
    await dialog.getByRole("option", { name: /Bruno Lima/ }).click();
    await dialog.getByRole("option", { name: /Carla Souza/ }).click();
    await dialog.getByRole("button", { name: "Pôr na lista de espera" }).click();
    await expect(page.getByText("2 alunos na lista de espera.")).toBeVisible();

    // A aba da lista de espera so aparece quando tem alguem nela.
    await page.getByRole("tab", { name: /Lista de espera/ }).click();
    const panel = page.getByRole("tabpanel");
    await expect(panel).toContainText("1. Bruno Lima");
    await expect(panel).toContainText("2. Carla Souza");

    await panel.getByRole("button", { name: "Promover" }).first().click();
    const promote = page.getByRole("alertdialog", { name: "Promover da lista de espera?" });
    await expect(promote).toContainText("Bruno Lima será matriculado na turma, mesmo que ela esteja lotada.");
    await promote.getByRole("button", { name: "Matricular" }).click();
    await expect(page.getByText("Aluno promovido para matrícula.")).toBeVisible();
    await expect(panel).toContainText("1. Carla Souza");

    await panel.getByRole("button", { name: "Remover Carla Souza da lista" }).click();
    await page.getByRole("alertdialog", { name: "Remover da lista de espera?" }).getByRole("button", { name: "Remover" }).click();
    await expect(page.getByText("Aluno removido da lista de espera.")).toBeVisible();

    // Lista de espera vazia: as abas somem e volta a lista de alunos.
    await expect(page.getByRole("tablist", { name: "Seções da turma" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ações de Bruno Lima", exact: true })).toBeVisible();
    await expect(page.getByTestId("class-billing-summary")).toContainText("Turma lotada");
  });

  test("matricular acima da capacidade pede o botão explícito", async ({ page }) => {
    await seedFull(page);
    await page.goto("/classes/cg-1");
    await page.getByRole("button", { name: "Matricular alunos" }).click();
    const dialog = page.getByRole("dialog", { name: "Matricular alunos" });
    await dialog.getByRole("option", { name: /Bruno Lima/ }).click();
    await dialog.getByRole("button", { name: "Matricular mesmo assim (1)" }).click();
    await expect(page.getByText("Aluno matriculado.")).toBeVisible();
  });
});

test.describe("calendário de turmas", () => {
  test("filtro por modalidade e por instrutor, lista e link para a aula", async ({ page }) => {
    await seedClasses(page);
    await page.goto("/classes/calendar?view=list&week=2026-09-28");
    await expect(page.getByRole("link", { name: /Yoga Manhã/ })).toHaveCount(1);
    await expect(page.getByRole("link", { name: /Jiu-Jitsu Adulto/ })).toHaveCount(3);

    await page.getByRole("combobox", { name: "Filtrar por modalidade" }).click();
    await page.getByRole("option", { name: "Yoga" }).click();
    await expect(page).toHaveURL(/modality=/);
    await expect(page.getByRole("link", { name: /Jiu-Jitsu Adulto/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Yoga Manhã/ })).toHaveCount(1);

    await page.getByRole("combobox", { name: "Filtrar por instrutor" }).click();
    await page.getByRole("option", { name: "Carlos Silva" }).click();
    await expect(page.getByText("Nenhuma aula para os filtros aplicados.")).toBeVisible();

    await page.getByRole("combobox", { name: "Filtrar por modalidade" }).click();
    await page.getByRole("option", { name: "Todas as modalidades" }).click();
    await page.getByRole("link", { name: /Jiu-Jitsu Adulto/ }).first().click();
    await expect(page).toHaveURL(/\/classes\/sessions\/cg-1~2026-09-28~17%3A00/);
    await expect(page.getByText("A chamada abre em 28/09")).toBeVisible();
  });

  test("grade semanal navega entre semanas", async ({ page }) => {
    await seedClasses(page);
    await page.goto("/classes/calendar?week=2026-09-28");
    await expect(page.getByText("28/09 – 04/10/2026")).toBeVisible();
    await page.getByRole("button", { name: "Semana anterior" }).click();
    await expect(page.getByText("21/09 – 27/09/2026")).toBeVisible();
    await page.getByRole("button", { name: "Próxima semana" }).click();
    await page.getByRole("button", { name: "Próxima semana" }).click();
    await expect(page.getByText("05/10 – 11/10/2026")).toBeVisible();
  });
});

test.describe("não encontrado", () => {
  test("turma e aula inexistentes", async ({ page }) => {
    await seedClasses(page);
    await page.goto("/classes/nao-existe");
    await expect(page.getByText("Turma não encontrada")).toBeVisible();
    await page.goto(`/classes/sessions/${encodeURIComponent("cg-1~2026-09-21~03:00")}`);
    await expect(page.getByText("Aula não encontrada")).toBeVisible();
  });
});
