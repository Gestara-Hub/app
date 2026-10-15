import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { classGroup, enrollment, expect, seedAcademy, student, test } from "./fixtures";
import { loginAsUser, user } from "./ficha-notas-fixtures";
import { TS, type Tenant } from "./geral-fixtures";

/**
 * Relatorios (/reports): catalogo gratis x Pro, cada relatorio com dados do
 * mundo e com mes vazio, exportar CSV, layout de impressao e quem pode
 * exportar. So dados reais (sem numeros inventados). Hoje e 22/09/2026.
 */

const ORG = "org-academia-x";
const UNIT = "unit-academia-x";
const ATTENDANT = user("usr-att", "Bia Recepção", "attendant");

const main = (page: Page) => page.getByRole("main");

function charge(id: string, studentId: string, over: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: ORG,
    unitId: UNIT,
    studentId,
    kind: "extra",
    description: "Kimono",
    competence: "2026-09",
    dueDate: "2026-09-25",
    amountCents: 25000,
    status: "pending",
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

const jjProgress = (levelName: string) => ({
  "m-jj": {
    modalityId: "m-jj",
    modalityName: "Jiu-Jitsu",
    levelId: `lvl-${levelName}`,
    levelName,
    subLevel: 0,
    maxSubLevels: 4,
    promotedAt: "2026-03-01",
    strengths: [],
    goals: [],
    evaluations: [],
    promotionHistory: [],
    updatedAt: TS,
  },
});

/**
 * Academia com dados para todos os relatorios:
 * - Aluno A20 (faixa Azul, mensal, faz aniversario 25/09, presente em 21/09);
 * - Bruna Lima (sem plano, aniversario 03/09, faltou), observacao que nao e faixa;
 * - Aluno Inativo (inativado; o cadastro ainda diz membershipStatus "active");
 * - cobrancas: kimono pago (R$ 250), kimono cancelado (fora), avulsa de R$ 40
 *   vencida em 15/09 (atrasada);
 * - curso "Confeitaria" com 1 matricula e parcela paga; pacote "10 aulas" vendido.
 */
async function seedReports(page: Page, opts: { pro?: boolean; extra?: (t: Tenant) => void } = {}) {
  await seedAcademy(page, {
    extra: (t) => {
      if (opts.pro) t.organization.subscription = { tier: "pro" };
      t.clients = [
        student("c-a", "Aluno A20", { birthDate: "1990-09-25", progressions: jjProgress("Faixa Azul") }),
        student("c-b", "Bruna Lima", { birthDate: "1995-09-03", planId: undefined, notes: "Alergia a amendoim" }),
        student("c-x", "Aluno Inativo", { status: "inactive", planId: undefined, birthDate: "1980-09-10" }),
      ];
      t.classGroups = [
        classGroup("cg-1", "Jiu-Jitsu Adulto"),
        classGroup("cg-c", "Confeitaria", {
          allowDropin: false,
          sessionPriceCents: undefined,
          meetingSlots: [{ weekday: 1, start: "19:00", end: "21:00" }],
          billingMode: "course",
          coursePriceCents: 80000,
          courseMaxInstallments: 1,
          startDate: "2026-09-07",
          endDate: "2026-11-30",
        }),
      ];
      t.enrollments = [
        enrollment("e-1", "cg-1", "c-a"),
        enrollment("e-2", "cg-1", "c-b"),
        { ...enrollment("e-3", "cg-c", "c-b"), course: { priceCents: 80000, installments: 1 } },
      ];
      t.attendances = [
        { id: "at-1", sessionId: "cg-1~2026-09-21~17:00", studentId: "c-a", status: "present", markedAt: "2026-09-21T20:00:00.000Z" },
        { id: "at-2", sessionId: "cg-1~2026-09-21~17:00", studentId: "c-b", status: "absent", markedAt: "2026-09-21T20:00:00.000Z" },
      ];
      t.charges = [
        charge("ch-paid", "c-b", { status: "paid", paidAt: "2026-09-15T15:00:00.000Z", method: "pix" }),
        charge("ch-canceled", "c-b", { description: "Faixa", status: "canceled", amountCents: 9900 }),
        charge("ch-late", "c-b", { kind: "dropin", description: undefined, dueDate: "2026-09-15", amountCents: 4000 }),
        charge("ch-course", "c-b", {
          kind: "course",
          description: "Confeitaria",
          classGroupId: "cg-c",
          enrollmentId: "e-3",
          dueDate: "2026-09-07",
          amountCents: 80000,
          status: "paid",
          paidAt: "2026-09-07T15:00:00.000Z",
          method: "cash",
        }),
      ];
      t.lessonPackages = [
        { id: "lp-10", organizationId: ORG, name: "10 aulas", lessons: 10, priceCents: 50000, modalityIds: [], absenceConsumes: true, status: "active", createdAt: TS, updatedAt: TS },
      ];
      t.studentPackages = [
        {
          id: "sp-1",
          organizationId: ORG,
          unitId: UNIT,
          studentId: "c-a",
          packageId: "lp-10",
          name: "10 aulas",
          lessonsTotal: 10,
          lessonsUsed: 1,
          purchasedAt: "2026-09-01",
          modalityIds: [],
          absenceConsumes: true,
          status: "active",
          chargeIds: [],
          usages: [{ sessionId: "cg-1~2026-09-21~17:00", classGroupId: "cg-1", date: "2026-09-21", reason: "present" }],
          createdAt: TS,
          updatedAt: TS,
        },
      ];
      opts.extra?.(t);
    },
  });
}

async function openReport(page: Page, type: string, period = "2026-09") {
  await page.goto(`/reports?type=${type}&period=${period}`);
  await expect(page.getByRole("button", { name: "Voltar aos Relatórios" })).toBeVisible();
}

/** Clica em exportar e devolve o nome e o conteudo do CSV baixado. */
async function exportCsv(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar CSV / Excel" }).click(),
  ]);
  const file = await download.path();
  const text = await readFile(file, "utf8");
  await expect(page.getByText("Arquivo CSV exportado com sucesso.")).toBeVisible();
  return { name: download.suggestedFilename(), text };
}

