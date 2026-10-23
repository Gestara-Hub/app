import type {
  DocumentModel,
  DocumentTone,
  GeneratedReportData,
  ReportHeaderInfo,
  StudentRosterReportData,
} from "@gestarahub/contracts";
import { documentDateTime } from "./format";

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

/**
 * Relatorio -> documento. Tipos ainda sem layout novo devolvem null (a tela
 * usa a visualizacao antiga ate a fase 2).
 */
export function reportToDocument(
  report: GeneratedReportData,
  competence: string,
  ctx: ReportDocumentContext,
): DocumentModel | null {
  switch (report.type) {
    case "students_roster":
      return studentsRoster(report.data, competence, ctx);
    default:
      return null;
  }
}
