"use client";

import { useState } from "react";
import type { ReportType } from "@gestarahub/contracts";
import { FeatureLocked } from "@/components/shared/feature-locked";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useHasFeature } from "@/features/auth";
import { useReportData } from "../hooks/use-reports";
import { ReportDocumentScreen } from "./report-document-screen";
import { ReportsCatalogTab } from "./reports-catalog-tab";
import { dateInSpace } from "@gestarahub/core/date";

interface ReportsViewProps {
  initialReportType?: ReportType | null;
  initialCompetence?: string;
}

/** Relatorios que existem (link antigo com outro tipo abre o catalogo). */
const AVAILABLE_REPORTS: ReportType[] = [
  "attendance_sheet",
  "students_roster",
  "billing_statement",
  "course_summary",
  "package_summary",
  "monthly_birthdays",
  "financial_income_statement",
  "churn_retention",
];

export function ReportsView({
  initialReportType = null,
  initialCompetence,
}: ReportsViewProps) {
  const currentMonth = dateInSpace().slice(0, 7);
  const [competence, setCompetence] = useState(initialCompetence || currentMonth);
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(
    initialReportType && AVAILABLE_REPORTS.includes(initialReportType) ? initialReportType : null,
  );
  // Lista de presenca: turma e aula escolhidas no proprio relatorio.
  const [sheet, setSheet] = useState<{ classGroupId?: string; sessionId?: string }>({});

  const hasFeature = useHasFeature();
  const hasAdvancedReports = hasFeature("reports_advanced");

  const isProReport =
    selectedReport === "financial_income_statement" || selectedReport === "churn_retention";

  const { data: reportResult, isLoading } = useReportData(
    selectedReport && (!isProReport || hasAdvancedReports) ? selectedReport : null,
    selectedReport === "attendance_sheet" ? { competence, ...sheet } : { competence },
  );
  const openReport = (type: ReportType | null) => {
    setSheet({});
    setSelectedReport(type);
  };

  // "‹ Voltar" no padrao das telas de detalhe (o catalogo e a tela anterior, sem rota propria).
  const backButton = (
    <Button variant="ghost" className="-ml-2 gap-1" onClick={() => openReport(null)}>
      <ChevronLeft className="size-4" />
      Voltar
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Top Header (only when in catalog mode) */}
      {!selectedReport && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Relatórios
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Relatórios em PDF para imprimir ou enviar.
          </p>
        </div>
      )}

      {/* View routing: Catalog vs Document View vs Upsell Locked */}
      {!selectedReport ? (
        <ReportsCatalogTab onSelectReport={(type) => openReport(type)} />
      ) : isProReport && !hasAdvancedReports ? (
        <div className="space-y-6">
          {backButton}

          <FeatureLocked
            title="Relatórios Gerenciais Avançados"
            description="DRE do negócio com margem operacional e a retenção dos alunos mês a mês."
            benefits={[
              "DRE gerencial com receitas, despesas e margem",
              "Retenção e cancelamentos por turma",
              "PDF timbrado para contabilidade e sócios",
              "Exportação para Excel (CSV)",
            ]}
          />
        </div>
      ) : isLoading ? (
        <Card className="animate-pulse p-12 text-center text-sm text-muted-foreground">
          Gerando relatório e consolidando indicadores da competência...
        </Card>
      ) : reportResult ? (
        <ReportDocumentScreen
          report={reportResult}
          onBack={() => openReport(null)}
          onSheetChange={setSheet}
          competence={competence}
          onCompetenceChange={setCompetence}
        />
      ) : (
        <div className="p-8 text-center text-sm text-muted-foreground space-y-3">
          <p>Não foi possível carregar os dados deste relatório.</p>
          {backButton}
        </div>
      )}
    </div>
  );
}
