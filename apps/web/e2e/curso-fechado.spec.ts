import type { Page } from "@playwright/test";
import { stepMonth } from "./dinheiro-fixtures";
import { academyJson, classGroup, enrollment, expect, readAcademy, seedAcademy, student, test } from "./fixtures";

/** Curso fechado (doc 20, fase B). Relogio fixo em 22/09/2026 (terca). */

const TS = "2026-09-01T12:00:00.000Z";

/** A linha inteira (texto + valor + acoes) de um aluno na lista de Cobranças. */
const rowOf = (page: Page, name: string) => page.locator("div.group").filter({ hasText: name });

/** Aluno sem plano: so paga o curso. */
const noPlan = (id: string, name: string) => student(id, name, { planId: undefined });

/** Curso de confeitaria (seg 19h), R$ 800 em ate 4x. */
const course = (id: string, over: Record<string, unknown> = {}) =>
  classGroup(id, "Confeitaria", {
    allowDropin: false,
    sessionPriceCents: undefined,
    meetingSlots: [{ weekday: 1, start: "19:00", end: "21:00" }],
    billingMode: "course",
    coursePriceCents: 80000,
    courseMaxInstallments: 4,
    endDate: "2026-11-30",
    ...over,
  });

/**
 * Abre Cobrancas e espera a tela no mes do relogio do navegador (setembro): o
 * servidor do `pnpm dev` usa a data real, e um clique em "Proximo mes" antes de
 * a tela assumir o relogio do navegador se perde.
 */
async function openBilling(page: Page, query: string) {
  await page.goto(`/classes/billing?${query}`);
  await expect(page.getByRole("button", { name: "Escolher mês (Setembro de 2026)" })).toBeVisible();
}

/** Espera o app gravar o mundo (senao o goto seguinte perde a escrita). */
async function waitForStore(page: Page, predicate: (raw: string) => boolean) {
  await expect
    .poll(async () => {
      void page;
      return predicate(await academyJson());
    })
    .toBe(true);
}

