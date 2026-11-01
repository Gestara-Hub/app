"use client";

import { useTeamWords } from "@/features/settings";
import type { DocumentModel, GeneratedReportData } from "@gestarahub/contracts";
import { ChevronLeft, Download, FileText } from "lucide-react";
import { toast } from "@/lib/toast";
import { DocumentPreview } from "@/components/shared/document-preview";
import { Button } from "@/components/ui/button";
import { documentToCsv } from "@/lib/documents/csv";
import { reportToDocument } from "@/lib/documents/report-documents";
import { isSupabaseOrganization } from "@/lib/session";
import { useCan, useCurrentUser } from "@/features/auth";
import { useCategories } from "@/features/categories";
import { CompetencePicker } from "@/features/finance";
import { useModalityVocabulary, useSegmentVocabulary } from "@/features/settings";
import { AttendanceSheetPicker } from "./attendance-sheet-picker";

interface ReportDocumentScreenProps {
  report: GeneratedReportData;
  onBack: () => void;
  /** Lista de presenca: troca a turma ou a aula mostrada. */
  onSheetChange?: (sheet: { classGroupId?: string; sessionId?: string }) => void;
  /** Mes do relatorio ("2026-10"). */
  competence: string;
  /** O mes se escolhe aqui dentro (01/11/2026), nao no catalogo: todos os relatorios sao do mes. */
  onCompetenceChange: (competence: string) => void;
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
export function ReportDocumentScreen({ report, onBack, onSheetChange, competence, onCompetenceChange }: ReportDocumentScreenProps) {
  const team = useTeamWords();
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
    teacherLabel: team.title,
    levelLabelForModality: () => sheetVocabulary.level,
  });
  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Button variant="ghost" className="-ml-2 gap-1" onClick={onBack}>
          <ChevronLeft className="size-4" />
          Voltar
        </Button>
      </div>
      {/* Titulo, o mes (escolhido aqui) e as saidas; o cabecalho do documento repete o titulo na folha. */}
      <div className="print:hidden flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{model.title}</h1>
          <CompetencePicker competence={competence} onChange={onCompetenceChange} label="Mês" />
        </div>

        {canExport ? (
          <div className="flex flex-wrap items-center gap-2">
            {serverDocuments ? (
              <>
                <Button variant="outline" asChild className="gap-1.5">
                  <a href={documentUrl(report, competence, "csv")} download>
                    <Download className="size-4" />
                    Exportar CSV
                  </a>
                </Button>
                <Button asChild className="gap-1.5">
                  <a href={documentUrl(report, competence, "pdf")} target="_blank" rel="noopener">
                    <FileText className="size-4" />
                    Baixar PDF
                  </a>
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => downloadCsv(model)} className="gap-1.5">
                  <Download className="size-4" />
                  Exportar CSV
                </Button>
                <Button onClick={() => window.print()} className="gap-1.5">
                  <FileText className="size-4" />
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
