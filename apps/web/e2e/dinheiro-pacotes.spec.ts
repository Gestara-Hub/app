import type { Page } from "@playwright/test";
import {
  attendanceAction,
  classGroup,
  enrollment,
  expect,
  openProfileSection,
  pageAction,
  rollCallRow,
  seedAcademy,
  test,
} from "./fixtures";
import {
  TS,
  charge,
  contextMenuItems,
  lessonPackage,
  menuAction,
  noPlan,
  openMenuItems,
  openedWhatsApp,
  packageClass,
  pickCombobox,
  pickField,
  pickSelect,
  rowOf,
  stepMonth,
  studentPackage,
  tenantOf,
  usage,
  waitForTenant,
} from "./dinheiro-fixtures";

/**
 * Pacote de aulas (doc 15, "Pacote de aulas"; doc 20, fase C): catalogo em
 * Planos, venda e renovacao, cancelamento, gasto de aula na chamada e entrada
 * na aula pelo pacote. Relogio fixo em 22/09/2026 (terca).
 */

test.describe.configure({ timeout: 90_000 });

const SESSION = "cg-p~2026-09-21~17:00"; // segunda passada: a chamada esta aberta

/** Lista de Alunos sem o coachmark "Lista ou cards" (aparece com 3+ alunos). */
async function openClients(page: Page) {
  await page.evaluate(() => localStorage.setItem("gestarahub_coachmark_view_mode_clients", "1"));
  await page.goto("/clients");
}

/** Menu ⋮ do aluno na lista (a linha tambem e um botao com o mesmo nome). */
async function clientAction(page: Page, name: string, action: string) {
  await page.getByRole("button", { name: `Ações de ${name}`, exact: true }).last().click();
  await page.getByRole("menuitem", { name: action }).click();
}

/** Aulas restantes de um pacote do aluno, lidas do mundo gravado. */
async function remainingOf(page: Page, id: string): Promise<number> {
  const t = await tenantOf(page);
  const p = t.studentPackages.find((x: { id: string }) => x.id === id);
  return p.lessonsTotal - p.usages.length;
}

