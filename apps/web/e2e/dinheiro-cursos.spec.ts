import { classGroup, enrollment, expect, readAcademy, seedAcademy, student, test } from "./fixtures";
import {
  TS,
  charge,
  courseClass,
  makePro,
  noPlan,
  pickField,
  pickSelect,
  rowOf,
  stepMonth,
  waitForTenant,
} from "./dinheiro-fixtures";

/**
 * Curso com valor fechado (doc 15, "Curso fechado"; doc 20, fase B e o
 * certificado da fase D). Relogio fixo em 22/09/2026 (terca).
 */

test.describe.configure({ timeout: 90_000 });

/** Parcela de curso gravada direto no mundo. */
const installment = (id: string, studentId: string, i: number, total: number, over: Record<string, unknown> = {}) =>
  charge(id, studentId, {
    kind: "course",
    classGroupId: "cg-c",
    enrollmentId: "e-c",
    description: "Confeitaria",
    installmentGroupId: "g-c",
    cycleIndex: i,
    cycleTotal: total,
    amountCents: 20000,
    ...over,
  });

test("lutas: curso pelo formulário (validação do fim), matrícula em lote com valor ajustado e filtro Cursos", { tag: "@smoke" }, async ({
  page,
}) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [student("c-0", "Aluno Mensal"), noPlan("c-1", "Aluna Um"), noPlan("c-2", "Aluno Dois")];
      t.classGroups = [classGroup("cg-jj", "Jiu-Jitsu Adulto")];
      t.enrollments = [enrollment("e-0", "cg-jj", "c-0")];
    },
  });
  await page.goto("/classes");
  await page.getByRole("button", { name: "Nova turma" }).first().click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Nome da turma").fill("Defesa Pessoal Intensivo");
  await form.getByRole("combobox", { name: /Modalidade/ }).click();
  await page.getByRole("option", { name: "Jiu-Jitsu" }).click();

  // Lutas comeca na mensalidade; as 4 formas de cobranca em cartoes, com a dica de cada uma.
  await expect(form.getByRole("radio", { name: /Mensalidade/ })).toHaveAttribute("aria-checked", "true");
  await expect(form.getByRole("radio", { name: /Mensalidade/ })).toContainText("Cada aluno paga pelo seu plano");
  await form.getByRole("radio", { name: /Pacote de aulas/ }).click();
  await expect(form.getByRole("radio", { name: /Pacote de aulas/ })).toContainText("Cada aula usa uma do pacote");
  await form.getByRole("radio", { name: /Sem cobrança/ }).click();
  await expect(form.getByRole("radio", { name: /Sem cobrança/ })).toContainText("Turma gratuita, sem cobranças");
  await expect(form.getByRole("switch", { name: "Permitir alunos avulsos nesta turma" })).toHaveCount(0);
  await form.getByRole("radio", { name: /Curso com valor fechado/ }).click();

  // Fim antes do inicio e recusado.
  await form.getByLabel("Valor do curso").fill("60000");
  await pickField(page, form, "Parcelas até", "3x");
  await form.getByLabel("Termina em").fill("2026-09-01");
  await form.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(form.getByText("O curso não pode terminar antes de começar.")).toBeVisible();
  await form.getByLabel("Termina em").fill("2026-12-15");
  await form.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByText('Turma "Defesa Pessoal Intensivo" criada com sucesso.')).toBeVisible();
  await page.getByRole("button", { name: "Matricular alunos" }).click();
  await expect(page).toHaveURL(/\/classes\/[^/?]+\?enroll=true$/);
  // Linha de informacao curta: so ate quando vai o curso (preco e parcelas ficam em "Editar turma").
  await expect(page.getByTestId("class-billing-summary")).toContainText("Curso até 15/12");

  // Lote: os dois com o mesmo pagamento, valor ajustado (desconto) e 2x.
  const enroll = page.getByRole("dialog", { name: "Matricular alunos" });
  await enroll.getByRole("option", { name: /Aluna Um/ }).click();
  await enroll.getByRole("option", { name: /Aluno Dois/ }).click();
  // Fechada, a cobranca e uma linha com o padrao da turma (vale para cada aluno).
  await expect(enroll.getByTestId("course-charge-line")).toContainText("Cobrança de cada aluno: R$ 600,00 à vista, vence hoje");
  await expect(enroll.getByTestId("course-installments-summary")).toHaveCount(0);
  await enroll.getByRole("button", { name: "Alterar", exact: true }).click();
  await expect(enroll.getByLabel("Valor")).toHaveValue("600,00");
  // Parcelas so ate o maximo da turma.
  await enroll.getByRole("combobox", { name: "Parcelas" }).click();
  await expect(page.getByRole("menuitem", { name: "3x", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "4x", exact: true })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "2x", exact: true }).click();
  await enroll.getByLabel("Valor").fill("50000");
  await enroll.locator("input[name=firstDueDate]").fill("2026-09-30");
  await expect(enroll.getByTestId("course-installments-summary")).toHaveText("2x de R$ 250,00: 30/09 e 30/10. Vale para cada aluno.");
  await enroll.getByRole("button", { name: "Matricular 2 alunos" }).click();
  await expect(page.getByText("2 alunos matriculados.")).toBeVisible();
  await waitForTenant(page, (t) => t.charges.filter((c: { kind: string }) => c.kind === "course").length === 4);

  // Cobranças > Cursos: uma parcela de cada aluno por mes (30/10 cai em outubro).
  await page.goto("/classes/billing?status=all");
  await pickSelect(page, "Filtrar por tipo", "Cursos");
  await expect(page).toHaveURL(/kind=course/);
  await expect(page.getByText(/(^|· )2 cobranças$/)).toBeVisible();
  for (const name of ["Aluna Um", "Aluno Dois"]) {
    await expect(rowOf(page, name)).toContainText("Curso Defesa Pessoal Intensivo");
    await expect(rowOf(page, name)).toContainText("parcela 1 de 2");
    await expect(rowOf(page, name)).toContainText("vence 30/09");
    await expect(rowOf(page, name)).toContainText("R$ 250,00");
  }
  // O aluno da mensalidade nao aparece no filtro de cursos.
  await expect(rowOf(page, "Aluno Mensal")).toHaveCount(0);
  await stepMonth(page, "next", "2026-10");
  await expect(rowOf(page, "Aluna Um")).toContainText("parcela 2 de 2");
  await stepMonth(page, "next", "2026-11");
  await expect(page.getByText("Nenhuma parcela de curso neste mês.")).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page).not.toHaveURL(/kind=/);
});

