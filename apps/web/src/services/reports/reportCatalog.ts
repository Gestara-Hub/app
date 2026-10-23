import type {
ReportHeaderInfo,
ReportMetadata,
Permission,
ReportType
} from "@gestarahub/contracts";
import { nowIso } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { can } from "@/lib/permissions";
import { getCurrentActor } from "@/services/world/actor";

/**
 * Catalogo de relatorios, permissao de cada um e cabecalho comum.
 */

export const CATALOG: ReportMetadata[] = [
  // 1. Operacionais (Free)
  {
    type: "attendance_sheet",
    title: "Lista de presença",
    description: "Presença de cada aluno por turma e aula.",
    category: "operational",
    tierRequired: "free",
    iconName: "ClipboardCheck",
  },
  {
    type: "students_roster",
    title: "Relação de alunos",
    description: "Plano, matrícula, nível e situação de cada aluno.",
    category: "operational",
    tierRequired: "free",
    iconName: "Users",
  },
  {
    type: "billing_statement",
    title: "Cobranças e inadimplência",
    description: "Cobranças geradas, recebidas, em aberto e taxa de atraso.",
    category: "operational",
    tierRequired: "free",
    iconName: "Wallet",
  },
  {
    type: "course_summary",
    title: "Cursos",
    description: "Por curso: alunos, concluídos, cancelados, contratado, recebido e em aberto.",
    category: "operational",
    tierRequired: "free",
    iconName: "GraduationCap",
  },
  {
    type: "package_summary",
    title: "Pacotes de aulas",
    description: "Por pacote: vendas, aulas vendidas e usadas, saldo e recebido.",
    category: "operational",
    tierRequired: "free",
    iconName: "Ticket",
  },
  {
    type: "monthly_birthdays",
    title: "Aniversariantes do mês",
    description: "Quem faz aniversário no mês, com o contato.",
    category: "operational",
    tierRequired: "free",
    iconName: "Cake",
  },
  // 2. Gerenciais Avançados (Pro)
  {
    type: "financial_income_statement",
    title: "DRE gerencial",
    description: "Receitas, despesas e resultado do mês.",
    category: "financial",
    tierRequired: "pro",
    iconName: "FileSpreadsheet",
  },
  {
    type: "churn_retention",
    title: "Retenção de alunos",
    description: "Entradas, saídas e retenção por turma.",
    category: "retention",
    tierRequired: "pro",
    iconName: "TrendingUp",
  },
];

/**
 * Valores de cobranca pedem `billing:view`; DRE, churn, previsao e repasse,
 * `finance:view` (a atendente nao abre o financeiro por Relatorios).
 */
export const REPORT_PERMISSION: Partial<Record<ReportType, Permission>> = {
  billing_statement: "billing:view",
  course_summary: "billing:view",
  package_summary: "billing:view",
  financial_income_statement: "finance:view",
  churn_retention: "finance:view",
  revenue_forecast: "finance:view",
  teacher_performance: "finance:view",
};

/** O usuario logado pode ver o relatorio? Sem ator (scripts) passa. */
export function actorCanSee(type: ReportType): boolean {
  const permission = REPORT_PERMISSION[type];
  const actor = getCurrentActor();
  return !permission || !actor || can(actor.profile, permission);
}

export function buildHeader(periodLabel: string): ReportHeaderInfo {
  return {
    organizationName: store.organization.name,
    organizationSegment: store.organization.segment || "Espaço",
    unitName: store.unit.name,
    generatedAt: nowIso(),
    // Quem gerou (antes "Administração" fixo).
    generatedBy: getCurrentActor()?.name ?? store.organization.name,
    periodLabel,
  };
}
