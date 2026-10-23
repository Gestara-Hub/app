import type {
  AttendanceReportData,
  BillingStatementReportData,
  BirthdayReportData,
  ChurnReportData,
  CourseReportData,
  DocumentModel,
  DocumentTableBlock,
  DocumentTone,
  DREStatementReportData,
  GeneratedReportData,
  PackageReportData,
  PaymentMethod,
  ReportHeaderInfo,
  StudentRosterReportData,
} from "@gestarahub/contracts";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/labels";
import { displayCell, documentDateTime } from "./format";

/**
 * Relatorios do catalogo como `DocumentModel` (mesmo layout para todos): a
 * tela mostra a previa e o servidor gera o PDF e o CSV com o mesmo modelo.
 * Funcoes puras, rodam no navegador e no servidor.
 */

/** Palavras que dependem da area ou da modalidade ("Faixa", "Nível"). */
export interface ReportDocumentContext {
  /** Palavra da trilha da area (relacao de alunos mistura modalidades). */
  levelLabel: string;
  /** Palavra da trilha de uma modalidade (lista de presenca de uma turma). */
  levelLabelForModality?: (modalityName: string) => string;
}

/** Nome do arquivo em portugues: relatorio-alunos-2026-10. */
export const REPORT_FILE_SLUG: Record<GeneratedReportData["type"], string> = {
  attendance_sheet: "lista-de-presenca",
  students_roster: "alunos",
  billing_statement: "cobrancas",
  course_summary: "cursos",
  package_summary: "pacotes",
  monthly_birthdays: "aniversariantes",
  financial_income_statement: "dre",
  churn_retention: "retencao",
};

/** Cabecalho e meta comuns a todos os relatorios. */
export function reportBase(
  header: ReportHeaderInfo,
  title: string,
  fileKey: string,
): Pick<DocumentModel, "header" | "meta" | "title" | "fileName"> {
  return {
    title,
    fileName: `relatorio-${fileKey}`,
    header: {
      organizationName: header.organizationName,
      details: [header.unitName, header.organizationSegment].filter(Boolean).join(" · "),
    },
    meta: [
      { label: "Período", value: header.periodLabel },
      { label: "Emitido em", value: documentDateTime(header.generatedAt) },
      { label: "Responsável", value: header.generatedBy },
    ],
  };
}

const ROSTER_STATUS: Record<StudentRosterReportData["rows"][number]["status"], { label: string; tone: DocumentTone }> = {
  active: { label: "Ativo", tone: "positive" },
  paused: { label: "Trancado", tone: "default" },
  inactive: { label: "Inativo", tone: "muted" },
};

function studentsRoster(data: StudentRosterReportData, competence: string, ctx: ReportDocumentContext): DocumentModel {
  return {
    ...reportBase(data.header, "Relação de alunos", `${REPORT_FILE_SLUG.students_roster}-${competence}`),
    subtitle: "Plano, vencimento, situação e trilha de cada aluno.",
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Ativos", value: data.totalActive, format: "integer", tone: "positive" },
          { label: "Trancados", value: data.totalPaused, format: "integer" },
          { label: "Inativos", value: data.totalInactive, format: "integer", tone: "muted" },
          { label: "Total", value: data.rows.length, format: "integer" },
        ],
      },
      {
        type: "table",
        columns: [
          { key: "name", label: "Aluno", width: 2 },
          { key: "phone", label: "Telefone", format: "phone", width: 1.4 },
          { key: "plan", label: "Plano", width: 1.6 },
          { key: "dueDay", label: "Vencimento", width: 1.1 },
          { key: "status", label: "Situação" },
          { key: "level", label: ctx.levelLabel, width: 1.2 },
          { key: "enrolledAt", label: "Cadastro", format: "date" },
        ],
        rows: data.rows.map((r) => ({
          cells: {
            name: r.name,
            phone: r.phone,
            plan: r.planName,
            dueDay: `Dia ${r.dueDay}`,
            status: ROSTER_STATUS[r.status].label,
            level: r.belt,
            enrolledAt: r.enrolledAt,
          },
          tones: { status: ROSTER_STATUS[r.status].tone },
        })),
        emptyText: "Nenhum aluno cadastrado até este mês.",
      },
    ],
  };
}

