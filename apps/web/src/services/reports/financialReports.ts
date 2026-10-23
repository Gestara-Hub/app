import type {
  BillingStatementReportData,
  BillingStatementRow,
  ChargeKind,
  CourseReportData,
  DRECategoryRow,
  DREStatementReportData,
  GeneratedReportData,
  PackageReportData,
} from "@gestarahub/contracts";
import { format } from "date-fns";
import { store } from "@/services/world/store";
import { ensureMembershipCharges } from "../billing";
import { assertFeature } from "../subscription/subscriptionService";
import { buildHeader } from "./reportCatalog";
import { VOID_STATUSES, paidIn, buildCourseReport, buildPackageReport } from "./courseAndPackageReports";
import type { ReportContext } from "./reportContext";

/** Relatorios de dinheiro: cobrancas, cursos, pacotes e DRE. */

export async function buildBillingStatement({ competence, periodLabel }: ReportContext): Promise<GeneratedReportData> {
    // Mensalidades do mes nascem na leitura (como em Cobrancas e no Financeiro).
    await ensureMembershipCharges(competence);
    const today = format(new Date(), "yyyy-MM-dd");
    const clientsById = new Map(store.clients.map((c) => [c.id, c.name]));

    // Cobrancas da competencia, sem as canceladas nem as isentas (nao sao
    // receita nem divida).
    const chargesForCompetence = store.charges.filter(
      (ch) =>
        !VOID_STATUSES.has(ch.status) &&
        ((ch.competence && ch.competence === competence) ||
          (ch.dueDate && ch.dueDate.startsWith(competence))),
    );

    const rows: BillingStatementRow[] = chargesForCompetence.map((ch) => ({
      chargeId: ch.id,
      studentName: clientsById.get(ch.studentId) || "Aluno",
      amountCents: ch.amountCents,
      dueDate: ch.dueDate,
      // Atraso e derivado: em aberto com vencimento passado esta atrasada.
      status: ch.status === "paid" ? "paid" : ch.dueDate < today ? "overdue" : "pending",
      paidAt: ch.paidAt,
      paymentMethod: ch.method || undefined,
    }));

    const totalReceivedCents = rows
      .filter((r) => r.status === "paid")
      .reduce((acc, r) => acc + r.amountCents, 0);

    const totalPendingCents = rows
      .filter((r) => r.status === "pending")
      .reduce((acc, r) => acc + r.amountCents, 0);

    const totalOverdueCents = rows
      .filter((r) => r.status === "overdue")
      .reduce((acc, r) => acc + r.amountCents, 0);

    const totalBilledCents = totalReceivedCents + totalPendingCents + totalOverdueCents;

    const defaultRatePercent =
      totalBilledCents > 0
        ? Math.round((totalOverdueCents / totalBilledCents) * 1000) / 10
        : 0;

    const data: BillingStatementReportData = {
      header: buildHeader(periodLabel),
      totalBilledCents,
      totalReceivedCents,
      totalPendingCents,
      totalOverdueCents,
      defaultRatePercent,
      rows,
    };

    return { type: "billing_statement", data };
}

export async function buildCourseSummary({ competence, periodLabel }: ReportContext): Promise<GeneratedReportData> {
    const today = format(new Date(), "yyyy-MM-dd");
    const data: CourseReportData = { header: buildHeader(periodLabel), ...buildCourseReport(competence, today) };
    return { type: "course_summary", data };
}

export async function buildPackageSummary({ competence, periodLabel }: ReportContext): Promise<GeneratedReportData> {
    const today = format(new Date(), "yyyy-MM-dd");
    const data: PackageReportData = { header: buildHeader(periodLabel), ...buildPackageReport(competence, today) };
    return { type: "package_summary", data };
}

