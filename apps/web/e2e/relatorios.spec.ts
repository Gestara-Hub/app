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
  await expect(page.getByRole("button", { name: "Voltar", exact: true })).toBeVisible();
}

/** Clica em exportar (CSV gerado no servidor) e devolve o nome e o conteudo baixado. */
async function exportCsv(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Exportar CSV" }).click(),
  ]);
  const file = await download.path();
  const text = await readFile(file, "utf8");
  return { name: download.suggestedFilename(), text };
}

/** As linhas do catalogo (a tela tem outros botoes "Abrir ..." fora dele). */
const catalog = (page: Page) => page.getByTestId("reports-catalog");

test.describe("catálogo", () => {
  test("grátis: 8 relatórios, os de gestão travados no Pro", { tag: "@smoke" }, async ({ page }) => {
    await seedReports(page);
    await page.goto("/reports");
    await expect(page.getByRole("heading", { level: 1, name: "Relatórios" })).toBeVisible();
    // Lista por categoria (01/11/2026): uma linha por relatorio, sem busca nem mes no catalogo.
    for (const group of ["Operacionais", "Financeiros", "Retenção"]) {
      await expect(page.getByRole("heading", { level: 2, name: group })).toBeVisible();
    }
    await expect(catalog(page).getByRole("button", { name: /^Abrir / })).toHaveCount(6);
    await expect(catalog(page).getByRole("button", { name: /^Ver no Plano Profissional: / })).toHaveCount(2);
    await expect(page.getByPlaceholder("Buscar relatório")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Escolher mês/ })).toHaveCount(0);
    await expect(main(page).getByText("DRE gerencial", { exact: true })).toBeVisible();

    // Pro travado: abre o convite e volta.
    await page.getByRole("button", { name: "Ver no Plano Profissional: Retenção de alunos" }).click();
    await expect(page.getByText("Relatórios Gerenciais Avançados")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver Plano Profissional" })).toHaveAttribute("href", /\/settings\?tab=plano/);
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Relatórios" })).toBeVisible();
  });

  test("Pro libera todos e abre o relatório escolhido no catálogo", async ({ page }) => {
    await seedReports(page, { pro: true });
    await page.goto("/reports");
    await expect(catalog(page).getByRole("button", { name: /^Abrir / })).toHaveCount(8);
    await expect(catalog(page).getByRole("button", { name: /^Ver no Plano Profissional: / })).toHaveCount(0);
    await page.getByRole("button", { name: "Abrir Aniversariantes do mês" }).click();
    await expect(main(page)).toContainText("Aniversariantes de setembro");
    // O mes se escolhe dentro do relatorio aberto.
    await expect(page.getByRole("button", { name: /Escolher mês/ })).toBeVisible();
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Relatórios" })).toBeVisible();
  });

  test("Pro direto pela URL no grátis mostra o convite", async ({ page }) => {
    await seedReports(page);
    await page.goto("/reports?type=financial_income_statement&period=2026-09");
    await expect(page.getByText("Relatórios Gerenciais Avançados")).toBeVisible();
  });
});

