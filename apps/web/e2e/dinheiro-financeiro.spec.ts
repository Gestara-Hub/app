import type { Page } from "@playwright/test";
import { classGroup, enrollment, expect, seedAcademy, test } from "./fixtures";
import {
  ORG,
  TS,
  charge,
  courseClass,
  lessonPackage,
  makePro,
  menuAction,
  noPlan,
  packageClass,
  pickField,
  pickSelect,
  rowOf,
  stepMonth,
  studentPackage,
  usage,
  waitForTenant,
} from "./dinheiro-fixtures";

/**
 * Dinheiro no Financeiro e nos Relatórios (doc 15 e doc 20, fases A a D):
 * linhas agregadas por tipo, Resumo, DRE, relatórios de cursos e pacotes e o
 * "% do que os alunos pagaram" do professor. Relogio fixo em 22/09/2026.
 */

test.describe.configure({ timeout: 90_000 });

const paidAt = (day: string) => `${day}T15:00:00.000Z`;

/**
 * Setembro com todos os tipos (e uma mensalidade de agosto paga em setembro):
 * pagas R$ 150 + 40 + 100 + 200 + 500 + 150 (agosto) = R$ 1.140.
 */
function septemberMoney(t: Record<string, unknown>) {
  t.clients = ["c-1", "c-2", "c-3", "c-4", "c-5"].map((id, i) => noPlan(id, `Aluno ${i + 1}`));
  t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
  const paid = (day: string) => ({ status: "paid", method: "pix", paidVia: "manual", paidAt: paidAt(day) });
  t.charges = [
    charge("m-1", "c-1", { kind: "membership", description: undefined, dueDate: "2026-09-10", amountCents: 15000, ...paid("2026-09-10") }),
    charge("m-2", "c-2", { kind: "membership", description: undefined, dueDate: "2026-09-10", amountCents: 15000 }),
    charge("m-aug", "c-3", { kind: "membership", description: undefined, competence: "2026-08", dueDate: "2026-08-10", amountCents: 15000, ...paid("2026-09-05") }),
    charge("d-1", "c-1", { kind: "dropin", description: undefined, classGroupId: "cg-1", dueDate: "2026-09-21", amountCents: 4000, ...paid("2026-09-21") }),
    charge("x-1", "c-2", { dueDate: "2026-09-25", amountCents: 25000 }),
    charge("x-2", "c-3", { amountCents: 10000, ...paid("2026-09-12") }),
    charge("x-c", "c-4", { amountCents: 9900, status: "canceled", canceledBy: "user" }),
    charge("k-1", "c-4", { kind: "course", description: "Confeitaria", amountCents: 20000, ...paid("2026-09-15") }),
    charge("k-2", "c-5", { kind: "course", description: "Confeitaria", dueDate: "2026-09-15", amountCents: 20000 }),
    charge("p-1", "c-5", { kind: "package", description: "10 aulas", amountCents: 50000, ...paid("2026-09-01") }),
  ];
}

/** A linha do lancamento na aba Lancamentos (ListRow com aria-label = descricao). */
const entryRow = (page: Page, description: string) => page.locator(`div.group[aria-label="${description}"]`);