test.describe("catálogo", () => {
  test("Planos e pacotes: criar com validação, editar, inativar, reativar, busca e situação", async ({ page }) => {
    await seedAcademy(page);
    await page.goto("/classes/plans");
    await expect(page.getByRole("button", { name: "Novo plano" })).toBeVisible();
    await page.getByRole("tab", { name: "Pacotes de aulas" }).click();
    await expect(page).toHaveURL(/tab=packages/);
    await expect(page.getByRole("button", { name: "Novo plano" })).toHaveCount(0);
    await expect(page.getByText("Nenhum pacote de aulas ainda.")).toBeVisible();

    await page.getByRole("button", { name: "Novo pacote" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Novo pacote" });
    await expect(dialog).toContainText("Aulas vendidas juntas, usadas na chamada.");
    await dialog.getByLabel("Quantidade de aulas").fill("0");
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(dialog.getByText("Informe o nome do pacote.")).toBeVisible();
    await expect(dialog.getByText("Informe de 1 a 200 aulas.")).toBeVisible();
    await expect(dialog.getByText("Informe um valor maior que zero.")).toBeVisible();
    await dialog.getByLabel("Quantidade de aulas").fill("201");
    await expect(dialog.getByText("Informe de 1 a 200 aulas.")).toBeVisible();

    await dialog.getByLabel("Nome").fill("10 aulas de Jiu-Jitsu");
    await dialog.getByLabel("Quantidade de aulas").fill("10");
    await dialog.getByLabel("Valor").fill("50000");
    await pickField(page, dialog, "Validade", "30 dias");
    await dialog.getByRole("combobox", { name: "Modalidades" }).click();
    await page.getByRole("option", { name: "Jiu-Jitsu" }).click();
    await page.keyboard.press("Escape");
    await dialog.getByRole("switch", { name: "Falta sem justificativa gasta a aula" }).click();
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Pacote criado.")).toBeVisible();
    await expect(dialog).toBeHidden();

    const row = rowOf(page, "10 aulas de Jiu-Jitsu");
    await expect(row).toContainText("Ativo");
    await expect(row).toContainText("Vale 30 dias");
    await expect(row).toContainText("Jiu-Jitsu");
    await expect(row).toContainText("Falta não gasta");
    await expect(row).toContainText("R$ 500,00");
    await expect(row).toContainText("10 aulas");

    // Outro pacote, sem validade e de todas as modalidades: a lista ordena por aulas.
    await page.getByRole("button", { name: "Novo pacote" }).first().click();
    const second = page.getByRole("dialog", { name: "Novo pacote" });
    await second.getByLabel("Nome").fill("Pacote 5");
    await second.getByLabel("Quantidade de aulas").fill("5");
    await second.getByLabel("Valor").fill("30000");
    await second.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Pacote criado.")).toBeVisible();
    await expect(page.getByText("2 pacotes cadastrados")).toBeVisible();
    await expect(rowOf(page, "Pacote 5")).toContainText("Sem validade");
    await expect(rowOf(page, "Pacote 5")).toContainText("Todas as modalidades");
    await expect(page.getByRole("tabpanel").locator("div.group").first()).toContainText("Pacote 5");

    // Editar pelo clique na linha: vale para as proximas vendas.
    await rowOf(page, "Pacote 5").click();
    const edit = page.getByRole("dialog", { name: "Editar pacote" });
    await expect(edit).toContainText("Vale para as próximas vendas.");
    await expect(edit.getByLabel("Nome")).toHaveValue("Pacote 5");
    await edit.getByLabel("Valor").fill("32000");
    await edit.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Pacote atualizado.")).toBeVisible();
    await expect(rowOf(page, "Pacote 5")).toContainText("R$ 320,00");

    // Menu ⋮ e clique direito com as mesmas acoes.
    expect(await openMenuItems(page, "Pacote 5")).toEqual(["Editar", "Inativar"]);
    expect(await contextMenuItems(page, rowOf(page, "Pacote 5"))).toEqual(["Editar", "Inativar"]);
    await menuAction(page, "Pacote 5", "Inativar");
    const inactivate = page.getByRole("alertdialog", { name: "Inativar pacote?" });
    await expect(inactivate).toContainText("“Pacote 5” deixa de aparecer na venda. Quem já comprou continua usando.");
    await inactivate.getByRole("button", { name: "Inativar" }).click();
    await expect(page.getByText('Pacote "Pacote 5" inativado.')).toBeVisible();
    // O padrao mostra so os ativos.
    await expect(rowOf(page, "Pacote 5")).toHaveCount(0);
    await expect(page.getByText("1 pacote cadastrado", { exact: true })).toBeVisible();

    await pickSelect(page, "Filtrar por status", "Inativos");
    await expect(rowOf(page, "Pacote 5")).toContainText("Inativo");
    await rowOf(page, "Pacote 5").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Reativar" }).click();
    await page.getByRole("alertdialog", { name: "Reativar pacote?" }).getByRole("button", { name: "Reativar" }).click();
    await expect(page.getByText('Pacote "Pacote 5" reativado.')).toBeVisible();
    await expect(page.getByText("Nenhum resultado para os filtros aplicados.")).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros" }).first().click();
    await expect(page.getByText("2 pacotes cadastrados")).toBeVisible();

    // Busca.
    await page.getByRole("textbox", { name: "Buscar pacote" }).fill("jiu");
    await expect(page.getByText("1 pacote cadastrado", { exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "Buscar pacote" }).fill("natação");
    await expect(page.getByText("Nenhum resultado para esta busca.")).toBeVisible();
    await page.getByRole("tabpanel").getByText("Limpar busca", { exact: true }).click();
    await expect(page.getByText("2 pacotes cadastrados")).toBeVisible();

    // Voltar para Planos troca o botao do topo.
    await page.getByRole("tab", { name: "Planos de mensalidade" }).click();
    await expect(page).not.toHaveURL(/tab=packages/);
    await expect(page.getByRole("button", { name: "Novo plano" })).toBeVisible();
  });
});

test.describe("venda", () => {
  test("vender com valor editado e 3x, selo na lista, cobranças em Pacotes e cancelar o pacote", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        t.clients = [noPlan("c-1", "Aluna Pacote"), noPlan("c-2", "Aluno Dois"), noPlan("c-3", "Aluno Três")];
        t.lessonPackages = [
          lessonPackage("lp-10", "10 aulas", { validityDays: 30 }),
          lessonPackage("lp-old", "Pacote antigo", { status: "inactive" }),
        ];
      },
    });
    await openClients(page);
    await clientAction(page, "Aluna Pacote", "Vender pacote");
    const dialog = page.getByRole("dialog", { name: "Vender pacote" });
    await expect(dialog).toContainText("Pacote de aulas para Aluna Pacote.");
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(dialog.getByText("Selecione o pacote.")).toBeVisible();

    // So pacotes ativos do catalogo.
    await dialog.getByRole("combobox", { name: "Pacote" }).click();
    await expect(page.getByRole("option", { name: "Pacote antigo" })).toHaveCount(0);
    await page.getByRole("option", { name: "10 aulas" }).click();
    await expect(dialog).toContainText("10 aulas · vale 30 dias");
    await expect(dialog.getByLabel("Valor")).toHaveValue("500,00");
    await expect(dialog.getByTestId("package-installments-summary")).toHaveText("À vista: R$ 500,00, vence 22/09.");
    await dialog.getByLabel("Valor").fill("45000");
    await pickField(page, dialog, "Parcelas", "3x");
    await expect(dialog.getByTestId("package-installments-summary")).toHaveText("3x de R$ 150,00: 22/09, 22/10 e 22/11.");
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Pacote vendido.")).toBeVisible();
    await expect(dialog).toBeHidden();
    // Quem so tem pacote nao mostra "Sem mensalidade".
    const row = page.locator("div.group").filter({ hasText: "Aluna Pacote" });
    await expect(row.first()).toContainText("Pacote 10 de 10");
    await expect(row.first()).not.toContainText("Sem mensalidade");
    await waitForTenant(page, (t) => t.charges.filter((c: { kind: string }) => c.kind === "package").length === 3);

    // Cobranças > Pacotes: uma parcela por mes; pagar a primeira.
    await page.goto("/classes/billing");
    await pickSelect(page, "Filtrar por tipo", "Pacotes");
    await expect(page).toHaveURL(/kind=package/);
    await expect(rowOf(page, "Aluna Pacote")).toContainText("Pacote 10 aulas");
    await expect(rowOf(page, "Aluna Pacote")).toContainText("parcela 1 de 3");
    await expect(rowOf(page, "Aluna Pacote")).toContainText("R$ 150,00");
    await menuAction(page, "Aluna Pacote", "Marcar pago");
    const pay = page.getByRole("dialog", { name: "Registrar pagamento" });
    await expect(pay).toContainText("Pacote");
    await expect(pay).toContainText("10 aulas (parcela 1 de 3)");
    await pay.getByRole("radio", { name: "Cartão" }).click();
    await pay.getByRole("button", { name: "Registrar pagamento" }).click();
    await expect(page.getByText("Pagamento registrado (Cartão).")).toBeVisible();
    await waitForTenant(page, (t) => t.charges.some((c: { kind: string; status: string }) => c.kind === "package" && c.status === "paid"));

    // Cancelar o pacote (nenhuma aula usada): as em aberto saem, a paga fica.
    await openClients(page);
    await clientAction(page, "Aluna Pacote", "Cancelar pacote");
    const cancel = page.getByRole("alertdialog", { name: "Cancelar pacote?" });
    await expect(cancel).toContainText("O pacote 10 aulas de Aluna Pacote é cancelado. As cobranças em aberto dele também; as pagas ficam.");
    await cancel.getByRole("button", { name: "Cancelar pacote" }).click();
    await expect(page.getByText("Pacote cancelado.")).toBeVisible();
    await expect(row.first()).not.toContainText("Pacote 10 de 10");
    await waitForTenant(page, (t) => t.studentPackages[0]?.status === "canceled");

    await page.goto("/classes/billing?kind=package");
    await expect(rowOf(page, "Aluna Pacote")).toContainText("Pago");
    await stepMonth(page, "next", "2026-10");
    await expect(rowOf(page, "Aluna Pacote")).toContainText("Cancelado");
    await expect(rowOf(page, "Aluna Pacote")).toContainText("Pacote cancelado");
    await expect(rowOf(page, "Aluna Pacote").getByRole("button", { name: "Reverter" })).toBeDisabled();
    await stepMonth(page, "next", "2026-11");
    await expect(rowOf(page, "Aluna Pacote")).toContainText("Cancelado");
    await stepMonth(page, "next", "2026-12");
    await expect(page.getByText("Nenhum pacote neste mês.")).toBeVisible();
  });

  test("renovar leva o saldo e soma no selo; pacote com aula usada não cancela; cancelar o novo devolve o antigo", async ({
    page,
  }) => {
    await seedAcademy(page, {
      extra: (t) => {
        t.clients = [noPlan("c-1", "Aluno Renova")];
        t.classGroups = [packageClass("cg-p", "Jiu-Jitsu Pacote")];
        t.lessonPackages = [lessonPackage("lp-10", "10 aulas")];
        t.studentPackages = [
          studentPackage("sp-1", "c-1", "lp-10", {
            lessonsUsed: 7,
            usages: ["2026-09-01", "2026-09-02", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-14", "2026-09-15"].map((d) =>
              usage("cg-p", d),
            ),
          }),
        ];
      },
    });
    await openClients(page);
    const row = page.locator("div.group").filter({ hasText: "Aluno Renova" }).first();
    await expect(row).toContainText("Pacote 3 de 10");
    // Com aula usada, o pacote nao cancela (o item nem aparece).
    await page.getByRole("button", { name: "Ações de Aluno Renova", exact: true }).last().click();
    await expect(page.getByRole("menuitem", { name: "Vender pacote" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Cancelar pacote" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Vender pacote" }).click();

    const dialog = page.getByRole("dialog", { name: "Vender pacote" });
    await pickCombobox(page, dialog, "Pacote", "10 aulas");
    await expect(dialog.getByText("O saldo de 3 aulas do pacote atual passa para este.")).toBeVisible();
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Pacote vendido.")).toBeVisible();
    await expect(row).toContainText("Pacote 13 de 13");
    await waitForTenant(page, (t) => t.studentPackages.some((p: { status: string }) => p.status === "renewed"));

    // Ficha > Pacotes: o novo em uso, o antigo renovado, com as aulas usadas.
    await page.goto("/clients/c-1?tab=packages");
    const panel = await openProfileSection(page, "Pacotes");
    await expect(panel).toContainText("2 pacotes");
    await pickSelect(page, "Filtrar por situação", "Renovados");
    await expect(panel).toContainText("1 pacote");
    await page.getByRole("button", { name: "Ações do pacote 10 aulas", exact: true }).click();
    await page.getByRole("menuitem", { name: "Ver aulas usadas" }).click();
    await expect(panel).toContainText("15/09/2026 · Jiu-Jitsu Pacote");
    await expect(panel.getByText("Presença")).toHaveCount(7);
    await pickSelect(page, "Filtrar por situação", "Em uso");
    await page.getByRole("button", { name: "Ações do pacote 10 aulas", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Renovar" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Cancelar pacote" }).click();
    await page.getByRole("alertdialog", { name: "Cancelar pacote?" }).getByRole("button", { name: "Cancelar pacote" }).click();
    await expect(page.getByText("Pacote cancelado.")).toBeVisible();
    await waitForTenant(page, (t) => t.studentPackages.find((p: { id: string }) => p.id === "sp-1")?.status === "active");

    // O antigo volta a valer com o saldo dele.
    await openClients(page);
    await expect(row).toContainText("Pacote 3 de 10");
  });
});