test("sair no meio do curso: paga fica, vencida continua, futuras e o Pix em aberto são cancelados", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [noPlan("c-1", "Aluna Meio")];
      t.classGroups = [courseClass("cg-c", "Confeitaria", { startDate: "2026-08-03" })];
      t.enrollments = [
        {
          ...enrollment("e-c", "cg-c", "c-1"),
          course: { priceCents: 80000, installments: 4, firstDueDate: "2026-08-15", installmentGroupId: "g-c" },
        },
      ];
      t.charges = [
        installment("k-1", "c-1", 1, 4, { competence: "2026-08", dueDate: "2026-08-15", status: "paid", method: "pix", paidAt: TS, paidVia: "manual" }),
        installment("k-2", "c-1", 2, 4, { competence: "2026-09", dueDate: "2026-09-15" }),
        installment("k-3", "c-1", 3, 4, { competence: "2026-10", dueDate: "2026-10-15" }),
        installment("k-4", "c-1", 4, 4, { competence: "2026-11", dueDate: "2026-11-15" }),
      ];
      t.onlinePayments = [
        {
          id: "op-3",
          organizationId: "org-academia-x",
          chargeId: "k-3",
          method: "pix",
          amountCents: 20000,
          status: "awaiting",
          pixCopyPaste: "00020126PIXFICTICIO",
          expiresAt: "2026-09-30T12:00:00.000Z",
          createdAt: TS,
        },
      ];
    },
  });

  await page.goto("/classes/cg-c");
  await page.getByRole("button", { name: "Ações de Aluna Meio", exact: true }).click();
  await page.getByRole("menuitem", { name: "Cancelar matrícula" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Cancelar matrícula?" });
  await expect(confirm).toContainText(
    "Aluna Meio sai do curso. As parcelas pagas ficam. As 2 parcelas futuras serão canceladas. A parcela que vence até hoje continua para receber.",
  );
  await confirm.getByRole("button", { name: "Cancelar matrícula" }).click();
  await expect(page.getByText("Matrícula cancelada.")).toBeVisible();
  await waitForTenant(page, (t) => t.charges.find((c: { id: string }) => c.id === "k-3")?.status === "canceled");

  // O Pix da parcela cancelada tambem foi cancelado.
  const tenant = await readAcademy();
  expect(tenant.onlinePayments.find((p: { id: string }) => p.id === "op-3").status).toBe("canceled");

  await page.goto("/classes/billing?status=all&kind=course");
  // Setembro: a vencida (15/09) continua em aberto, atrasada.
  await expect(rowOf(page, "Aluna Meio")).toContainText("parcela 2 de 4");
  await expect(rowOf(page, "Aluna Meio")).toContainText("Atrasado");
  await stepMonth(page, "prev", "2026-08");
  await expect(rowOf(page, "Aluna Meio")).toContainText("Pago");
  await stepMonth(page, "next", "2026-09");
  await stepMonth(page, "next", "2026-10");
  const october = rowOf(page, "Aluna Meio");
  await expect(october).toContainText("Encerrado");
  await expect(october).toContainText("Matrícula cancelada");
  // Cancelada pelo sistema: nao reabre (botao travado, sem menu de clique direito).
  await expect(october.getByRole("button", { name: "Reverter" })).toHaveCount(0);
  await october.click({ button: "right" });
  await expect(page.getByRole("menu")).toHaveCount(0);
  await stepMonth(page, "next", "2026-11");
  await expect(rowOf(page, "Aluna Meio")).toContainText("Encerrado");
  // Canceladas pelo sistema entram em "Canceladas" (nao sao substituidas).
  await pickSelect(page, "Filtrar por situação", /Canceladas/);
  await expect(page.getByText(/(^|· )1 cobrança$/)).toBeVisible();
});