/** "seg, 21/09 · 06:00". */
export function sessionOptionLabel(date: string, start: string): string {
  const weekday = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][new Date(`${date}T12:00:00`).getDay()];
  return `${weekday}, ${date.slice(8, 10)}/${date.slice(5, 7)} · ${start}`;
}

/** Texto que nao e traco vazio ("—" vem do servico quando falta o dado). */
const present = (value: string | undefined) => (value && value !== "—" ? value : null);

const ATTENDANCE_STATUS: Record<AttendanceReportData["rows"][number]["status"], { label: string; tone: DocumentTone }> = {
  present: { label: "Presente", tone: "positive" },
  absent: { label: "Faltou", tone: "negative" },
  justified: { label: "Justificada", tone: "default" },
  unmarked: { label: "Sem marcação", tone: "muted" },
};

function attendanceSheet(data: AttendanceReportData, competence: string, ctx: ReportDocumentContext): DocumentModel {
  const level = ctx.levelLabelForModality?.(data.modalityName) ?? ctx.levelLabel;
  return {
    ...reportBase(data.header, "Lista de presença", `${REPORT_FILE_SLUG.attendance_sheet}-${data.sessionId ? data.sessionDate : competence}`),
    subtitle: [
      data.className,
      present(data.modalityName),
      present(data.teacherName),
      data.sessionId ? sessionOptionLabel(data.sessionDate, data.sessionTime) : null,
    ]
      .filter(Boolean)
      .join(" · "),
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Presentes", value: data.totalPresent, format: "integer", tone: "positive" },
          { label: "Faltas", value: data.totalAbsent, format: "integer", tone: data.totalAbsent > 0 ? "negative" : "default" },
          { label: "Justificadas", value: data.totalJustified, format: "integer" },
          { label: "Sem marcação", value: data.totalUnmarked, format: "integer", tone: "muted" },
        ],
      },
      {
        type: "table",
        numbered: true,
        columns: [
          { key: "name", label: "Aluno", width: 2.2 },
          { key: "level", label: level, width: 1.2 },
          { key: "status", label: "Presença", align: "center", width: 1.1 },
          { key: "signature", label: "Assinatura", width: 2 },
        ],
        rows: data.rows.map((r) => ({
          cells: { name: r.studentName, level: r.belt, status: ATTENDANCE_STATUS[r.status].label },
          tones: { status: ATTENDANCE_STATUS[r.status].tone },
        })),
        emptyText: data.sessionId ? "Nenhum aluno nesta aula." : "Nenhuma aula desta turma neste mês.",
      },
    ],
  };
}

const CHARGE_STATUS: Record<BillingStatementReportData["rows"][number]["status"], { label: string; tone: DocumentTone }> = {
  paid: { label: "Pago", tone: "positive" },
  pending: { label: "Pendente", tone: "default" },
  overdue: { label: "Atrasado", tone: "negative" },
};

const methodLabel = (method?: string) =>
  method && (PAYMENT_METHODS as string[]).includes(method) ? paymentMethodLabel(method as PaymentMethod) : method;