/**
 * Turma de pacote (seg/ter/qua 17h) com quatro alunos matriculados:
 * - Aluna Última: resta 1 aula;  - Aluno Sete: 7 de 10 (3 usadas);
 * - Aluno Sem: sem pacote;       - Aluna Falta Livre: pacote em que a falta nao gasta (5 de 10).
 * - Aluno Vencido: pacote vencido em 31/08 com saldo (nao paga a aula).
 */
async function seedRollCall(page: Page) {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [
        noPlan("c-u", "Aluna Última"),
        noPlan("c-7", "Aluno Sete"),
        noPlan("c-s", "Aluno Sem"),
        noPlan("c-f", "Aluna Falta Livre"),
        noPlan("c-v", "Aluno Vencido"),
      ];
      t.classGroups = [packageClass("cg-p", "Jiu-Jitsu Pacote")];
      t.enrollments = ["c-u", "c-7", "c-s", "c-f", "c-v"].map((id) => enrollment(`e-${id}`, "cg-p", id));
      const used = (n: number) =>
        ["2026-09-01", "2026-09-02", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-08"]
          .slice(0, n)
          .map((d, i) => usage("cg-p", d, { sessionId: `old-${i}` }));
      t.lessonPackages = [lessonPackage("lp-10", "10 aulas")];
      t.studentPackages = [
        studentPackage("sp-u", "c-u", "lp-10", { lessonsUsed: 9, usages: used(9) }),
        studentPackage("sp-7", "c-7", "lp-10", { lessonsUsed: 3, usages: used(3) }),
        studentPackage("sp-f", "c-f", "lp-10", { lessonsUsed: 5, usages: used(5), absenceConsumes: false }),
        studentPackage("sp-v", "c-v", "lp-10", { purchasedAt: "2026-07-01", expiresAt: "2026-08-31" }),
      ];
    },
  });
  await page.goto(`/classes/sessions/${encodeURIComponent(SESSION)}`);
}