test.describe("catálogo", () => {
  test("grátis: 8 relatórios, os de gestão travados no Pro", async ({ page }) => {
    await seedReports(page);
    await page.goto("/reports");
    await expect(page.getByRole("heading", { level: 1, name: "Relatórios" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Todos os Relatórios (8)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Visualizar & Exportar" })).toHaveCount(6);
    await expect(page.getByRole("button", { name: "Disponível no Plano Pro" })).toHaveCount(2);
    // Sem palavra em ingles no filtro.
    await expect(page.getByRole("button", { name: "Operacionais (Grátis)" })).toBeVisible();

    await page.getByRole("button", { name: "Financeiros (DRE)" }).click();
    await expect(main(page).getByText("DRE Gerencial Completa", { exact: true })).toBeVisible();
    await expect(main(page).getByText("Aniversariantes do Mês")).toHaveCount(0);
    await page.getByRole("button", { name: "Todos os Relatórios (8)" }).click();
    await page.getByPlaceholder("Buscar relatórios por nome...").fill("aniver");
    await expect(page.getByRole("button", { name: "Visualizar & Exportar" })).toHaveCount(1);

    // Pro travado: abre o convite e volta.
    await page.getByPlaceholder("Buscar relatórios por nome...").fill("churn");
    await page.getByRole("button", { name: "Disponível no Plano Pro" }).click();
    await expect(page.getByText("Relatórios Gerenciais Avançados")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver Plano Pro" })).toHaveAttribute("href", /\/settings\?tab=plano/);
    await page.getByRole("button", { name: "← Voltar ao Catálogo de Relatórios" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Relatórios" })).toBeVisible();
  });

  test("Pro libera todos e abre o relatório escolhido no catálogo", async ({ page }) => {
    await seedReports(page, { pro: true });
    await page.goto("/reports");
    await expect(page.getByRole("button", { name: "Visualizar & Exportar" })).toHaveCount(8);
    await expect(page.getByRole("button", { name: "Disponível no Plano Pro" })).toHaveCount(0);
    await page.locator("div[data-slot=card]").filter({ hasText: "Aniversariantes do Mês" }).getByRole("button").click();
    await expect(main(page)).toContainText("Aniversariantes do Mês (Setembro)");
    await page.getByRole("button", { name: "Voltar aos Relatórios" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Relatórios" })).toBeVisible();
  });

  test("Pro direto pela URL no grátis mostra o convite", async ({ page }) => {
    await seedReports(page);
    await page.goto("/reports?type=financial_income_statement&period=2026-09");
    await expect(page.getByText("Relatórios Gerenciais Avançados")).toBeVisible();
  });
});

test.describe("relatórios operacionais", () => {
  test("lista de presença da turma: presença do mês e faixa salva", async ({ page }) => {
    await seedReports(page);
    await openReport(page, "attendance_sheet");
    const sheet = main(page);
    await expect(sheet).toContainText("Jiu-Jitsu Adulto • Jiu-Jitsu (Carlos Silva)");
    await expect(sheet).toContainText("1 Presentes");
    await expect(sheet).toContainText("1 Ausentes");
    await expect(sheet).toContainText("50% Ocupação");
    const rows = sheet.locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: "Aluno A20" })).toContainText("Faixa Azul");
    await expect(rows.filter({ hasText: "Aluno A20" })).toContainText("Presente");
    // Observacao do aluno nao vira faixa; sem horario de chegada inventado.
    await expect(rows.filter({ hasText: "Bruna Lima" })).not.toContainText("Alergia");
    await expect(rows.filter({ hasText: "Bruna Lima" })).toContainText("Ausente");
    await expect(sheet).not.toContainText("07:05");
    // Aluno de fora da turma nao aparece.
    await expect(sheet).not.toContainText("Aluno Inativo");

    const csv = await exportCsv(page);
    expect(csv.name).toBe("relatorio-attendance_sheet-Competência_09_2026.csv");
    expect(csv.text).toContain("Turma;Jiu-Jitsu Adulto");
    expect(csv.text).toContain('"Aluno A20";"Faixa Azul";"Presente";""');
  });

  test("lista de presença sem turma não inventa nomes", async ({ page }) => {
    await seedReports(page, { extra: (t) => ((t.classGroups = []), (t.enrollments = [])) });
    await openReport(page, "attendance_sheet");
    await expect(main(page)).toContainText("Nenhuma turma cadastrada");
    await expect(main(page)).toContainText("Nenhum aluno registrado ou matriculado nesta turma");
    await expect(main(page)).not.toContainText("Prof. Titular");
  });

  test("relação de alunos: inativo aparece como inativo", async ({ page }) => {
    await seedReports(page);
    await openReport(page, "students_roster");
    const sheet = main(page);
    await expect(sheet).toContainText("2 Ativos");
    await expect(sheet).toContainText("1 Inativos");
    await expect(sheet.locator("tbody tr").filter({ hasText: "Aluno Inativo" })).toContainText("Inativo");
    await expect(sheet.locator("tbody tr").filter({ hasText: "Aluno A20" })).toContainText("Mensal Jiu-Jitsu");
    await expect(sheet.locator("tbody tr").filter({ hasText: "Aluno A20" })).toContainText("Faixa Azul");
    await expect(sheet).not.toContainText("Alergia");
    const csv = await exportCsv(page);
    expect(csv.text.split("\n")[0]).toContain("Aluno;Telefone;Plano;Vencimento;Status");
    expect(csv.text).toContain('"Aluno Inativo"');
  });

  test("extrato: mensalidade do mês nasce sozinha, atraso derivado e cancelada fora", async ({ page }) => {
    await seedReports(page);
    await openReport(page, "billing_statement");
    const sheet = main(page);
    const rows = sheet.locator("tbody tr");
    // Kimono pago, aula avulsa atrasada e a mensalidade proporcional do Aluno A20
    // (R$ 55, vence 20/09) gerada na leitura; o kimono cancelado fica de fora.
    await expect(rows).toHaveCount(4);
    await expect(sheet).not.toContainText("R$ 99,00");
    await expect(rows.filter({ hasText: "Aluno A20" })).toContainText("R$ 55,00");
    await expect(sheet.getByText("Recebido", { exact: true }).locator("..")).toContainText("R$ 1.050,00");
    await expect(sheet.getByText("Inadimplência", { exact: true }).locator("..")).toContainText("R$ 95,00");
    const csv = await exportCsv(page);
    expect(csv.text).toContain("Aluno;Vencimento;Valor;Status;Data Pagamento;Forma");
    expect(csv.text).toContain('"Bruna Lima";"2026-09-15";"40.00";"overdue"');
  });

  test("extrato de um mês sem cobranças", async ({ page }) => {
    await seedReports(page);
    await openReport(page, "billing_statement", "2026-11");
    await expect(main(page)).toContainText("Competência 11/2026");
    await expect(main(page)).toContainText("Nenhuma cobrança registrada nesta competência.");
  });

  test("aniversariantes do mês, só ativos, e mês sem nenhum", async ({ page }) => {
    await seedReports(page);
    await openReport(page, "monthly_birthdays");
    const sheet = main(page);
    await expect(sheet).toContainText("2 Aniversariantes");
    await expect(sheet.locator("tbody tr").first()).toContainText("Bruna Lima");
    await expect(sheet.locator("tbody tr").last()).toContainText("Aluno A20");
    await expect(sheet).not.toContainText("Aluno Inativo");
    const csv = await exportCsv(page);
    expect(csv.text).toContain('"25";"Aluno A20"');

    await openReport(page, "monthly_birthdays", "2026-11");
    await expect(main(page)).toContainText("Aniversariantes do Mês (Novembro)");
    await expect(main(page)).toContainText("0 Aniversariantes");
  });

  test("cursos e pacotes com dados e mês vazio", async ({ page }) => {
    await seedReports(page);
    await openReport(page, "course_summary");
    const course = main(page).locator("tbody tr").filter({ hasText: "Confeitaria" });
    await expect(course).toContainText("R$ 800,00");
    await expect(main(page).getByText("Recebido no mês", { exact: true }).locator("..")).toContainText("R$ 800,00");
    const csv = await exportCsv(page);
    expect(csv.text).toContain('"Confeitaria";"Carlos Silva"');

    await openReport(page, "package_summary");
    const pkg = main(page).locator("tbody tr").filter({ hasText: "10 aulas" });
    await expect(pkg).toBeVisible();
    await expect(main(page).locator("span", { hasText: /^Aulas usadas$/ }).locator("..")).toContainText("1");
    await expect(main(page).locator("span", { hasText: /^Saldo de aulas$/ }).locator("..")).toContainText("9");

    await openReport(page, "course_summary", "2026-06");
    await expect(main(page)).toContainText("Nenhum curso com aulas ou parcelas neste mês.");
    await openReport(page, "package_summary", "2026-06");
    // O saldo de hoje vale para qualquer mes; sem vendas nem uso em junho.
    await expect(main(page).locator("span", { hasText: /^Vendidos$/ }).locator("..")).toContainText("0");
  });

  test("trocar o mês no catálogo vale para o relatório aberto", async ({ page }) => {
    await seedReports(page);
    await page.goto("/reports");
    await page.locator("input[type=month]").fill("2026-11");
    await page.locator("div[data-slot=card]").filter({ hasText: "Aniversariantes do Mês" }).getByRole("button").click();
    await expect(main(page)).toContainText("Aniversariantes do Mês (Novembro)");
    await expect(main(page)).toContainText("Competência 11/2026");
  });
});

test.describe("relatórios Pro", () => {
  test("DRE com cada tipo de recebimento e mês vazio", async ({ page }) => {
    await seedReports(page, { pro: true });
    await openReport(page, "financial_income_statement");
    const sheet = main(page);
    await expect(sheet).toContainText("Cobranças Avulsas");
    await expect(sheet).toContainText("Cursos");
    await expect(sheet).toContainText("R$ 1.050,00");
    const csv = await exportCsv(page);
    expect(csv.text).toContain("Receita Bruta;1050.00");

    await openReport(page, "financial_income_statement", "2026-06");
    await expect(main(page)).toContainText("Sem recebimentos nem despesas pagas neste mês.");
  });

  test("churn e retenção só com dados reais, por turma", async ({ page }) => {
    await seedReports(page, {
      pro: true,
      extra: (t) => {
        t.enrollments.push({ ...enrollment("e-4", "cg-1", "c-x"), status: "canceled" });
      },
    });
    await openReport(page, "churn_retention");
    const sheet = main(page);
    await expect(sheet).toContainText("Cancelamentos");
    const jj = sheet.locator("tbody tr").filter({ hasText: "Jiu-Jitsu Adulto" });
    // 2 ativos e 1 matricula cancelada: 33,3% de churn na turma.
    await expect(jj).toContainText("2");
    await expect(jj).toContainText("33.3%");
    await expect(sheet.getByRole("columnheader", { name: "Turma" })).toBeVisible();
    const csv = await exportCsv(page);
    expect(csv.text).toContain("Análise de Churn e Retenção");
  });

  test("churn de espaço sem alunos sai zerado", async ({ page }) => {
    await seedReports(page, {
      pro: true,
      extra: (t) => {
        t.clients = [];
        t.classGroups = [];
        t.enrollments = [];
      },
    });
    await openReport(page, "churn_retention");
    const sheet = main(page);
    await expect(sheet.getByText("Alunos Início", { exact: true }).locator("..")).toContainText("0");
    await expect(sheet).not.toContainText("118");
    await expect(sheet).not.toContainText("No-Gi");
    await expect(sheet.locator("tbody tr")).toHaveCount(0);
  });
});

test.describe("imprimir e permissões", () => {
  test("layout de impressão esconde a barra e mostra a assinatura", async ({ page }) => {
    await seedReports(page);
    await openReport(page, "students_roster");
    await page.evaluate(() => {
      (window as unknown as { printed: number }).printed = 0;
      window.print = () => {
        (window as unknown as { printed: number }).printed += 1;
      };
    });
    await page.getByRole("button", { name: "Imprimir / Salvar em PDF" }).click();
    expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);

    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Exportar CSV / Excel" })).toBeHidden();
    await expect(page.getByText("Assinatura do Responsável")).toBeVisible();
    await page.emulateMedia({ media: "screen" });
    await expect(page.getByText("Assinatura do Responsável")).toBeHidden();
  });

  test("atendente vê os relatórios mas não exporta", async ({ page }) => {
    await seedReports(page, { extra: (t) => t.users.push(ATTENDANT) });
    await loginAsUser(page, ATTENDANT);
    await openReport(page, "students_roster");
    await expect(main(page)).toContainText("Relação Geral de Alunos");
    await expect(page.getByRole("button", { name: "Exportar CSV / Excel" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Imprimir / Salvar em PDF" })).toHaveCount(0);
  });

});