function billingStatement(data: BillingStatementReportData, competence: string): DocumentModel {
  return {
    ...reportBase(data.header, "Cobranças e inadimplência", `${REPORT_FILE_SLUG.billing_statement}-${competence}`),
    subtitle: "Cobranças do mês, o que entrou e o que está em atraso.",
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Faturado", value: data.totalBilledCents, format: "money" },
          { label: "Recebido", value: data.totalReceivedCents, format: "money", tone: "positive" },
          { label: "Pendente", value: data.totalPendingCents, format: "money" },
          {
            label: "Inadimplência",
            value: data.defaultRatePercent,
            format: "percent",
            tone: data.totalOverdueCents > 0 ? "negative" : "default",
            sub: data.totalOverdueCents > 0 ? `${displayMoney(data.totalOverdueCents)} em atraso` : undefined,
          },
        ],
      },
      {
        type: "table",
        columns: [
          { key: "name", label: "Aluno", width: 2.2 },
          { key: "dueDate", label: "Vencimento", format: "date", width: 1.1 },
          { key: "amount", label: "Valor", format: "money" },
          { key: "status", label: "Situação" },
          { key: "paidAt", label: "Pago em", format: "date" },
          { key: "method", label: "Forma" },
        ],
        rows: data.rows.map((r) => ({
          cells: {
            name: r.studentName,
            dueDate: r.dueDate,
            amount: r.amountCents,
            status: CHARGE_STATUS[r.status].label,
            paidAt: r.paidAt,
            method: methodLabel(r.paymentMethod),
          },
          tones: { status: CHARGE_STATUS[r.status].tone },
        })),
        totals: { name: "Total", amount: data.totalBilledCents },
        emptyText: "Nenhuma cobrança registrada nesta competência.",
      },
    ],
  };
}

function courseSummary(data: CourseReportData, competence: string): DocumentModel {
  return {
    ...reportBase(data.header, "Cursos", `${REPORT_FILE_SLUG.course_summary}-${competence}`),
    subtitle: "Cursos com aulas ou parcelas no mês. Valores do curso inteiro.",
    landscape: true,
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Contratado", value: data.totalContractedCents, format: "money" },
          { label: "Recebido", value: data.totalReceivedCents, format: "money", tone: "positive" },
          { label: "Em aberto", value: data.totalOpenCents, format: "money", tone: data.totalOpenCents > 0 ? "negative" : "default" },
          { label: "Recebido no mês", value: data.receivedInPeriodCents, format: "money" },
        ],
      },
      {
        type: "table",
        columns: [
          { key: "name", label: "Curso", width: 2 },
          { key: "teacher", label: "Professor", width: 1.4 },
          { key: "start", label: "Início", format: "date" },
          { key: "end", label: "Fim", format: "date" },
          { key: "enrolled", label: "Matriculados", format: "integer" },
          { key: "completed", label: "Concluídos", format: "integer" },
          { key: "canceled", label: "Cancelados", format: "integer" },
          { key: "contracted", label: "Contratado", format: "money", width: 1.1 },
          { key: "received", label: "Recebido", format: "money", width: 1.1 },
          { key: "open", label: "Em aberto", format: "money", width: 1.1 },
        ],
        rows: data.rows.map((r) => ({
          cells: {
            name: r.className,
            teacher: present(r.teacherName),
            start: r.startDate,
            end: r.endDate,
            enrolled: r.enrolled,
            completed: r.completed,
            canceled: r.canceled,
            contracted: r.contractedCents,
            received: r.receivedCents,
            open: r.openCents,
          },
          tones: { open: r.openCents > 0 ? "negative" : "default", received: "positive" },
        })),
        totals: {
          name: "Total",
          enrolled: sum(data.rows.map((r) => r.enrolled)),
          completed: sum(data.rows.map((r) => r.completed)),
          canceled: sum(data.rows.map((r) => r.canceled)),
          contracted: data.totalContractedCents,
          received: data.totalReceivedCents,
          open: data.totalOpenCents,
        },
        emptyText: "Nenhum curso com aulas ou parcelas neste mês.",
      },
    ],
  };
}