test("Lançamentos: uma linha por tipo de cobrança, com as contagens e o atalho para Cobranças", async ({ page }) => {
  await seedAcademy(page, { extra: septemberMoney });
  await page.goto("/finance?tab=lancamentos");

  const rows: [string, string, string, string][] = [
    ["Mensalidades de setembro", "R$ 300,00", "1 paga · 1 atrasada", "Atrasado"],
    ["Aulas avulsas de setembro", "R$ 40,00", "1 paga", "Pago"],
    ["Cobranças avulsas de setembro", "R$ 350,00", "1 paga · 1 pendente", "Pendente"],
    ["Cursos de setembro", "R$ 400,00", "1 paga · 1 atrasada", "Atrasado"],
    ["Pacotes de aulas de setembro", "R$ 500,00", "1 paga", "Pago"],
  ];
  for (const [description, amount, counts, status] of rows) {
    const row = entryRow(page, description);
    await expect(row).toContainText(amount);
    await expect(row).toContainText(counts);
    await expect(row).toContainText(status);
    await expect(row.getByRole("link", { name: "Ver em Cobranças" })).toBeVisible();
  }
  // A cobranca cancelada nao entra (a avulsa soma so R$ 350).
  await expect(page.getByText("5 lançamentos", { exact: true })).toBeVisible();

  // O atalho abre Cobranças no mes e no tipo da linha.
  await entryRow(page, "Cursos de setembro").getByRole("link", { name: "Ver em Cobranças" }).click();
  await expect(page).toHaveURL(/\/classes\/billing\?month=2026-09&kind=course$/);
  // Cobranças abre em "A receber": so a parcela atrasada; a paga aparece em "Todos os status".
  await expect(rowOf(page, "Aluno 5")).toContainText("Atrasado");
  await expect(rowOf(page, "Aluno 4")).toHaveCount(0);
  await pickSelect(page, "Filtrar por situação", /Todos os status/);
  await expect(rowOf(page, "Aluno 4")).toContainText("Curso Confeitaria");
  await expect(rowOf(page, "Aluno 5")).toContainText("Atrasado");
  await expect(page.getByText(/(^|· )2 cobranças$/)).toBeVisible();

  await page.goto("/finance?tab=lancamentos");
  await entryRow(page, "Pacotes de aulas de setembro").getByRole("link", { name: "Ver em Cobranças" }).click();
  await expect(page).toHaveURL(/kind=package/);
  // O pacote esta pago: fora de "A receber".
  await pickSelect(page, "Filtrar por situação", /Todos os status/);
  await expect(rowOf(page, "Aluno 5")).toContainText("Pacote 10 aulas");

  // As categorias automaticas nao aparecem no gerenciador de categorias de entrada.
  await page.goto("/finance?tab=lancamentos");
  await page.getByRole("button", { name: "Novo lançamento" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Novo lançamento" });
  await dialog.getByRole("radio", { name: /Entrada/ }).click();
  await dialog.getByRole("button", { name: "+ Gerenciar categorias" }).click();
  await expect(page.getByRole("dialog", { name: "Categorias de entrada" })).toContainText(
    "Mensalidades, Aulas avulsas, Cobranças avulsas, Cursos e Pacotes de aulas são automáticas",
  );
});

test("Resumo: o que entrou no mês soma todos os tipos pelo dia do pagamento", async ({ page }) => {
  await seedAcademy(page, { extra: septemberMoney });
  await page.goto("/finance");
  const card = (title: string) => page.locator("div.rounded-2xl").filter({ has: page.getByText(title, { exact: true }) });
  await expect(card("Entrou")).toContainText("R$ 1.140,00");
  await expect(card("Saldo do mês")).toContainText("R$ 1.140,00");
});

test.describe("DRE (Pro)", () => {
  test("uma linha por origem no mês do pagamento e o vazio do mês sem recebimento", async ({ page }) => {
    const pro = await makePro(page);
    await seedAcademy(page, {
      extra: (t) => {
        septemberMoney(t);
        pro(t);
        t.financialEntries = [
          {
            id: "fe-luz",
            organizationId: ORG,
            unitId: "unit-academia-x",
            type: "expense",
            categoryId: `fcat-${ORG}-utilities`,
            description: "Conta de luz",
            amountCents: 14000,
            dueDate: "2026-09-10",
            status: "paid",
            paidAt: paidAt("2026-09-10"),
            method: "pix",
            createdAt: TS,
            updatedAt: TS,
          },
        ];
      },
    });
    await page.goto("/reports?type=financial_income_statement&period=2026-09");
    const doc = page.locator("main");
    await expect(doc).toContainText("DRE do mês");
    // A mensalidade de agosto paga em setembro entra em setembro (e so nele).
    for (const [line, amount] of [
      ["Mensalidades de Alunos", "R$ 300,00"],
      ["Aulas Avulsas", "R$ 40,00"],
      ["Cobranças Avulsas", "R$ 100,00"],
      ["Cursos", "R$ 200,00"],
      ["Pacotes de aulas", "R$ 500,00"],
    ]) {
      await expect(doc.locator("tbody tr").filter({ hasText: line }).first()).toContainText(amount);
    }
    const field = (label: string) => doc.locator("dl > div").filter({ has: page.getByText(label, { exact: true }) });
    await expect(field("Receita bruta")).toContainText("R$ 1.140,00");
    await expect(field("Despesas operacionais")).toContainText("R$ 140,00");
    await expect(field("Resultado operacional")).toContainText("R$ 1.000,00");

    // CSV com as receitas detalhadas.
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Exportar CSV" }).click()]);
    const csv = await readDownload(download);
    expect(csv).toContain('"Receitas por origem"');
    expect(csv).toContain('"Categoria";"%";"Valor"');
    expect(csv).toMatch(/"Cursos";"[^"]*";"200,00"/);
    expect(csv).toMatch(/"Pacotes de aulas";"[^"]*";"500,00"/);

    // Agosto: a mensalidade de agosto foi paga em setembro, entao agosto fica vazio.
    await page.goto("/reports?type=financial_income_statement&period=2026-08");
    await expect(page.getByText("Sem recebimentos nem despesas pagas neste mês.")).toBeVisible();
  });

  test("no grátis, o DRE fica travado no Plano Profissional", async ({ page }) => {
    await seedAcademy(page);
    await page.goto("/reports?type=financial_income_statement&period=2026-09");
    await expect(page.getByText("Relatórios Gerenciais Avançados")).toBeVisible();
    await expect(page.getByText("(+) RECEITA BRUTA OPERACIONAL")).toHaveCount(0);
  });
});

/** Texto do arquivo baixado. */
async function readDownload(download: import("@playwright/test").Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

test.describe("relatórios", () => {
  test("Cursos: números do curso, recebido no mês, CSV e mês vazio", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        t.clients = [noPlan("c-1", "Aluna Fica"), noPlan("c-2", "Aluno Saiu")];
        t.classGroups = [courseClass("cg-c", "Confeitaria", { startDate: "2026-08-03" })];
        t.enrollments = [
          { ...enrollment("e-1", "cg-c", "c-1") },
          { ...enrollment("e-2", "cg-c", "c-2"), status: "canceled", canceledAt: "2026-09-02T12:00:00.000Z" },
        ];
        const k = (id: string, studentId: string, enrollmentId: string, month: string, over: Record<string, unknown> = {}) =>
          charge(id, studentId, {
            kind: "course",
            classGroupId: "cg-c",
            enrollmentId,
            description: "Confeitaria",
            competence: month,
            dueDate: `${month}-15`,
            amountCents: 20000,
            ...over,
          });
        const paid = (day: string) => ({ status: "paid", method: "pix", paidVia: "manual", paidAt: paidAt(day) });
        t.charges = [
          k("k-1", "c-1", "e-1", "2026-08", paid("2026-08-15")),
          k("k-2", "c-1", "e-1", "2026-09", paid("2026-09-15")),
          k("k-3", "c-1", "e-1", "2026-10"),
          k("k-4", "c-1", "e-1", "2026-11"),
          k("k-5", "c-2", "e-2", "2026-08", paid("2026-08-15")),
          k("k-6", "c-2", "e-2", "2026-09", { status: "canceled", canceledBy: "system", notes: "Matrícula cancelada" }),
        ];
      },
    });
    await page.goto("/reports?type=course_summary&period=2026-09");
    const doc = page.locator("main");
    await expect(doc.getByRole("heading", { name: "Cursos" })).toBeVisible();
    const kpi = (label: string) => doc.locator("div.rounded-lg").filter({ has: page.getByText(label, { exact: true }) }).first();
    await expect(kpi("Contratado")).toContainText("R$ 1.000,00");
    await expect(kpi("Recebido")).toContainText("R$ 600,00");
    await expect(kpi("Em aberto")).toContainText("R$ 400,00");
    await expect(kpi("Recebido no mês")).toContainText("R$ 200,00");
    const row = doc.locator("tbody tr").filter({ hasText: "Confeitaria" });
    await expect(row).toContainText("Carlos Silva");
    await expect(row.locator("td").nth(2)).toHaveText("03/08/2026");
    await expect(row.locator("td").nth(3)).toHaveText("30/11/2026");
    await expect(row.locator("td").nth(4)).toHaveText("1");
    await expect(row.locator("td").nth(5)).toHaveText("0");
    await expect(row.locator("td").nth(6)).toHaveText("1");

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Exportar CSV" }).click()]);
    expect(download.suggestedFilename()).toBe("relatorio-cursos-2026-09.csv");
    const csv = await readDownload(download);
    expect(csv).toContain('"Curso";"Professor";"Início";"Fim";"Matriculados";"Concluídos";"Cancelados";"Contratado";"Recebido";"Em aberto"');
    expect(csv).toContain('"Confeitaria";"Carlos Silva";"03/08/2026";"30/11/2026";"1";"0";"1";"1000,00";"600,00";"400,00"');

    // Dezembro: o curso acabou em novembro e nao ha parcela.
    await page.goto("/reports?type=course_summary&period=2026-12");
    await expect(page.getByText("Nenhum curso com aulas ou parcelas neste mês.")).toBeVisible();
  });

  test("Pacotes de aulas: vendidos, aulas usadas, saldo, recebido e CSV; sem pacotes, vazio", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        t.clients = [noPlan("c-1", "Aluna Nova"), noPlan("c-2", "Aluno Antigo")];
        t.classGroups = [packageClass("cg-p", "Jiu-Jitsu Pacote")];
        t.lessonPackages = [lessonPackage("lp-10", "10 aulas")];
        t.studentPackages = [
          studentPackage("sp-1", "c-1", "lp-10", {
            purchasedAt: "2026-09-05",
            lessonsUsed: 2,
            usages: [usage("cg-p", "2026-09-14"), usage("cg-p", "2026-09-15")],
            chargeIds: ["pk-1"],
          }),
          studentPackage("sp-2", "c-2", "lp-10", {
            purchasedAt: "2026-08-03",
            lessonsUsed: 8,
            usages: ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-17", "2026-09-01"].map((d) =>
              usage("cg-p", d),
            ),
            chargeIds: ["pk-2"],
          }),
        ];
        t.charges = [
          charge("pk-1", "c-1", { kind: "package", description: "10 aulas", studentPackageId: "sp-1", amountCents: 50000, status: "paid", method: "pix", paidVia: "manual", paidAt: paidAt("2026-09-05") }),
          charge("pk-2", "c-2", { kind: "package", description: "10 aulas", studentPackageId: "sp-2", competence: "2026-08", dueDate: "2026-08-03", amountCents: 50000, status: "paid", method: "pix", paidVia: "manual", paidAt: paidAt("2026-08-03") }),
        ];
      },
    });
    await page.goto("/reports?type=package_summary&period=2026-09");
    const doc = page.locator("main");
    const kpi = (label: string) => doc.locator("div.rounded-lg").filter({ has: page.getByText(label, { exact: true }) }).first();
    await expect(kpi("Vendidos")).toContainText("1");
    await expect(kpi("Aulas usadas")).toContainText("3");
    await expect(kpi("Saldo de aulas")).toContainText("10");
    await expect(kpi("Recebido")).toContainText("R$ 500,00");
    const row = doc.locator("tbody tr").filter({ hasText: "10 aulas" });
    await expect(row.locator("td")).toHaveText(["10 aulas", "1", "10", "3", "10", "R$ 500,00"]);

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Exportar CSV" }).click()]);
    const csv = await readDownload(download);
    expect(csv).toContain('"Pacote";"Vendidos";"Aulas vendidas";"Aulas usadas";"Saldo de aulas";"Recebido"');
    expect(csv).toContain('"10 aulas";"1";"10";"3";"10";"500,00"');

    // Agosto: a venda antiga, 7 aulas e o recebido de agosto.
    await page.goto("/reports?type=package_summary&period=2026-08");
    await expect(doc.locator("tbody tr").filter({ hasText: "10 aulas" }).locator("td")).toHaveText(["10 aulas", "1", "10", "7", "10", "R$ 500,00"]);
  });

  test("Pacotes de aulas sem nenhum pacote: o vazio", async ({ page }) => {
    await seedAcademy(page);
    await page.goto("/reports?type=package_summary&period=2026-09");
    await expect(page.getByText("Nenhum pacote vendido, usado ou pago neste mês.")).toBeVisible();
  });
});