test.describe("relatórios operacionais", () => {
  test("lista de presença da turma: presença do mês e faixa salva", { tag: "@smoke" }, async ({ page }) => {
    await seedReports(page);
    await openReport(page, "attendance_sheet");
    const sheet = main(page);
    // Abre na primeira turma por nome (Confeitaria): escolhe a turma e a aula de 21/09.
    await page.getByRole("combobox", { name: "Turma" }).click();
    await page.getByRole("option", { name: "Jiu-Jitsu Adulto" }).click();
    await page.getByRole("combobox", { name: "Aula" }).click();
    await page.getByRole("option", { name: "seg, 21/09 · 17:00" }).click();
    await expect(sheet).toContainText("Jiu-Jitsu Adulto · Jiu-Jitsu · Carlos Silva · seg, 21/09 · 17:00");
    await expect(sheet.getByText("Presentes", { exact: true }).locator("..")).toContainText("1");
    await expect(sheet.getByText("Faltas", { exact: true }).locator("..")).toContainText("1");
    const rows = sheet.locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: "Aluno A20" })).toContainText("Faixa Azul");
    await expect(rows.filter({ hasText: "Aluno A20" })).toContainText("Presente");
    // Observacao do aluno nao vira faixa; sem horario de chegada inventado.
    await expect(rows.filter({ hasText: "Bruna Lima" })).not.toContainText("Alergia");
    await expect(rows.filter({ hasText: "Bruna Lima" })).toContainText("Faltou");
    await expect(sheet).not.toContainText("07:05");
    // Aluno de fora da turma nao aparece.
    await expect(sheet).not.toContainText("Aluno Inativo");

    const csv = await exportCsv(page);
    expect(csv.name).toBe("relatorio-lista-de-presenca-2026-09-21.csv");
    expect(csv.text).toContain('"Lista de presença";"Jiu-Jitsu Adulto');
    expect(csv.text).toContain('"Aluno A20";"Faixa Azul";"Presente"');
  });

  test("lista de presença sem turma não inventa nomes", async ({ page }) => {
    await seedReports(page, { extra: (t) => ((t.classGroups = []), (t.enrollments = [])) });
    await openReport(page, "attendance_sheet");
    await expect(main(page)).toContainText("Nenhuma turma ativa");
    await expect(main(page)).toContainText("Nenhuma aula desta turma neste mês.");
    await expect(main(page)).not.toContainText("Prof. Titular");
  });

  test("relação de alunos: inativo aparece como inativo", async ({ page }) => {
    await seedReports(page);
    await openReport(page, "students_roster");
    const sheet = main(page);
    await expect(sheet.getByText("Ativos", { exact: true }).locator("..")).toContainText("2");
    await expect(sheet.getByText("Inativos", { exact: true }).locator("..")).toContainText("1");
    await expect(sheet.locator("tbody tr").filter({ hasText: "Aluno Inativo" })).toContainText("Inativo");
    await expect(sheet.locator("tbody tr").filter({ hasText: "Aluno A20" })).toContainText("Mensal Jiu-Jitsu");
    await expect(sheet.locator("tbody tr").filter({ hasText: "Aluno A20" })).toContainText("Faixa Azul");
    await expect(sheet).not.toContainText("Alergia");
    const csv = await exportCsv(page);
    expect(csv.text).toContain('"Aluno";"Telefone";"Plano";"Vencimento";"Situação"');
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
    expect(csv.text).toContain('"Aluno";"Vencimento";"Valor";"Situação";"Pago em";"Forma"');
    expect(csv.text).toContain('"Bruna Lima";"15/09/2026";"40,00";"Atrasado"');
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
    await expect(sheet).toContainText("2 alunos fazem aniversário neste mês.");
    await expect(sheet.locator("tbody tr").first()).toContainText("Bruna Lima");
    await expect(sheet.locator("tbody tr").last()).toContainText("Aluno A20");
    await expect(sheet).not.toContainText("Aluno Inativo");
    const csv = await exportCsv(page);
    expect(csv.text).toContain('"25";"Aluno A20"');

    await openReport(page, "monthly_birthdays", "2026-11");
    await expect(main(page)).toContainText("Aniversariantes de novembro");
    await expect(main(page)).toContainText("Nenhum aluno faz aniversário neste mês.");
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
    await expect(main(page).getByText("Aulas usadas", { exact: true }).first().locator("..")).toContainText("1");
    await expect(main(page).getByText("Saldo de aulas", { exact: true }).first().locator("..")).toContainText("9");

    await openReport(page, "course_summary", "2026-06");
    await expect(main(page)).toContainText("Nenhum curso com aulas ou parcelas neste mês.");
    await openReport(page, "package_summary", "2026-06");
    // O saldo de hoje vale para qualquer mes; sem vendas nem uso em junho.
    await expect(main(page).getByText("Vendidos", { exact: true }).first().locator("..")).toContainText("0");
  });

  test("trocar o mês dentro do relatório aberto", async ({ page }) => {
    await seedReports(page);
    await page.goto("/reports");
    await main(page).getByRole("button", { name: "Abrir Aniversariantes do mês" }).click();
    await expect(main(page)).toContainText("Aniversariantes de setembro");
    // Setembro -> novembro pelo seletor de mes do relatorio (01/11/2026: nao ha mais mes no catalogo).
    await page.getByRole("button", { name: "Próximo mês" }).click();
    await page.getByRole("button", { name: "Próximo mês" }).click();
    await expect(main(page)).toContainText("Aniversariantes de novembro");
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
    expect(csv.text).toContain('"Receita bruta";"1050,00"');

    await openReport(page, "financial_income_statement", "2026-06");
    await expect(main(page)).toContainText("Sem recebimentos nem despesas pagas neste mês.");
  });

  test("churn e retenção só com dados reais, por turma", async ({ page }) => {
    await seedReports(page, {
      pro: true,
      extra: (t) => {
        // Retencao pelas datas das matriculas: os 3 alunos da turma ja estavam
        // nela antes de setembro e o Aluno Inativo saiu em 10/09.
        const august = "2026-08-01T12:00:00.000Z";
        for (const e of t.enrollments) if (e.classGroupId === "cg-1") e.enrolledAt = august;
        t.enrollments.push({
          ...enrollment("e-4", "cg-1", "c-x"),
          enrolledAt: august,
          status: "canceled",
          canceledAt: "2026-09-10T12:00:00.000Z",
        });
      },
    });
    await openReport(page, "churn_retention");
    const sheet = main(page);
    await expect(sheet.getByText("Alunos no início", { exact: true }).locator("..")).toContainText("3");
    await expect(sheet.getByText("Saíram", { exact: true }).locator("..")).toContainText("1");
    const jj = sheet.locator("tbody tr").filter({ hasText: "Jiu-Jitsu Adulto" });
    // 2 ativos e 1 matricula cancelada no mes: 33,3% de churn na turma.
    await expect(jj).toContainText("2");
    await expect(jj).toContainText("33,3%");
    await expect(jj).toContainText("66,7%");
    await expect(sheet.getByRole("columnheader", { name: "Turma" })).toBeVisible();
    const csv = await exportCsv(page);
    expect(csv.text).toContain('"Período";"Competência 09/2026"');
    expect(csv.text).toContain('"Saíram";"1"');
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
    await expect(sheet.getByText("Alunos no início", { exact: true }).locator("..")).toContainText("0");
    await expect(sheet).not.toContainText("118");
    await expect(sheet).not.toContainText("No-Gi");
    await expect(sheet).toContainText("Nenhuma turma com alunos neste mês.");
  });
});