/** Curso de verao (seg 19h, 03/08 a 20/09) ja terminado, com 4 chamadas da aluna. */
function endedCourse(t: Record<string, unknown>) {
  t.clients = [noPlan("c-1", "Aluna Formada"), noPlan("c-2", "Aluno Novo")];
  t.classGroups = [courseClass("cg-old", "Confeitaria de Verão", { startDate: "2026-08-03", endDate: "2026-09-20" })];
  t.enrollments = [
    {
      ...enrollment("e-1", "cg-old", "c-1"),
      course: { priceCents: 80000, installments: 1, firstDueDate: "2026-08-03", installmentGroupId: "g-1" },
    },
  ];
  const att = (date: string, status: string) => ({
    id: `at-${date}`,
    sessionId: `cg-old~${date}~19:00`,
    studentId: "c-1",
    status,
    markedAt: TS,
  });
  t.attendances = [att("2026-08-03", "present"), att("2026-08-10", "present"), att("2026-08-17", "absent"), att("2026-08-24", "present")];
}

test("curso terminado no grátis: Concluído, sem matrícula nova e certificado travado no Plano Profissional", async ({ page }) => {
  await seedAcademy(page, { extra: endedCourse });
  await page.goto("/classes");
  const ended = rowOf(page, "Confeitaria de Verão");
  await expect(ended).toContainText("Curso");
  await expect(ended).toContainText("Encerrado");

  await page.goto("/classes/cg-old");
  await expect(page.getByTestId("class-billing-summary")).toContainText("Curso encerrado em 20/09");
  await expect(page.getByText("Concluído")).toBeVisible();
  await expect(page.getByRole("button", { name: "Matricular alunos" })).toHaveCount(0);

  await page.getByRole("button", { name: "Ações de Aluna Formada", exact: true }).click();
  await page.getByRole("menuitem", { name: "Certificado (Plano Profissional)" }).click();
  await expect(page).toHaveURL(/\/classes\/cg-old\/certificate\/e-1$/);
  await expect(page.getByText("Faz parte do Plano Profissional. Imprima ou salve em PDF no fim do curso.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Imprimir ou salvar em PDF" })).toHaveCount(0);
  await page.getByRole("link", { name: "Voltar à turma" }).click();
  await expect(page).toHaveURL(/\/classes\/cg-old$/);
});