function packageSummary(data: PackageReportData, competence: string): DocumentModel {
  return {
    ...reportBase(data.header, "Pacotes de aulas", `${REPORT_FILE_SLUG.package_summary}-${competence}`),
    subtitle: "Vendas, aulas usadas e recebido no mês. Saldo de hoje.",
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Vendidos", value: data.totalSold, format: "integer" },
          { label: "Aulas usadas", value: data.totalLessonsUsed, format: "integer" },
          { label: "Saldo de aulas", value: data.totalLessonsRemaining, format: "integer" },
          { label: "Recebido", value: data.totalReceivedCents, format: "money", tone: "positive" },
        ],
      },
      {
        type: "table",
        columns: [
          { key: "name", label: "Pacote", width: 2.2 },
          { key: "sold", label: "Vendidos", format: "integer" },
          { key: "lessonsSold", label: "Aulas vendidas", format: "integer" },
          { key: "lessonsUsed", label: "Aulas usadas", format: "integer" },
          { key: "lessonsRemaining", label: "Saldo de aulas", format: "integer" },
          { key: "received", label: "Recebido", format: "money", width: 1.2 },
        ],
        rows: data.rows.map((r) => ({
          cells: {
            name: r.packageName,
            sold: r.sold,
            lessonsSold: r.lessonsSold,
            lessonsUsed: r.lessonsUsed,
            lessonsRemaining: r.lessonsRemaining,
            received: r.receivedCents,
          },
        })),
        totals: {
          name: "Total",
          sold: data.totalSold,
          lessonsSold: sum(data.rows.map((r) => r.lessonsSold)),
          lessonsUsed: data.totalLessonsUsed,
          lessonsRemaining: data.totalLessonsRemaining,
          received: data.totalReceivedCents,
        },
        emptyText: "Nenhum pacote vendido, usado ou pago neste mês.",
      },
    ],
  };
}

function monthlyBirthdays(data: BirthdayReportData, competence: string): DocumentModel {
  return {
    ...reportBase(data.header, `Aniversariantes de ${data.monthName.toLowerCase()}`, `${REPORT_FILE_SLUG.monthly_birthdays}-${competence}`),
    subtitle:
      data.totalBirthdays === 1 ? "1 aluno faz aniversário neste mês." : `${data.totalBirthdays} alunos fazem aniversário neste mês.`,
    blocks: [
      {
        type: "table",
        columns: [
          { key: "day", label: "Dia", align: "center", width: 0.6 },
          { key: "name", label: "Aluno", width: 2.2 },
          { key: "phone", label: "Telefone", format: "phone", width: 1.4 },
          { key: "birthDate", label: "Nascimento", format: "date", width: 1.1 },
          { key: "plan", label: "Plano", width: 1.6 },
        ],
        rows: data.rows.map((r) => ({
          cells: {
            day: String(r.day).padStart(2, "0"),
            name: r.name,
            phone: r.phone,
            birthDate: r.birthDate,
            plan: r.planName,
          },
        })),
        emptyText: "Nenhum aluno faz aniversário neste mês.",
      },
    ],
  };
}

function categoryTable(title: string, rows: DREStatementReportData["incomeCategories"], totalCents: number, tone: DocumentTone): DocumentTableBlock {
  return {
    type: "table",
    title,
    columns: [
      { key: "name", label: "Categoria", width: 3 },
      { key: "percent", label: "%", format: "percent" },
      { key: "amount", label: "Valor", format: "money", width: 1.4 },
    ],
    rows: rows.map((c) => ({ cells: { name: c.name, percent: c.percent, amount: c.amountCents }, tones: { amount: tone } })),
    totals: { name: "Total", amount: totalCents },
    emptyText: "Nada neste mês.",
  };
}