test.describe("imprimir e permissões", () => {
  test("PDF sai do servidor e a impressão esconde a barra", { tag: "@smoke" }, async ({ page }) => {
    await seedReports(page);
    await openReport(page, "students_roster");
    // PDF gerado no servidor, com os mesmos filtros da tela, em outra aba.
    const pdf = page.getByRole("link", { name: "Baixar PDF" });
    await expect(pdf).toHaveAttribute("href", "/api/documents/reports/students_roster?competencia=2026-09");
    await expect(pdf).toHaveAttribute("target", "_blank");
    const response = await page.request.get("/api/documents/reports/students_roster?competencia=2026-09");
    expect(response.headers()["content-type"]).toBe("application/pdf");

    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("link", { name: "Exportar CSV" })).toBeHidden();
    await expect(main(page)).toContainText("Relação de alunos");
    await page.emulateMedia({ media: "screen" });
  });

  test("atendente vê os relatórios mas não exporta", { tag: "@smoke" }, async ({ page }) => {
    await seedReports(page, { extra: (t) => t.users.push(ATTENDANT) });
    await loginAsUser(page, ATTENDANT);
    await openReport(page, "students_roster");
    await expect(main(page)).toContainText("Relação de alunos");
    await expect(page.getByRole("link", { name: "Exportar CSV" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Baixar PDF" })).toHaveCount(0);
    const denied = await page.request.get("/api/documents/reports/students_roster?competencia=2026-09");
    expect(denied.status()).toBe(403);
  });

});