test("curso terminado no Pro: o certificado mostra a aluna, as aulas e a frequência, e imprime", { tag: "@smoke" }, async ({ page }) => {
  const pro = await makePro(page);
  await seedAcademy(page, {
    extra: (t) => {
      endedCourse(t);
      pro(t);
    },
  });
  await page.goto("/classes/cg-old");
  await page.getByRole("button", { name: "Ações de Aluna Formada", exact: true }).click();
  await page.getByRole("menuitem", { name: "Certificado", exact: true }).click();
  await expect(page).toHaveURL(/\/classes\/cg-old\/certificate\/e-1$/);

  // Conta real: o PDF sai do servidor, no mesmo modelo da folha.
  const pdf = page.getByRole("link", { name: "Baixar PDF" });
  await expect(pdf).toHaveAttribute("href", "/api/documents/certificates/e-1");
  const sheet = page.locator("main");
  await expect(sheet).toContainText("Aluna Formada");
  await expect(sheet).toContainText("Confeitaria de Verão");
  await expect(sheet).toContainText("03/08/2026");
  await expect(sheet).toContainText("20/09/2026");
  // 7 segundas entre 03/08 e 20/09; 3 presencas e 1 falta = 75%.
  await expect(sheet).toContainText("7 aulas");
  await expect(sheet).toContainText("75%");

  const response = await page.request.get("/api/documents/certificates/e-1");
  expect(response.headers()["content-type"]).toBe("application/pdf");
});

test("lista de espera do curso: promover com valor ajustado à vista gera uma parcela só", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [noPlan("c-1", "Aluno Dentro"), noPlan("c-2", "Aluna Esperando")];
      t.classGroups = [courseClass("cg-c", "Confeitaria", { capacity: 1 })];
      t.enrollments = [enrollment("e-1", "cg-c", "c-1")];
      t.waitlist = [{ id: "w-1", classGroupId: "cg-c", studentId: "c-2", position: 1, status: "waiting", createdAt: TS }];
    },
  });
  await page.goto("/classes/cg-c");
  await page.getByRole("tab", { name: /Lista de espera/ }).click();
  await page.getByRole("button", { name: "Promover" }).click();
  const dialog = page.getByRole("dialog", { name: "Matricular da lista de espera" });
  await expect(dialog.getByTestId("course-charge-line")).toContainText("Cobrança do aluno: R$ 800,00 à vista, vence hoje");
  await dialog.getByRole("button", { name: "Alterar", exact: true }).click();
  await expect(dialog.getByLabel("Valor")).toHaveValue("800,00");
  await expect(dialog.getByTestId("course-installments-summary")).toHaveText("À vista: R$ 800,00, vence 22/09.");
  await dialog.getByLabel("Valor").fill("60000");
  await expect(dialog.getByTestId("course-installments-summary")).toHaveText("À vista: R$ 600,00, vence 22/09.");
  await dialog.getByRole("button", { name: "Matricular" }).click();
  await expect(page.getByText("Aluno matriculado no curso.")).toBeVisible();
  await waitForTenant(page, (t) => t.charges.some((c: { studentId: string }) => c.studentId === "c-2"));

  await page.goto("/classes/billing?status=all&kind=course");
  const row = rowOf(page, "Aluna Esperando");
  await expect(row).toContainText("Curso Confeitaria");
  await expect(row).toContainText("R$ 600,00");
  await expect(row).toContainText("vence 22/09");
  // A vista: sem "parcela 1 de 1".
  await expect(row).not.toContainText("parcela");
});