test("curso: criar pelo padrão da área, matricular em 4x, pagar uma parcela e cancelar a matrícula", async ({ page }) => {
  // Fluxo longo (turma, matrícula, quatro meses, pagamento e cancelamento): passa dos 30 s com a suíte inteira.
  test.slow();
  await seedAcademy(page, {
    extra: (t) => {
      // Gastronomia sugere "Curso com valor fechado" na nova turma.
      t.organization.classSegment = "gastronomy";
      t.clients = [noPlan("c-1", "Aluna Curso")];
    },
  });
  await page.goto("/classes");
  await page.getByRole("button", { name: "Nova turma" }).first().click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Nome da turma").fill("Confeitaria Básica");
  await form.getByRole("combobox", { name: /Modalidade/ }).click();
  await page.getByRole("option", { name: "Jiu-Jitsu" }).click();
  await expect(form.getByRole("radio", { name: /Curso com valor fechado/ })).toHaveAttribute("aria-checked", "true");

  // Curso exige valor e data de fim.
  await form.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(form.getByText("Informe o valor do curso.")).toBeVisible();
  await expect(form.getByText("Informe quando o curso termina.")).toBeVisible();

  await form.getByLabel("Valor do curso").fill("80000");
  await expect(form.getByLabel("Valor do curso")).toHaveValue("800,00");
  await form.getByRole("combobox", { name: "Parcelas até" }).click();
  await page.getByRole("menuitem", { name: "4x", exact: true }).click();
  await form.getByLabel("Termina em").fill("2026-11-30");
  await form.getByRole("button", { name: "Adicionar", exact: true }).click();

  // Area de curso: ainda falta matricular, entao criar so avisa (sem comemorar).
  await expect(page.getByText('Turma "Confeitaria Básica" criada com sucesso.')).toBeVisible();
  const party = page.getByRole("alertdialog", { name: "Seu espaço está pronto!" });
  await expect(party).toHaveCount(0);
  await page.getByRole("button", { name: "Matricular alunos" }).click();
  await expect(page).toHaveURL(/\/classes\/[^/?]+\?enroll=true$/);
  const classUrl = page.url().replace("?enroll=true", "");
  // Linha de informacao curta: so ate quando vai o curso (preco e parcelas ficam em "Editar turma").
  await expect(page.getByTestId("class-billing-summary")).toContainText("Curso até 30/11");

  const enroll = page.getByRole("dialog", { name: "Matricular alunos" });
  await enroll.getByRole("option", { name: /Aluna Curso/ }).click();
  // A cobranca vem fechada numa linha com o padrao da turma; "Alterar" abre os campos.
  await expect(enroll.getByTestId("course-charge-line")).toContainText("Cobrança do aluno: R$ 800,00 à vista, vence hoje");
  await expect(enroll.getByLabel("Valor")).toHaveCount(0);
  await enroll.getByRole("button", { name: "Alterar", exact: true }).click();
  await expect(enroll.getByLabel("Valor")).toHaveValue("800,00");
  await enroll.getByRole("combobox", { name: "Parcelas" }).click();
  await page.getByRole("menuitem", { name: "4x", exact: true }).click();
  await enroll.locator("input[name=firstDueDate]").fill("2026-10-15");
  await expect(enroll.getByTestId("course-installments-summary")).toHaveText(
    "4x de R$ 200,00: 15/10, 15/11, 15/12 e 15/01.",
  );
  await enroll.getByRole("button", { name: "Matricular 1 aluno" }).click();
  await expect(page.getByText("Aluno matriculado.")).toBeVisible();
  // A 1a matricula do curso fecha a configuracao inicial: agora comemora.
  await expect(party).toContainText("Os alunos já estão no curso");
  await party.getByRole("button", { name: "Agora não" }).click();
  await expect(party).toBeHidden();
  await waitForStore(page, (raw) => raw.includes('"kind":"course"'));

  // Cobranças, tipo "Cursos": uma parcela por mês. O servidor do `pnpm dev`
  // usa a data real; abrir um mes pela URL pode descasar a hidratacao, entao
  // os meses sao trocados pela tela.
  await openBilling(page, "status=all");
  await stepMonth(page, "next", "2026-10");
  await page.getByRole("combobox", { name: "Filtrar por tipo" }).click();
  await page.getByRole("option", { name: "Cursos" }).click();
  await expect(page).toHaveURL(/kind=course/);
  const row = rowOf(page, "Aluna Curso");
  await expect(row).toContainText("Curso Confeitaria Básica");
  await expect(row).toContainText("parcela 1 de 4");
  await expect(row).toContainText("R$ 200,00");
  await expect(row).toContainText("vence 15/10");
  for (const [i, due] of [
    [2, "15/11"],
    [3, "15/12"],
    [4, "15/01"],
  ] as const) {
    await page.getByRole("button", { name: "Próximo mês" }).click();
    await expect(rowOf(page, "Aluna Curso")).toContainText(`parcela ${i} de 4`);
    await expect(rowOf(page, "Aluna Curso")).toContainText(`vence ${due}`);
  }

  // Pagar a 1a parcela (menu como o da avulsa: sem lembrete de WhatsApp).
  // Um mes por vez (cada clique troca a URL).
  for (const i of [3, 2, 1]) {
    await page.getByRole("button", { name: "Mês anterior" }).click();
    await expect(rowOf(page, "Aluna Curso")).toContainText(`parcela ${i} de 4`);
  }
  await page.getByRole("button", { name: "Ações de Aluna Curso", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /Cobrar online/ })).toBeVisible();
  // Desde a fase D, avulsa, curso e pacote tambem tem lembrete de WhatsApp.
  await expect(page.getByRole("menuitem", { name: "Lembrar no WhatsApp" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Marcar pago" }).click();
  const pay = page.getByRole("dialog", { name: "Registrar pagamento" });
  await expect(pay).toContainText("Curso");
  await expect(pay).toContainText("Confeitaria Básica (parcela 1 de 4)");
  await pay.getByRole("radio", { name: "Pix" }).click();
  await pay.getByRole("button", { name: "Registrar pagamento" }).click();
  await expect(page.getByText("Pagamento registrado (Pix).")).toBeVisible();
  await expect(rowOf(page, "Aluna Curso")).toContainText("pago via Pix");
  await waitForStore(page, (raw) => raw.includes('"paidVia":"manual"'));

  // Cancelar a matrícula: a paga fica, as 3 futuras saem.
  await page.goto(classUrl);
  await page.getByRole("button", { name: "Ações de Aluna Curso", exact: true }).click();
  await page.getByRole("menuitem", { name: "Cancelar matrícula" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("As parcelas pagas ficam. As 3 parcelas futuras serão canceladas.");
  await confirm.getByRole("button", { name: "Cancelar matrícula" }).click();
  await expect(page.getByText("Matrícula cancelada.")).toBeVisible();
  await waitForStore(page, (raw) => raw.includes("Matrícula cancelada"));
  // No banco: a 1a parcela segue paga e as 3 seguintes ficam canceladas.
  const courseCharges = ((await readAcademy()).charges as { kind: string; cycleIndex?: number; status: string }[])
    .filter((c) => c.kind === "course")
    .sort((a, b) => (a.cycleIndex ?? 0) - (b.cycleIndex ?? 0))
    .map((c) => c.status);
  expect(courseCharges).toEqual(["paid", "canceled", "canceled", "canceled"]);

  await openBilling(page, "status=all&kind=course");
  await stepMonth(page, "next", "2026-10");
  await expect(rowOf(page, "Aluna Curso")).toContainText("parcela 1 de 4");
  await expect(rowOf(page, "Aluna Curso")).toContainText("Pago");
  await stepMonth(page, "next", "2026-11");
  await expect(rowOf(page, "Aluna Curso")).toContainText("Encerrado");
  await expect(rowOf(page, "Aluna Curso")).toContainText("Matrícula cancelada");
});

test("curso terminado: Encerrado na lista, Concluído no detalhe e sem matrícula nova", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [noPlan("c-1", "Aluna Formada")];
      t.classGroups = [
        course("cg-old", { name: "Confeitaria de Verão", startDate: "2026-08-03", endDate: "2026-09-20" }),
        classGroup("cg-jj", "Jiu-Jitsu Adulto"),
      ];
      t.enrollments = [
        {
          ...enrollment("e-1", "cg-old", "c-1"),
          course: { priceCents: 80000, installments: 1, firstDueDate: "2026-08-03", installmentGroupId: "g-1" },
        },
      ];
      t.charges = [
        {
          id: "k-1",
          organizationId: "org-academia-x",
          unitId: "unit-academia-x",
          studentId: "c-1",
          kind: "course",
          classGroupId: "cg-old",
          enrollmentId: "e-1",
          description: "Confeitaria de Verão",
          installmentGroupId: "g-1",
          competence: "2026-08",
          dueDate: "2026-08-03",
          amountCents: 80000,
          status: "paid",
          method: "pix",
          paidAt: TS,
          cycleIndex: 1,
          cycleTotal: 1,
          createdAt: TS,
          updatedAt: TS,
        },
      ];
    },
  });

  // Lista: o curso encerrado continua visível (ativas por padrão), no fim.
  await page.goto("/classes");
  const ended = page.locator("div.group").filter({ hasText: "Confeitaria de Verão" });
  await expect(ended).toContainText("Curso");
  await expect(ended).toContainText("Encerrado");
  await expect(page.locator("div.group").filter({ hasText: "Jiu-Jitsu Adulto" })).not.toContainText("Encerrado");

  await page.goto("/classes/cg-old");
  await expect(page.getByTestId("class-billing-summary")).toContainText("Curso encerrado em 20/09");
  await expect(page.getByText("Concluído")).toBeVisible();
  await expect(page.getByRole("button", { name: "Matricular alunos" })).toHaveCount(0);

  // Cancelar depois do fim não mexe nas parcelas.
  await page.getByRole("button", { name: "Ações de Aluna Formada", exact: true }).click();
  await page.getByRole("menuitem", { name: "Cancelar matrícula" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("O curso já terminou: as parcelas continuam como estão.");
});

test("lista de espera do curso: promover pede o pagamento", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [noPlan("c-1", "Aluno Dentro"), noPlan("c-2", "Aluno Esperando")];
      t.classGroups = [course("cg-c", { capacity: 1 })];
      t.enrollments = [enrollment("e-1", "cg-c", "c-1")];
      t.waitlist = [
        { id: "w-1", classGroupId: "cg-c", studentId: "c-2", position: 1, status: "waiting", createdAt: TS },
      ];
    },
  });
  await page.goto("/classes/cg-c");
  await page.getByRole("tab", { name: /Lista de espera/ }).click();
  await page.getByRole("button", { name: "Promover" }).click();

  const dialog = page.getByRole("dialog", { name: "Matricular da lista de espera" });
  await expect(dialog).toContainText("Aluno Esperando entra no curso Confeitaria");
  await expect(dialog.getByTestId("course-charge-line")).toContainText("Cobrança do aluno: R$ 800,00 à vista, vence hoje");
  await dialog.getByRole("button", { name: "Alterar", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Parcelas" }).click();
  await page.getByRole("menuitem", { name: "2x", exact: true }).click();
  await dialog.locator("input[name=firstDueDate]").fill("2026-10-05");
  await expect(dialog.getByTestId("course-installments-summary")).toHaveText("2x de R$ 400,00: 05/10 e 05/11.");
  await dialog.getByRole("button", { name: "Matricular" }).click();
  await expect(page.getByText("Aluno matriculado no curso.")).toBeVisible();
  await expect(dialog).toBeHidden();

  // Lista de espera vazia: as abas somem e volta a lista de alunos.
  await expect(page.getByRole("tablist", { name: "Seções da turma" })).toHaveCount(0);
  await expect(page.getByText("Aluno Esperando")).toBeVisible();
});
