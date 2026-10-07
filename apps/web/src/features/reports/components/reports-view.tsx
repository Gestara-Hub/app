"use client";

import { useState } from "react";
import type { ReportType } from "@gestarahub/contracts";
import { FeatureLocked } from "@/components/shared/feature-locked";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useHasFeature } from "@/features/auth";
import { useReportData } from "../hooks/use-reports";
import { ReportDocumentView } from "./report-document-view";
import { ReportsCatalogTab } from "./reports-catalog-tab";

interface ReportsViewProps {
  initialReportType?: ReportType | null;
  initialCompetence?: string;
}

export function ReportsView({
  initialReportType = null,
  initialCompetence,
}: ReportsViewProps) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [competence, setCompetence] = useState(initialCompetence || currentMonth);
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(initialReportType);

  const hasFeature = useHasFeature();
  const hasAdvancedReports = hasFeature("reports_advanced");

  const isProReport =
    selectedReport === "financial_income_statement" ||
    selectedReport === "churn_retention" ||
    selectedReport === "revenue_forecast" ||
    selectedReport === "teacher_performance";

  const { data: reportResult, isLoading } = useReportData(
    selectedReport && (!isProReport || hasAdvancedReports) ? selectedReport : null,
    { competence },
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
            Gere e exporte relatórios operacionais em PDF com layout timbrado para impressão e DRE gerencial completa.
          </p>
        </div>
      )}

      {/* View routing: Catalog vs Document View vs Upsell Locked */}
      {!selectedReport ? (
        <ReportsCatalogTab
          onSelectReport={(type) => setSelectedReport(type)}
          competence={competence}
          onCompetenceChange={setCompetence}
        />
      ) : isProReport && !hasAdvancedReports ? (
        <div className="space-y-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedReport(null)}
            className="text-xs"
          >
            ← Voltar ao Catálogo de Relatórios
          </Button>

          <FeatureLocked
            title="Relatórios Gerenciais Avançados"
            description="Tome decisões com base em números precisos. Tenha acesso a DRE Completa do negócio, margem operacional líquida, análise de retenção de alunos e faturamento previsto."
            benefits={[
              "DRE Gerencial Completa com margens líquidas e operacionais",
              "Análise de Retenção e taxa de Churn por modalidade/graduação",
              "Projeção de fluxo de caixa futuro e recebíveis",
              "Exportação em PDF timbrado para contabilidade e sócios",
              "Exportação de dados analíticos para Excel/CSV",
            ]}
          />
        </div>
      ) : isLoading ? (
        <Card className="animate-pulse p-12 text-center text-sm text-muted-foreground">
          Gerando relatório e consolidando indicadores da competência...
        </Card>
      ) : reportResult ? (
        <ReportDocumentView
          report={reportResult}
          onBack={() => setSelectedReport(null)}
        />
      ) : (
        <div className="p-8 text-center text-sm text-muted-foreground space-y-3">
          <p>Não foi possível carregar os dados deste relatório.</p>
          <Button variant="outline" size="sm" onClick={() => setSelectedReport(null)}>
            Voltar ao Catálogo
          </Button>
        </div>
      )}
    </div>
  );
}