const rosterRow = (page: Page, name: string) => page.locator("div.group").filter({ hasText: name });

test.describe("chamada", () => {
  test("presença, falta e justificada gastam conforme o pacote; tocar de novo desmarca e devolve", async ({ page }) => {
    await seedRollCall(page);
    await expect(rosterRow(page, "Aluna Última")).toContainText("Última aula");
    await expect(rosterRow(page, "Aluno Sete")).toContainText("7 de 10");
    await expect(rosterRow(page, "Aluno Sem")).toContainText("Sem pacote");
    await expect(rosterRow(page, "Aluna Falta Livre")).toContainText("5 de 10");
    // Pacote vencido nao paga a aula.
    await expect(rosterRow(page, "Aluno Vencido")).toContainText("Sem pacote");

    const sete = rollCallRow(page, "Aluno Sete");

    // Presenca gasta; tocar de novo (com gente a marcar) desmarca e devolve.
    await sete.click();
    await expect(sete).toHaveAccessibleName("Aluno Sete: Presente");
    await expect(rosterRow(page, "Aluno Sete")).toContainText("6 de 10");
    await sete.click();
    await expect(sete).toHaveAccessibleName("Aluno Sete: sem marcação");
    await expect(rosterRow(page, "Aluno Sete")).toContainText("7 de 10");

    // Falta sem justificativa gasta; trocar para justificada devolve.
    await attendanceAction(page, "Aluno Sete", "Marcar falta");
    await expect(sete).toHaveAccessibleName("Aluno Sete: Faltou");
    await expect(rosterRow(page, "Aluno Sete")).toContainText("6 de 10");
    await attendanceAction(page, "Aluno Sete", "Justificar falta");
    await expect(sete).toHaveAccessibleName("Aluno Sete: Justificada");
    await expect(rosterRow(page, "Aluno Sete")).toContainText("7 de 10");

    // Pacote em que a falta nao gasta.
    await attendanceAction(page, "Aluna Falta Livre", "Marcar falta");
    await expect(rollCallRow(page, "Aluna Falta Livre")).toHaveAccessibleName("Aluna Falta Livre: Faltou");
    await expect(rosterRow(page, "Aluna Falta Livre")).toContainText("5 de 10");

    // A ultima aula: gasta nesta chamada, o selo continua dizendo que foi a ultima.
    const last = rollCallRow(page, "Aluna Última");
    await last.click();
    await expect(last).toHaveAccessibleName("Aluna Última: Presente");
    await expect(rosterRow(page, "Aluna Última")).toContainText("Última aula");
    await waitForTenant(page, (t) => t.studentPackages.find((p: { id: string }) => p.id === "sp-u")?.usages.length === 10);

    // Quem falta marcar (Aluno Sem e Aluno Vencido) vem: sem pacote valido, nada e gasto.
    // ("Todos vieram" so aparece enquanto ninguem foi marcado presente.)
    await expect(page.getByRole("button", { name: "Todos vieram" })).toHaveCount(0);
    await rollCallRow(page, "Aluno Sem").click();
    await expect(rollCallRow(page, "Aluno Sem")).toHaveAccessibleName("Aluno Sem: Presente");
    await rollCallRow(page, "Aluno Vencido").click();
    await expect(rollCallRow(page, "Aluno Vencido")).toHaveAccessibleName("Aluno Vencido: Presente");
    await expect(page.getByText("Chamada concluída.")).toBeVisible();
    await waitForTenant(page, (t) => t.attendances.length === 5);
    expect(await remainingOf(page, "sp-v")).toBe(10);
    expect(await remainingOf(page, "sp-7")).toBe(7);
    expect(await remainingOf(page, "sp-f")).toBe(5);
    expect(await remainingOf(page, "sp-u")).toBe(0);

    // Desmarcar a ultima aula devolve o saldo (com a chamada concluida, desmarcar e pelo menu).
    await attendanceAction(page, "Aluna Última", "Desmarcar");
    await expect(last).toHaveAccessibleName("Aluna Última: sem marcação");
    await waitForTenant(page, (t) => t.studentPackages.find((p: { id: string }) => p.id === "sp-u")?.usages.length === 9);
    await expect(rosterRow(page, "Aluna Última")).toContainText("Última aula");
  });

  test("\"Todos vieram\" gasta uma aula de cada pacote", async ({ page }) => {
    await seedRollCall(page);
    await page.getByRole("button", { name: "Todos vieram" }).click();
    await expect(page.getByText("Presença marcada para todos os alunos pendentes.")).toBeVisible();
    await expect(rosterRow(page, "Aluno Sete")).toContainText("6 de 10");
    await expect(rosterRow(page, "Aluna Falta Livre")).toContainText("4 de 10");
    await waitForTenant(page, (t) => t.attendances.length === 5);
    expect(await remainingOf(page, "sp-7")).toBe(6);
    expect(await remainingOf(page, "sp-f")).toBe(4);
    expect(await remainingOf(page, "sp-u")).toBe(0);
    expect(await remainingOf(page, "sp-v")).toBe(10);

    // A turma mostra a forma de cobranca na lista e no detalhe.
    await page.goto("/classes");
    await expect(rowOf(page, "Jiu-Jitsu Pacote")).toContainText("Pacote");
    await page.goto("/classes/cg-p");
    await expect(page.getByTestId("class-billing-summary")).toContainText("Pacote de aulas");
  });

  test("\"Adicionar aluno nesta aula\" pelo pacote: troca sozinho de avulsa para pacote, gasta e devolve ao remover", async ({
    page,
  }) => {
    await seedAcademy(page, {
      extra: (t) => {
        t.clients = [noPlan("c-m", "Aluno Matriculado"), noPlan("c-p", "Aluna Com Pacote"), noPlan("c-x", "Aluno Sem Pacote"), noPlan("c-v", "Aluno Vencido")];
        t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
        t.enrollments = [enrollment("e-m", "cg-1", "c-m")];
        t.lessonPackages = [lessonPackage("lp-10", "10 aulas")];
        t.studentPackages = [
          studentPackage("sp-p", "c-p", "lp-10", { modalityIds: ["m-jj"] }),
          studentPackage("sp-v", "c-v", "lp-10", { purchasedAt: "2026-07-01", expiresAt: "2026-08-31" }),
        ];
      },
    });
    await page.goto(`/classes/sessions/${encodeURIComponent("cg-1~2026-09-21~17:00")}`);
    await pageAction(page, "Mais ações da aula", "Adicionar aluno nesta aula");
    const dialog = page.getByRole("dialog", { name: "Adicionar aluno nesta aula" });
    await expect(dialog).toContainText("Inscreva um aluno como aula avulsa, pelo pacote ou experimental para o dia 21/09/2026.");
    await expect(dialog.getByRole("button", { name: /Aula avulsa/ })).toBeVisible();

    // Na avulsa, escolher quem tem pacote troca para "Pacote".
    await dialog.getByRole("combobox", { name: "Aluno" }).click();
    await page.getByRole("option", { name: "Aluna Com Pacote" }).click();
    await expect(dialog).toContainText("Usa 1 aula do pacote");
    await expect(dialog.getByText("Valor da cobrança")).toHaveCount(0);
    // No "Pacote", so quem tem pacote valido (o vencido fica de fora).
    await dialog.getByRole("combobox", { name: "Aluno" }).click();
    await expect(page.getByRole("option", { name: "Aluna Com Pacote · 10 aulas no pacote" })).toBeVisible();
    await expect(page.getByRole("option", { name: /Aluno Vencido/ })).toHaveCount(0);
    await expect(page.getByRole("option", { name: /Aluno Sem Pacote/ })).toHaveCount(0);
    await page.getByRole("option", { name: "Aluna Com Pacote · 10 aulas no pacote" }).click();
    await dialog.getByRole("button", { name: "Confirmar inscrição" }).click();
    await expect(page.getByText("Aluno inscrito pelo pacote.")).toBeVisible();

    const row = rosterRow(page, "Aluna Com Pacote");
    await expect(row).toContainText("Pacote");
    await expect(row).toContainText("10 de 10");
    await rollCallRow(page, "Aluna Com Pacote").click();
    await expect(row).toContainText("9 de 10");
    // Pela aula avulsa nao houve cobranca.
    await waitForTenant(page, (t) => t.studentPackages.find((p: { id: string }) => p.id === "sp-p")?.usages.length === 1);
    expect((await tenantOf(page)).charges.filter((c: { kind: string }) => c.kind === "dropin")).toHaveLength(0);

    // Remover da aula devolve a aula.
    await menuAction(page, "Aluna Com Pacote", "Remover da aula");
    const confirm = page.getByRole("alertdialog", { name: "Remover da aula?" });
    await expect(confirm).toContainText("Aluna Com Pacote sai desta aula. Se a aula já foi gasta do pacote, ela volta.");
    await confirm.getByRole("button", { name: "Remover" }).click();
    await expect(page.getByText("Aluno removido da aula.")).toBeVisible();
    await expect(rosterRow(page, "Aluna Com Pacote")).toHaveCount(0);
    await waitForTenant(page, (t) => t.studentPackages.find((p: { id: string }) => p.id === "sp-p")?.usages.length === 0);
  });

  test("turma sem avulso também aceita entrar pelo pacote", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        t.clients = [noPlan("c-m", "Aluno Matriculado"), noPlan("c-p", "Aluna Com Pacote")];
        t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Fechada", { allowDropin: false, sessionPriceCents: undefined })];
        t.enrollments = [enrollment("e-m", "cg-1", "c-m")];
        t.lessonPackages = [lessonPackage("lp-10", "10 aulas")];
        // Resta 1 aula (9 usadas em aulas antigas).
        const usages = Array.from({ length: 9 }, (_, i) => usage("cg-1", "2026-09-01", { sessionId: `s-${i}` }));
        t.studentPackages = [studentPackage("sp-p", "c-p", "lp-10", { lessonsUsed: 9, usages })];
      },
    });
    await page.goto(`/classes/sessions/${encodeURIComponent("cg-1~2026-09-21~17:00")}`);
    await pageAction(page, "Mais ações da aula", "Adicionar aluno nesta aula");
    const dialog = page.getByRole("dialog", { name: "Adicionar aluno nesta aula" });
    await expect(dialog).toContainText(
      "Esta turma não aceita aula avulsa. Inscreva um aluno pelo pacote ou como experimental para o dia 21/09/2026.",
    );
    await expect(dialog.getByRole("button", { name: /Aula avulsa/ })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: /Pacote/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Experimental/ })).toBeVisible();
    await pickCombobox(page, dialog, "Aluno", "Aluna Com Pacote · 1 aula no pacote");
    await dialog.getByRole("button", { name: "Confirmar inscrição" }).click();
    await expect(page.getByText("Aluno inscrito pelo pacote.")).toBeVisible();
    await expect(rosterRow(page, "Aluna Com Pacote")).toContainText("Última aula");
  });
});