function incomeStatement(data: DREStatementReportData, competence: string): DocumentModel {
  const resultTone: DocumentTone = data.operationalResultCents < 0 ? "negative" : "positive";
  const empty = data.grossRevenueCents === 0 && data.operatingExpensesCents === 0;
  return {
    ...reportBase(data.header, "DRE do mês", `${REPORT_FILE_SLUG.financial_income_statement}-${competence}`),
    subtitle: "Receitas, despesas pagas e resultado operacional.",
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Receita bruta", value: data.grossRevenueCents, format: "money" },
          { label: "Receita líquida", value: data.netRevenueCents, format: "money" },
          { label: "Despesas", value: data.operatingExpensesCents, format: "money", tone: "negative" },
          {
            label: "Resultado",
            value: data.operationalResultCents,
            format: "money",
            tone: resultTone,
            sub: `Margem de ${displayPercent(data.operatingMarginPercent)}`,
          },
        ],
      },
      ...(empty
        ? [{ type: "text" as const, text: "Sem recebimentos nem despesas pagas neste mês.", tone: "muted" as const }]
        : [
            {
              type: "fields" as const,
              title: "Demonstrativo",
              items: [
                { label: "Receita bruta", value: data.grossRevenueCents, format: "money" as const },
                { label: "Deduções", value: -data.deductionsCents, format: "money" as const, tone: "negative" as const },
                { label: "Receita líquida", value: data.netRevenueCents, format: "money" as const },
                { label: "Despesas operacionais", value: -data.operatingExpensesCents, format: "money" as const, tone: "negative" as const },
                { label: "Resultado operacional", value: data.operationalResultCents, format: "money" as const, tone: resultTone, strong: true },
                { label: "Margem operacional", value: data.operatingMarginPercent, format: "percent" as const },
              ],
            },
            categoryTable("Receitas por origem", data.incomeCategories, data.grossRevenueCents, "positive"),
            categoryTable("Despesas por categoria", data.expenseCategories, data.operatingExpensesCents, "negative"),
          ]),
    ],
  };
}

function churnRetention(data: ChurnReportData, competence: string): DocumentModel {
  return {
    ...reportBase(data.header, "Retenção de alunos", `${REPORT_FILE_SLUG.churn_retention}-${competence}`),
    subtitle: "Quem entrou, quem saiu e quem ficou no mês.",
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Alunos no início", value: data.activeStudentsStart, format: "integer" },
          { label: "Novos", value: data.newEnrollments, format: "integer", tone: "positive" },
          { label: "Saíram", value: data.cancellations, format: "integer", tone: data.cancellations > 0 ? "negative" : "default" },
          { label: "Retenção", value: data.retentionRatePercent, format: "percent", tone: "positive" },
        ],
      },
      {
        type: "fields",
        title: "Resumo do mês",
        items: [
          { label: "Alunos no fim", value: data.activeStudentsEnd, format: "integer" },
          {
            label: "Crescimento líquido",
            value: data.netGrowth > 0 ? `+${data.netGrowth}` : String(data.netGrowth),
            tone: data.netGrowth < 0 ? "negative" : data.netGrowth > 0 ? "positive" : "default",
          },
          { label: "Cancelamento", value: data.churnRatePercent, format: "percent" },
        ],
      },
      {
        type: "table",
        title: "Por modalidade",
        columns: [
          { key: "name", label: "Modalidade", width: 2.4 },
          { key: "active", label: "Alunos ativos", format: "integer" },
          { key: "churn", label: "Cancelamento", format: "percent" },
          { key: "retention", label: "Retenção", format: "percent" },
        ],
        rows: data.modalitiesBreakdown.map((m) => ({
          cells: {
            name: m.modalityName,
            active: m.activeCount,
            churn: m.churnRatePercent,
            retention: Math.round((100 - m.churnRatePercent) * 10) / 10,
          },
          tones: { churn: m.churnRatePercent > 0 ? "negative" : "default" },
        })),
        emptyText: "Nenhuma modalidade com alunos neste mês.",
      },
    ],
  };
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const displayMoney = (cents: number) => displayCell(cents, "money");
const displayPercent = (value: number) => displayCell(value, "percent");

/** Relatorio -> documento (todos no mesmo layout). */
export function reportToDocument(
  report: GeneratedReportData,
  competence: string,
  ctx: ReportDocumentContext,
): DocumentModel {
  switch (report.type) {
    case "attendance_sheet":
      return attendanceSheet(report.data, competence, ctx);
    case "students_roster":
      return studentsRoster(report.data, competence, ctx);
    case "billing_statement":
      return billingStatement(report.data, competence);
    case "course_summary":
      return courseSummary(report.data, competence);
    case "package_summary":
      return packageSummary(report.data, competence);
    case "monthly_birthdays":
      return monthlyBirthdays(report.data, competence);
    case "financial_income_statement":
      return incomeStatement(report.data, competence);
    case "churn_retention":
      return churnRetention(report.data, competence);
  }
}