/**
 * Agosto (mes fechado) do Carlos Silva, titular da turma de mensalidade, do
 * curso e da turma de pacote; Bruna Costa substituiu uma aula de pacote:
 * - mensalidade paga de R$ 150 (aluno da turma de mensalidade);
 * - parcela paga de R$ 200 do curso;
 * - pacote pago de R$ 500 / 10 aulas: 2 aulas com o Carlos e 1 com a Bruna;
 * - pacote de R$ 300 ainda em aberto: 1 aula com o Carlos (so conta depois de pago).
 */
function augustTeacherPay(t: Record<string, unknown>) {
  (t.professionals as unknown[]).push({
    id: "pr-2",
    organizationId: ORG,
    unitId: "unit-academia-x",
    name: "Bruna Costa",
    modalityIds: ["m-jj"],
    serviceIds: [],
    workingHours: [],
    status: "active",
    createdAt: TS,
    updatedAt: TS,
  });
  t.clients = [noPlan("c-m", "Aluno Mensal"), noPlan("c-c", "Aluna Curso"), noPlan("c-p", "Aluno Pacote"), noPlan("c-q", "Aluna Devendo")];
  t.classGroups = [
    classGroup("cg-jj", "Jiu-Jitsu Adulto", { startDate: "2026-07-01" }),
    courseClass("cg-c", "Confeitaria", { startDate: "2026-07-01" }),
    packageClass("cg-p", "Jiu-Jitsu Pacote", { startDate: "2026-07-01" }),
  ];
  const july = "2026-07-01T12:00:00.000Z";
  t.enrollments = [
    { ...enrollment("e-m", "cg-jj", "c-m"), enrolledAt: july },
    { ...enrollment("e-c", "cg-c", "c-c"), enrolledAt: july },
  ];
  const paid = { status: "paid", method: "pix", paidVia: "manual", paidAt: paidAt("2026-08-10") };
  t.charges = [
    charge("m-1", "c-m", { kind: "membership", description: undefined, classGroupId: "cg-jj", competence: "2026-08", dueDate: "2026-08-10", periodStart: "2026-08-01", periodEnd: "2026-08-31", amountCents: 15000, ...paid }),
    charge("k-1", "c-c", { kind: "course", classGroupId: "cg-c", enrollmentId: "e-c", description: "Confeitaria", competence: "2026-08", dueDate: "2026-08-10", amountCents: 20000, ...paid }),
    charge("pk-1", "c-p", { kind: "package", description: "10 aulas", studentPackageId: "sp-1", competence: "2026-08", dueDate: "2026-08-01", amountCents: 50000, ...paid }),
    charge("pk-2", "c-q", { kind: "package", description: "10 aulas", studentPackageId: "sp-2", competence: "2026-08", dueDate: "2026-08-01", amountCents: 30000 }),
  ];
  t.lessonPackages = [lessonPackage("lp-10", "10 aulas")];
  t.studentPackages = [
    studentPackage("sp-1", "c-p", "lp-10", {
      purchasedAt: "2026-08-01",
      lessonsUsed: 3,
      chargeIds: ["pk-1"],
      usages: [usage("cg-p", "2026-08-03"), usage("cg-p", "2026-08-04"), usage("cg-p", "2026-08-05")],
    }),
    studentPackage("sp-2", "c-q", "lp-10", {
      purchasedAt: "2026-08-01",
      lessonsUsed: 1,
      chargeIds: ["pk-2"],
      usages: [usage("cg-p", "2026-08-10")],
    }),
  ];
  t.sessionOverrides = [{ sessionId: "cg-p~2026-08-05~17:00", instructorId: "pr-2", createdAt: TS, updatedAt: TS }];
  t.teacherPayRules = [
    {
      id: "rule-bruna",
      organizationId: ORG,
      professionalId: "pr-2",
      components: [{ kind: "percent_of_memberships", percent: 50 }],
      paymentDay: 5,
      startCompetence: "2026-08",
      status: "active",
      createdAt: TS,
      updatedAt: TS,
    },
  ];
}