test("Cobranças > Pacotes: compra à vista com a linha, pagar e desfazer", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [noPlan("c-1", "Aluna Vista")];
      t.lessonPackages = [lessonPackage("lp-10", "10 aulas")];
      t.studentPackages = [studentPackage("sp-1", "c-1", "lp-10", { chargeIds: ["pk-1"], purchasedAt: "2026-09-20" })];
      t.charges = [charge("pk-1", "c-1", { kind: "package", description: "10 aulas", studentPackageId: "sp-1", amountCents: 50000, dueDate: "2026-09-20", createdAt: TS })];
    },
  });
  await page.goto("/classes/billing?kind=package");
  const row = rowOf(page, "Aluna Vista");
  await expect(row).toContainText("Pacote 10 aulas");
  await expect(row).not.toContainText("parcela");
  await expect(row).toContainText("Atrasado");
  await menuAction(page, "Aluna Vista", "Marcar pago");
  const pay = page.getByRole("dialog", { name: "Registrar pagamento" });
  await pay.getByRole("radio", { name: "Pix" }).click();
  await pay.getByRole("button", { name: "Registrar pagamento" }).click();
  await expect(row).toContainText("pago via Pix");
  await row.getByRole("button", { name: "Desfazer pagamento" }).click();
  await page.getByRole("alertdialog", { name: "Desfazer pagamento?" }).getByRole("button", { name: "Desfazer pagamento" }).click();
  await expect(row).toContainText("Atrasado");
  // Cancelar a cobranca nao cancela o pacote (o saldo continua).
  await menuAction(page, "Aluna Vista", "Cancelar cobrança");
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar cobrança" }).click();
  await expect(page.getByText("Cobrança cancelada com sucesso.")).toBeVisible();
  await waitForTenant(page, (t) => t.charges[0].status === "canceled");
  expect((await tenantOf(page)).studentPackages[0].status).toBe("active");
});

