"use client";

import type { DocumentModel, GeneratedReportData } from "@gestarahub/contracts";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { DocumentPreview } from "@/components/shared/document-preview";
import { Button } from "@/components/ui/button";
import { documentToCsv } from "@/lib/documents/csv";
import { reportToDocument } from "@/lib/documents/report-documents";
import { isSupabaseOrganization } from "@/lib/session";
import { useCan, useCurrentUser } from "@/features/auth";
import { useCategories } from "@/features/categories";
import { useModalityVocabulary, useSegmentVocabulary } from "@/features/settings";
import { AttendanceSheetPicker } from "./attendance-sheet-picker";
import { ReportDocumentView } from "./report-document-view";

interface ReportDocumentScreenProps {
  report: GeneratedReportData;
  onBack: () => void;
  /** Lista de presenca: troca a turma ou a aula mostrada. */
  onSheetChange?: (sheet: { classGroupId?: string; sessionId?: string }) => void;
  /** Mes do relatorio ("2026-10"). */
  competence: string;
}

/** Endereco do PDF ou do CSV gerado no servidor, com os mesmos filtros da tela. */
function documentUrl(report: GeneratedReportData, competence: string, format: "pdf" | "csv"): string {
  const params = new URLSearchParams({ competencia: competence });
  if (report.type === "attendance_sheet") {
    if (report.data.classGroupId) params.set("turma", report.data.classGroupId);
    if (report.data.sessionId) params.set("aula", report.data.sessionId);
  }
  if (format === "csv") params.set("formato", "csv");
  return `/api/documents/reports/${report.type}?${params.toString()}`;
}

/** Conta de demonstracao (dados no navegador): o CSV sai daqui mesmo. */
function downloadCsv(model: DocumentModel) {
  const blob = new Blob([documentToCsv(model)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${model.fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success("Arquivo CSV exportado com sucesso.");
}

/**
 * Relatorio aberto: previa no layout unico dos documentos e os botoes que
 * baixam o PDF e o CSV gerados no servidor. Na conta de demonstracao (sem
 * banco) o PDF sai pela impressao do navegador.
 */
export function ReportDocumentScreen({ report, onBack, onSheetChange, competence }: ReportDocumentScreenProps) {
  const user = useCurrentUser();
  const can = useCan();
  const canExport = can("reports:export");
  const serverDocuments = isSupabaseOrganization(user.organizationId);

  const vocabulary = useSegmentVocabulary();
  const { data: categories } = useCategories();
  const sheetModalityName = report.type === "attendance_sheet" ? report.data.modalityName : undefined;
  const sheetVocabulary = useModalityVocabulary(
    sheetModalityName === undefined
      ? undefined
      : ((categories ?? []).find((c) => c.name === sheetModalityName) ?? { name: sheetModalityName }),
  );

  const model = reportToDocument(report, competence, {
    levelLabel: vocabulary.level,
    levelLabelForModality: () => sheetVocabulary.level,
  });
  if (!model) {
    return <ReportDocumentView report={report} onBack={onBack} onSheetChange={onSheetChange} competence={competence} />;
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-col justify-between gap-4 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center">
        <Button variant="outline" onClick={onBack} className="w-fit gap-2 text-xs">
          <ArrowLeft className="size-3.5" />
          Voltar aos relatórios
        </Button>

        {canExport ? (
          <div className="flex flex-wrap items-center gap-2">
            {serverDocuments ? (
              <>
                <Button variant="outline" asChild className="gap-1.5 text-xs">
                  <a href={documentUrl(report, competence, "csv")} download>
                    <Download className="size-3.5" />
                    Exportar CSV
                  </a>
                </Button>
                <Button asChild className="gap-1.5 text-xs shadow-xs">
                  <a href={documentUrl(report, competence, "pdf")} target="_blank" rel="noopener">
                    <FileText className="size-3.5" />
                    Baixar PDF
                  </a>
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => downloadCsv(model)} className="gap-1.5 text-xs">
                  <Download className="size-3.5" />
                  Exportar CSV
                </Button>
                <Button onClick={() => window.print()} className="gap-1.5 text-xs shadow-xs">
                  <FileText className="size-3.5" />
                  Baixar PDF
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {report.type === "attendance_sheet" && onSheetChange ? (
        <AttendanceSheetPicker data={report.data} onSheetChange={onSheetChange} />
      ) : null}

      <DocumentPreview model={model} className="print:max-w-none print:rounded-none print:border-none print:shadow-none" />
    </div>
  );
}