test("professor com \"% do que os alunos pagaram\": uma linha por origem, substituto, mês fechado congelado, reabrir, pagar e desfazer", async ({
  page,
}) => {
  await seedAcademy(page, { extra: augustTeacherPay });
  await page.goto("/finance?tab=professores&month=2026-08");

  // Bruna (substituta) recebe a aula de pacote que deu.
  const bruna = page.getByRole("button", { name: "Ver pagamento de Bruna Costa" });
  await expect(bruna).toContainText("R$ 25,00");

  // Regra do Carlos pela tela: 30% do que os alunos pagaram.
  await page.getByRole("button", { name: "Configurar pagamento" }).click();
  const rule = page.getByRole("dialog", { name: "Configurar pagamento" });
  await pickField(page, rule, "Tipo", "% do que os alunos pagaram");
  await expect(rule).toContainText("Mensalidades e cursos das turmas dele e aulas de pacote dadas. Avulsas não entram.");
  await rule.getByLabel("Porcentagem").fill("30");
  await rule.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByText("Pagamento configurado.")).toBeVisible();

  const carlos = page.getByRole("button", { name: "Ver pagamento de Carlos Silva" });
  await expect(carlos).toContainText("R$ 135,00");
  await carlos.click();
  const detail = page.getByRole("dialog").filter({ hasText: "Carlos Silva" });
  await expect(detail).toContainText("30% de R$ 150,00 em mensalidades");
  await expect(detail).toContainText("Mensalidades pagas dos alunos das turmas dele");
  await expect(detail).toContainText("30% de R$ 200,00 em cursos");
  await expect(detail).toContainText("Parcelas pagas dos cursos dele");
  // So o pacote pago conta; a aula da Bruna fica com ela.
  await expect(detail).toContainText("30% de R$ 100,00 em pacotes (2 aulas)");
  await expect(detail).toContainText("Aulas de pacote pago que ele deu, pelo valor da aula");

  await detail.getByRole("button", { name: "Fechar mês" }).click();
  const close = page.getByRole("alertdialog", { name: "Fechar Agosto de 2026?" });
  await expect(close).toContainText("fica congelado em R$ 135,00");
  await close.getByRole("button", { name: "Fechar mês" }).click();
  await expect(page.getByText("Mês fechado.")).toBeVisible();
  await detail.getByRole("button", { name: "Fechar", exact: true }).click();
  await waitForTenant(page, (t) => (t.teacherPayouts ?? []).some((p: { status: string }) => p.status === "closed"));

  // O pacote em aberto e quitado depois do fechamento.
  await page.goto("/classes/billing?status=all&kind=package");
  await stepMonth(page, "prev", "2026-08");
  await menuAction(page, "Aluna Devendo", "Marcar pago");
  const pay = page.getByRole("dialog", { name: "Registrar pagamento" });
  await pay.getByRole("radio", { name: "Dinheiro" }).click();
  await pay.getByRole("button", { name: "Registrar pagamento" }).click();
  await expect(page.getByText("Pagamento registrado (Dinheiro).")).toBeVisible();
  await waitForTenant(page, (t) => t.charges.find((c: { id: string }) => c.id === "pk-2")?.status === "paid");

  // Fechado nao muda; reabrir recalcula com a aula do pacote agora pago (R$ 30).
  await page.goto("/finance?tab=professores&month=2026-08");
  await expect(carlos).toContainText("Fechado");
  await expect(carlos).toContainText("R$ 135,00");
  await carlos.click();
  await detail.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: "Reabrir mês" }).click();
  await page.getByRole("alertdialog", { name: "Reabrir Agosto de 2026?" }).getByRole("button", { name: "Reabrir mês" }).click();
  await expect(page.getByText("Mês reaberto.")).toBeVisible();
  await expect(detail).toContainText("30% de R$ 130,00 em pacotes (3 aulas)");
  await expect(detail).toContainText("R$ 144,00");

  // Fechar de novo, pagar via Pix e desfazer.
  await detail.getByRole("button", { name: "Fechar mês" }).click();
  await page.getByRole("alertdialog", { name: "Fechar Agosto de 2026?" }).getByRole("button", { name: "Fechar mês" }).click();
  await expect(page.getByText("Mês fechado.")).toBeVisible();
  await detail.getByRole("button", { name: "Pagar" }).click();
  const payout = page.getByRole("dialog", { name: "Registrar pagamento" });
  await payout.getByRole("radio", { name: "Pix" }).click();
  await payout.getByRole("button", { name: "Registrar pagamento" }).click();
  await expect(page.getByText("Pagamento registrado (Pix).")).toBeVisible();
  await expect(detail).toContainText("Valor pago");
  await detail.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: "Desfazer pagamento" }).click();
  await page.getByRole("alertdialog", { name: "Desfazer pagamento?" }).getByRole("button", { name: "Desfazer pagamento" }).click();
  await expect(page.getByText("Pagamento desfeito.")).toBeVisible();
  await expect(detail).toContainText("Valor a pagar");
  await detail.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(carlos).toContainText("Fechado");
  await expect(carlos).toContainText("R$ 144,00");
});