test.describe("Dashboard: pacotes acabando", () => {
  /**
   * Hoje e 22/09. Entram: vencido ha 4 dias, usado ate o fim (ainda valido),
   * vencendo em 5 dias e na ultima aula. Ficam de fora: vencido ha 12 dias,
   * quem ja renovou e aluno inativo.
   */
  async function seedEnding(page: Page) {
    await seedAcademy(page, {
      extra: (t) => {
        t.clients = [
          noPlan("c-u", "Aluna Última", { phone: "11955554444" }),
          noPlan("c-v", "Aluno Vence"),
          noPlan("c-x", "Aluna Venceu"),
          noPlan("c-o", "Aluno Venceu Antes"),
          noPlan("c-a", "Aluna Acabou"),
          noPlan("c-r", "Aluno Renovou"),
          noPlan("c-i", "Aluno Inativo", { status: "inactive" }),
        ];
        // Com turma, o Dashboard sai dos primeiros passos.
        t.classGroups = [packageClass("cg-p", "Jiu-Jitsu Pacote")];
        t.lessonPackages = [lessonPackage("lp-10", "10 aulas")];
        const used = (n: number) => Array.from({ length: n }, (_, i) => usage("cg-p", "2026-09-01", { sessionId: `s-${i}` }));
        t.studentPackages = [
          studentPackage("sp-u", "c-u", "lp-10", { lessonsUsed: 9, usages: used(9) }),
          studentPackage("sp-v", "c-v", "lp-10", { lessonsUsed: 6, usages: used(6), purchasedAt: "2026-08-28", expiresAt: "2026-09-27" }),
          studentPackage("sp-x", "c-x", "lp-10", { lessonsUsed: 2, usages: used(2), purchasedAt: "2026-08-19", expiresAt: "2026-09-18" }),
          studentPackage("sp-o", "c-o", "lp-10", { purchasedAt: "2026-08-11", expiresAt: "2026-09-10" }),
          studentPackage("sp-a", "c-a", "lp-10", { lessonsUsed: 10, usages: used(10) }),
          studentPackage("sp-r1", "c-r", "lp-10", { lessonsUsed: 9, usages: used(9), purchasedAt: "2026-08-01" }),
          studentPackage("sp-r2", "c-r", "lp-10", { purchasedAt: "2026-09-20" }),
          studentPackage("sp-i", "c-i", "lp-10", { lessonsUsed: 9, usages: used(9) }),
        ];
      },
    });
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ seen: true, dismissed: false, tours: {} })), "gestarahub:onboarding:org-academia-x");
    await page.goto("/dashboard");
  }

  const todoCard = (page: Page) =>
    page.locator("[data-slot=card]").filter({ has: page.getByText("Para fazer hoje", { exact: true }) });

  test("lista na ordem certa, avisa pelo WhatsApp (\"Avisado hoje\") e vender tira o aluno da lista", async ({ page }) => {
    await seedEnding(page);
    const row = todoCard(page).getByRole("listitem").filter({ has: page.getByText("4 pacotes acabando") }).first();
    await expect(row).toContainText("4 pacotes acabando");
    await row.getByRole("button", { name: "Ver" }).click();
    const lines = row.locator("ul li");
    await expect(lines).toHaveCount(4);
    await expect(lines.nth(0)).toContainText("Aluna Venceu");
    await expect(lines.nth(0)).toContainText("10 aulas · venceu em 18/09");
    await expect(lines.nth(1)).toContainText("Aluna Acabou");
    await expect(lines.nth(1)).toContainText("10 aulas · as aulas acabaram");
    await expect(lines.nth(2)).toContainText("Aluno Vence");
    await expect(lines.nth(2)).toContainText("10 aulas · vence em 5 dias e restam 4 aulas");
    await expect(lines.nth(3)).toContainText("Aluna Última");
    await expect(lines.nth(3)).toContainText("10 aulas · resta 1 aula");
    for (const out of ["Aluno Venceu Antes", "Aluno Renovou", "Aluno Inativo"]) await expect(row).not.toContainText(out);

    const link = await openedWhatsApp(page, () =>
      row.getByRole("button", { name: "Avisar Aluna Última no WhatsApp" }).click(),
    );
    expect(link.phone).toBe("5511955554444");
    expect(link.text).toBe("Oi, Aluna Última! Sobre seu pacote 10 aulas na Academia X: resta 1 aula. Quer renovar e seguir treinando?");
    await expect(lines.nth(3)).toContainText("Avisado hoje");
    const expired = await openedWhatsApp(page, () =>
      row.getByRole("button", { name: "Avisar Aluna Venceu no WhatsApp" }).click(),
    );
    expect(expired.text).toContain("Sobre seu pacote 10 aulas na Academia X: venceu em 18/09.");

    // Vender pacote pelo Dashboard: o aluno sai da lista.
    await lines.nth(2).getByRole("button", { name: "Vender pacote" }).click();
    const dialog = page.getByRole("dialog", { name: "Vender pacote" });
    await expect(dialog).toContainText("Pacote de aulas para Aluno Vence.");
    await pickCombobox(page, dialog, "Pacote", "10 aulas");
    await expect(dialog.getByText("O saldo de 4 aulas do pacote atual passa para este.")).toBeVisible();
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Pacote vendido.")).toBeVisible();
    await expect(todoCard(page)).toContainText("3 pacotes acabando");
    await expect(todoCard(page)).not.toContainText("Aluno Vence");
  });
});