export async function buildIncomeStatement({ competence, periodLabel }: ReportContext): Promise<GeneratedReportData> {
    assertFeature("reports_advanced");

    const categoriesById = new Map(store.financialCategories.map((c) => [c.id, c.name]));

    // 1. Cobrancas recebidas no mes (data local do pagamento, como o Resumo
    // do Financeiro). "Competencia OU pagamento" contava duas vezes a
    // cobranca de um mes paga no seguinte. Sem data de pagamento (dado
    // antigo), vale a competencia.
    const paidCharges = store.charges.filter(
      (ch) =>
        ch.status === "paid" &&
        (ch.paidAt ? paidIn(ch, competence) : ch.competence === competence),
    );
    // Cada tipo de cobranca vira uma linha propria (mensalidade, aula avulsa, cobranca avulsa, curso, pacote).
    const CHARGE_INCOME_LABEL: Record<ChargeKind, string> = {
      membership: "Mensalidades de Alunos",
      dropin: "Aulas Avulsas",
      extra: "Cobranças Avulsas",
      course: "Cursos",
      package: "Pacotes de aulas",
    };
    const chargeRevenue = new Map<string, number>();
    paidCharges.forEach((c) => {
      const label = CHARGE_INCOME_LABEL[c.kind];
      chargeRevenue.set(label, (chargeRevenue.get(label) ?? 0) + c.amountCents);
    });

    // 2. Receitas avulsas e produtos de lançamentos financeiros
    const manualIncomes = store.financialEntries.filter(
      (e) =>
        e.type === "income" &&
        e.status === "paid" &&
        e.dueDate.startsWith(competence),
    );

    // Agrupa receitas por categoria
    const incomeMap = new Map<string, number>();
    chargeRevenue.forEach((cents, label) => incomeMap.set(label, cents));
    manualIncomes.forEach((e) => {
      const catName = categoriesById.get(e.categoryId) || "Outras Receitas";
      incomeMap.set(catName, (incomeMap.get(catName) || 0) + e.amountCents);
    });

    // 3. Despesas do mês
    const manualExpenses = store.financialEntries.filter(
      (e) =>
        e.type === "expense" &&
        e.status === "paid" &&
        e.dueDate.startsWith(competence),
    );

    // 4. Pagamentos a professores
    const teacherPayouts = store.teacherPayouts.filter(
      (p) => p.competence === competence && p.status === "paid",
    );
    const teacherPayoutTotalCents = teacherPayouts.reduce((acc, p) => acc + p.totalCents, 0);

    const expenseMap = new Map<string, number>();
    if (teacherPayoutTotalCents > 0) {
      expenseMap.set("Repasse de Professores", teacherPayoutTotalCents);
    }
    manualExpenses.forEach((e) => {
      const catName = categoriesById.get(e.categoryId) || "Outras Despesas";
      expenseMap.set(catName, (expenseMap.get(catName) || 0) + e.amountCents);
    });

    // So dados reais: mes sem lancamento pago sai zerado (a tela mostra o vazio).
    const grossRevenueCents = Array.from(incomeMap.values()).reduce((a, b) => a + b, 0);
    const operatingExpensesCents = Array.from(expenseMap.values()).reduce((a, b) => a + b, 0);

    // Taxas do provedor de pagamento ainda nao sao registradas; quando forem,
    // entram aqui. Ate la, sem deducao estimada.
    const deductionsCents = 0;
    const netRevenueCents = grossRevenueCents - deductionsCents;
    const operationalResultCents = netRevenueCents - operatingExpensesCents;
    const operatingMarginPercent =
      netRevenueCents > 0
        ? Math.round((operationalResultCents / netRevenueCents) * 1000) / 10
        : 0;

    const incomeCategories: DRECategoryRow[] = Array.from(incomeMap.entries()).map(([name, amountCents]) => ({
      name,
      amountCents,
      percent: grossRevenueCents > 0 ? Math.round((amountCents / grossRevenueCents) * 1000) / 10 : 0,
    }));

    const expenseCategories: DRECategoryRow[] = Array.from(expenseMap.entries()).map(([name, amountCents]) => ({
      name,
      amountCents,
      percent: operatingExpensesCents > 0 ? Math.round((amountCents / operatingExpensesCents) * 1000) / 10 : 0,
    }));

    const data: DREStatementReportData = {
      header: buildHeader(periodLabel),
      grossRevenueCents,
      deductionsCents,
      netRevenueCents,
      operatingExpensesCents,
      operationalResultCents,
      operatingMarginPercent,
      incomeCategories,
      expenseCategories,
    };

    return { type: "financial_income_statement", data };
}
