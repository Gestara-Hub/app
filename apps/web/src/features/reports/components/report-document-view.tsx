"use client";

import type { GeneratedReportData, PaymentMethod } from "@gestarahub/contracts";
import { formatCents, formatDate, formatDateTime, formatPhone, plural } from "@gestarahub/core/format";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Printer,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/labels";
import { toast } from "sonner";
import { useCan } from "@/features/auth";
import { useCategories } from "@/features/categories";
import { useModalityVocabulary, useSegmentVocabulary } from "@/features/settings";

interface ReportDocumentViewProps {
  report: GeneratedReportData;
  onBack: () => void;
  /** Lista de presenca: troca a turma ou a aula mostrada. */
  onSheetChange?: (sheet: { classGroupId?: string; sessionId?: string }) => void;
  /** Mes do relatorio ("2026-09"), para o nome do arquivo. */
  competence: string;
}

// --- CSV no formato do Excel brasileiro -------------------------------------

/** Campo entre aspas (aspas internas dobradas). */
const csvCell = (value: string | number | undefined | null) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const csvLine = (cells: (string | number | undefined | null)[]) => `${cells.map(csvCell).join(";")}\n`;
/** "250,00": o Excel em pt-BR le como numero. */
const csvMoney = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
/** "21/09/2026" (data ISO ou instante ISO). */
const csvDate = (iso?: string) => (iso ? formatDate(iso) : "");
const csvPercent = (value: number) => `${String(value).replace(".", ",")}%`;
const isPaymentMethod = (value: string): value is PaymentMethod => (PAYMENT_METHODS as string[]).includes(value);
const CHARGE_STATUS_LABEL: Record<string, string> = { paid: "Pago", pending: "Pendente", overdue: "Atrasado" };
const ROSTER_STATUS_LABEL: Record<string, string> = { active: "Ativo", paused: "Trancado", inactive: "Inativo" };
const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  present: "Presente",
  absent: "Faltou",
  justified: "Justificada",
  unmarked: "Sem marcação",
};
/** Nome do arquivo em portugues: relatorio-alunos-2026-09.csv. */
const CSV_FILE_NAME: Record<GeneratedReportData["type"], string> = {
  attendance_sheet: "lista-de-presenca",
  students_roster: "alunos",
  billing_statement: "cobrancas",
  course_summary: "cursos",
  package_summary: "pacotes",
  monthly_birthdays: "aniversariantes",
  financial_income_statement: "dre",
  churn_retention: "retencao",
};

/** "seg, 21/09 · 06:00". */
function sessionOptionLabel(date: string, start: string): string {
  const weekday = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][new Date(`${date}T12:00:00`).getDay()];
  return `${weekday}, ${date.slice(8, 10)}/${date.slice(5, 7)} · ${start}`;
}

/** "1,5%" (percentual com virgula). */
const percentText = (value: number) => `${String(value).replace(".", ",")}%`;

export function ReportDocumentView({ report, onBack, onSheetChange, competence }: ReportDocumentViewProps) {
  const { header } = report.data;
  // Lista de chamada e de uma turma: a coluna segue a modalidade dela (Faixa
  // ou Nivel). A relacao de alunos mistura modalidades: fica a palavra da area.
  const vocabulary = useSegmentVocabulary();
  const { data: categories } = useCategories();
  const sheetModalityName = report.type === "attendance_sheet" ? report.data.modalityName : undefined;
  const sheetVocabulary = useModalityVocabulary(
    sheetModalityName === undefined
      ? undefined
      : ((categories ?? []).find((c) => c.name === sheetModalityName) ?? { name: sheetModalityName }),
  );

  // Exportar (CSV e PDF/impressao) exige `reports:export`: o atendente so ve.
  const can = useCan();
  const canExport = can("reports:export");

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM para Excel ler acentuação corretamente

    switch (report.type) {
      case "attendance_sheet": {
        csvContent += csvLine(["Turma", report.data.className]);
        csvContent += csvLine(["Modalidade", report.data.modalityName]);
        csvContent += csvLine(["Aula", `${csvDate(report.data.sessionDate)} ${report.data.sessionTime}`.trim()]);
        csvContent += "\n" + csvLine(["Aluno", sheetVocabulary.level, "Presença"]);
        report.data.rows.forEach((r) => {
          csvContent += csvLine([r.studentName, r.belt, ATTENDANCE_STATUS_LABEL[r.status]]);
        });
        break;
      }
      case "students_roster": {
        csvContent += csvLine(["Aluno", "Telefone", "Plano", "Vencimento", "Situação", vocabulary.level, "Cadastro"]);
        report.data.rows.forEach((r) => {
          csvContent += csvLine([r.name, formatPhone(r.phone), r.planName, `Dia ${r.dueDay}`, ROSTER_STATUS_LABEL[r.status], r.belt, csvDate(r.enrolledAt)]);
        });
        break;
      }
      case "billing_statement": {
        csvContent += csvLine(["Aluno", "Vencimento", "Valor", "Situação", "Pago em", "Forma"]);
        report.data.rows.forEach((r) => {
          csvContent += csvLine([
            r.studentName,
            csvDate(r.dueDate),
            csvMoney(r.amountCents),
            CHARGE_STATUS_LABEL[r.status] ?? r.status,
            csvDate(r.paidAt),
            r.paymentMethod && isPaymentMethod(r.paymentMethod) ? paymentMethodLabel(r.paymentMethod) : r.paymentMethod,
          ]);
        });
        break;
      }
      case "course_summary": {
        csvContent += csvLine(["Curso", "Professor", "Início", "Fim", "Matriculados", "Concluídos", "Cancelados", "Contratado", "Recebido", "Em aberto"]);
        report.data.rows.forEach((r) => {
          csvContent += csvLine([r.className, r.teacherName, csvDate(r.startDate), csvDate(r.endDate), r.enrolled, r.completed, r.canceled, csvMoney(r.contractedCents), csvMoney(r.receivedCents), csvMoney(r.openCents)]);
        });
        break;
      }
      case "package_summary": {
        csvContent += csvLine(["Pacote", "Vendidos", "Aulas vendidas", "Aulas usadas", "Saldo de aulas", "Recebido"]);
        report.data.rows.forEach((r) => {
          csvContent += csvLine([r.packageName, r.sold, r.lessonsSold, r.lessonsUsed, r.lessonsRemaining, csvMoney(r.receivedCents)]);
        });
        break;
      }
      case "monthly_birthdays": {
        csvContent += csvLine(["Dia", "Aluno", "Telefone", "Nascimento", "Plano"]);
        report.data.rows.forEach((r) => {
          csvContent += csvLine([r.day, r.name, formatPhone(r.phone), csvDate(r.birthDate), r.planName]);
        });
        break;
      }
      case "financial_income_statement": {
        csvContent += csvLine(["Demonstrativo do Resultado do Exercício (DRE)", header.periodLabel]) + "\n";
        csvContent += csvLine(["Receita bruta", csvMoney(report.data.grossRevenueCents)]);
        csvContent += csvLine(["Deduções", csvMoney(report.data.deductionsCents)]);
        csvContent += csvLine(["Receita líquida", csvMoney(report.data.netRevenueCents)]);
        csvContent += csvLine(["Despesas operacionais", csvMoney(report.data.operatingExpensesCents)]);
        csvContent += csvLine(["Resultado operacional", csvMoney(report.data.operationalResultCents)]);
        csvContent += csvLine(["Margem operacional", csvPercent(report.data.operatingMarginPercent)]) + "\n";
        csvContent += csvLine(["Receitas", "Valor", "%"]);
        report.data.incomeCategories.forEach((cat) => {
          csvContent += csvLine([cat.name, csvMoney(cat.amountCents), csvPercent(cat.percent)]);
        });
        csvContent += "\n" + csvLine(["Despesas", "Valor", "%"]);
        report.data.expenseCategories.forEach((cat) => {
          csvContent += csvLine([cat.name, csvMoney(cat.amountCents), csvPercent(cat.percent)]);
        });
        break;
      }
      case "churn_retention": {
        csvContent += csvLine(["Retenção de alunos", header.periodLabel]) + "\n";
        csvContent += csvLine(["Alunos no início", report.data.activeStudentsStart]);
        csvContent += csvLine(["Novos", report.data.newEnrollments]);
        csvContent += csvLine(["Saíram", report.data.cancellations]);
        csvContent += csvLine(["Alunos no fim", report.data.activeStudentsEnd]);
        csvContent += csvLine(["Cancelamento", csvPercent(report.data.churnRatePercent)]);
        csvContent += csvLine(["Retenção", csvPercent(report.data.retentionRatePercent)]);
        break;
      }
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const fileDate = report.type === "attendance_sheet" ? report.data.sessionDate : competence;
    link.setAttribute("download", `relatorio-${CSV_FILE_NAME[report.type]}-${fileDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Arquivo CSV exportado com sucesso.");
  };

  return (
    <div className="space-y-6">
      {/* Action Toolbar (hidden on print) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border bg-muted/30 p-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="gap-2 text-xs w-fit"
        >
          <ArrowLeft className="size-3.5" />
          Voltar aos relatórios
        </Button>

        {canExport ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportCsv}
            className="gap-1.5 text-xs"
          >
            <Download className="size-3.5" />
            Exportar CSV
          </Button>

          <Button
            onClick={handlePrint}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Printer className="size-3.5" />
            Imprimir ou salvar PDF
          </Button>
        </div>
        ) : null}
      </div>

      {/* Printable Sheet Container */}
      <div className="bg-card print:bg-white text-card-foreground print:text-black rounded-xl border print:border-none shadow-sm print:shadow-none p-4 sm:p-10 max-w-4xl mx-auto print:max-w-none print:p-0">
        {/* Document Letterhead */}
        <div className="border-b pb-6 mb-6 print:border-zinc-300">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-foreground print:text-black">
                  {header.organizationName}
                </span>
                <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                  {header.organizationSegment}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground print:text-zinc-600 mt-1">
                {header.unitName} • GestaraHub Gestão Inteligente
              </p>
            </div>

            <div className="text-left sm:text-right space-y-0.5 text-xs text-muted-foreground print:text-zinc-600">
              <p className="font-medium text-foreground print:text-black">
                {header.periodLabel}
              </p>
              <p>Emissão: {formatDateTime(header.generatedAt)}</p>
              <p>Responsável: {header.generatedBy}</p>
            </div>
          </div>
        </div>

        {/* Dynamic Report Content based on Report Type */}
        {report.type === "attendance_sheet" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground print:text-black">
                  Lista de presença
                </h2>
                <p className="text-xs text-muted-foreground print:text-zinc-600">
                  {[
                    report.data.className,
                    report.data.modalityName !== "—" ? report.data.modalityName : null,
                    report.data.teacherName !== "—" ? report.data.teacherName : null,
                    report.data.sessionId
                      ? sessionOptionLabel(report.data.sessionDate, report.data.sessionTime)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  {plural(report.data.totalPresent, "presente", "presentes")}
                </Badge>
                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                  {plural(report.data.totalAbsent, "falta", "faltas")}
                </Badge>
                {report.data.totalJustified > 0 ? (
                  <Badge variant="outline">{plural(report.data.totalJustified, "justificada", "justificadas")}</Badge>
                ) : null}
                {report.data.totalUnmarked > 0 ? (
                  <Badge variant="secondary">{plural(report.data.totalUnmarked, "sem marcação", "sem marcação")}</Badge>
                ) : null}
              </div>
            </div>

            {/* Turma e aula (fora da impressao) */}
            {onSheetChange && report.data.classOptions.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 print:hidden">
                <Select
                  value={report.data.classGroupId}
                  onValueChange={(classGroupId) => onSheetChange({ classGroupId })}
                >
                  <SelectTrigger aria-label="Turma" className="w-full">
                    <SelectValue placeholder="Turma" />
                  </SelectTrigger>
                  <SelectContent>
                    {report.data.classOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={report.data.sessionId}
                  onValueChange={(sessionId) =>
                    onSheetChange({ classGroupId: report.data.classGroupId, sessionId })
                  }
                  disabled={report.data.sessionOptions.length === 0}
                >
                  <SelectTrigger aria-label="Aula" className="w-full">
                    <SelectValue placeholder="Nenhuma aula neste mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...report.data.sessionOptions].reverse().map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {sessionOptionLabel(option.date, option.start)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {/* Attendance Table */}
            <div className="overflow-x-auto rounded-lg border border-border print:border-zinc-300">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 print:bg-zinc-100 text-muted-foreground print:text-zinc-700 uppercase font-semibold border-b border-border print:border-zinc-300">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Nome do Aluno</th>
                    <th className="py-2.5 px-3">{sheetVocabulary.level}</th>
                    <th className="py-2.5 px-3 text-center">Presença</th>
                    <th className="py-2.5 px-3 w-40 text-center">Assinatura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border print:divide-zinc-200">
                  {report.data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground text-xs">
                        {report.data.sessionId ? "Nenhum aluno nesta aula." : "Nenhuma aula desta turma neste mês."}
                      </td>
                    </tr>
                  ) : (
                    report.data.rows.map((row, idx) => (
                      <tr key={row.studentId} className="hover:bg-muted/20 print:hover:bg-transparent">
                        <td className="py-2 px-3 text-center text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 px-3 font-medium text-foreground print:text-black">{row.studentName}</td>
                        <td className="py-2 px-3 text-muted-foreground">{row.belt || "—"}</td>
                        <td className="py-2 px-3 text-center">
                          {row.status === "present" ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 print:text-black">
                              <CheckCircle2 className="size-3 text-emerald-600 print:hidden" />
                              Presente
                            </span>
                          ) : row.status === "absent" ? (
                            <span className="inline-flex items-center gap-1 text-rose-600 print:text-zinc-500">
                              <XCircle className="size-3 text-rose-500 print:hidden" />
                              Faltou
                            </span>
                          ) : (
                            <span className="text-muted-foreground print:text-zinc-500">
                              {ATTENDANCE_STATUS_LABEL[row.status]}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 border-l border-border print:border-zinc-300"></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {report.type === "students_roster" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground print:text-black">
                  Relação Geral de Alunos
                </h2>
                <p className="text-xs text-muted-foreground print:text-zinc-600">
                  Cadastro ativo, planos e situação de matrícula.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {report.data.totalActive} Ativos
                </Badge>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  {report.data.totalPaused} Trancados
                </Badge>
                <Badge variant="outline" className="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {report.data.totalInactive} Inativos
                </Badge>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border print:border-zinc-300">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 print:bg-zinc-100 text-muted-foreground print:text-zinc-700 uppercase font-semibold border-b border-border print:border-zinc-300">
                  <tr>
                    <th className="py-2.5 px-3">Aluno</th>
                    <th className="py-2.5 px-3">Telefone</th>
                    <th className="py-2.5 px-3">Plano</th>
                    <th className="py-2.5 px-3 text-center">Venc.</th>
                    <th className="py-2.5 px-3">{vocabulary.level}</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border print:divide-zinc-200">
                  {report.data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                        Nenhum aluno cadastrado no momento. Cadastre alunos na aba Alunos.
                      </td>
                    </tr>
                  ) : (
                    report.data.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/20">
                        <td className="py-2 px-3 font-medium text-foreground print:text-black">{row.name}</td>
                        <td className="py-2 px-3 text-muted-foreground">{formatPhone(row.phone)}</td>
                        <td className="py-2 px-3 text-muted-foreground">{row.planName}</td>
                        <td className="py-2 px-3 text-center text-muted-foreground">Dia {row.dueDay}</td>
                        <td className="py-2 px-3 text-muted-foreground">{row.belt || "—"}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="capitalize text-xs font-semibold">
                            {row.status === "active" ? "Ativo" : row.status === "paused" ? "Trancado" : "Inativo"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {report.type === "billing_statement" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground print:text-black">
                Extrato de Mensalidades & Inadimplência
              </h2>
              <p className="text-xs text-muted-foreground print:text-zinc-600">
                Consolidação de cobranças da competência com taxa de inadimplência.
              </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">Total Faturado</span>
                <span className="text-base font-bold text-foreground print:text-black">
                  {formatCents(report.data.totalBilledCents)}
                </span>
              </div>
              <div className="p-3 rounded-lg border bg-emerald-50/50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <span className="text-[11px] block">Recebido</span>
                <span className="text-base font-bold">
                  {formatCents(report.data.totalReceivedCents)}
                </span>
              </div>
              <div className="p-3 rounded-lg border bg-amber-50/50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <span className="text-[11px] block">Pendente</span>
                <span className="text-base font-bold">
                  {formatCents(report.data.totalPendingCents)}
                </span>
              </div>
              <div className="p-3 rounded-lg border bg-rose-50/50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                <span className="text-[11px] block">Inadimplência</span>
                <span className="text-base font-bold">
                  {report.data.defaultRatePercent}% ({formatCents(report.data.totalOverdueCents)})
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border print:border-zinc-300">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 print:bg-zinc-100 text-muted-foreground print:text-zinc-700 uppercase font-semibold border-b border-border print:border-zinc-300">
                  <tr>
                    <th className="py-2.5 px-3">Aluno</th>
                    <th className="py-2.5 px-3">Vencimento</th>
                    <th className="py-2.5 px-3 text-right">Valor</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Pagamento</th>
                    <th className="py-2.5 px-3">Forma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border print:divide-zinc-200">
                  {report.data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                        Nenhuma cobrança registrada nesta competência.
                      </td>
                    </tr>
                  ) : (
                    report.data.rows.map((row) => (
                      <tr key={row.chargeId} className="hover:bg-muted/20">
                        <td className="py-2 px-3 font-medium text-foreground print:text-black">{row.studentName}</td>
                        <td className="py-2 px-3 text-muted-foreground">{formatDate(row.dueDate)}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatCents(row.amountCents)}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`font-semibold ${
                            row.status === "paid" ? "text-emerald-600" : row.status === "overdue" ? "text-rose-600" : "text-amber-600"
                          }`}>
                            {row.status === "paid" ? "Pago" : row.status === "overdue" ? "Atrasado" : "Pendente"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center text-muted-foreground">
                          {row.paidAt ? formatDate(row.paidAt) : "—"}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {row.paymentMethod
                            ? isPaymentMethod(row.paymentMethod)
                              ? paymentMethodLabel(row.paymentMethod)
                              : row.paymentMethod
                            : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {report.type === "course_summary" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground print:text-black">Cursos</h2>
              <p className="text-xs text-muted-foreground print:text-zinc-600">
                Cursos com aulas ou parcelas no mês. Valores do curso inteiro.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">Contratado</span>
                <span className="text-base font-bold text-foreground print:text-black">
                  {formatCents(report.data.totalContractedCents)}
                </span>
              </div>
              <div className="p-3 rounded-lg border bg-emerald-50/50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <span className="text-[11px] block">Recebido</span>
                <span className="text-base font-bold">{formatCents(report.data.totalReceivedCents)}</span>
              </div>
              <div className="p-3 rounded-lg border bg-amber-50/50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <span className="text-[11px] block">Em aberto</span>
                <span className="text-base font-bold">{formatCents(report.data.totalOpenCents)}</span>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">Recebido no mês</span>
                <span className="text-base font-bold text-foreground print:text-black">
                  {formatCents(report.data.receivedInPeriodCents)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border print:border-zinc-300">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 print:bg-zinc-100 text-muted-foreground print:text-zinc-700 uppercase font-semibold border-b border-border print:border-zinc-300">
                  <tr>
                    <th className="py-2.5 px-3">Curso</th>
                    <th className="py-2.5 px-3 text-center">Matriculados</th>
                    <th className="py-2.5 px-3 text-center">Concluídos</th>
                    <th className="py-2.5 px-3 text-center">Cancelados</th>
                    <th className="py-2.5 px-3 text-right">Contratado</th>
                    <th className="py-2.5 px-3 text-right">Recebido</th>
                    <th className="py-2.5 px-3 text-right">Em aberto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border print:divide-zinc-200">
                  {report.data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                        Nenhum curso com aulas ou parcelas neste mês.
                      </td>
                    </tr>
                  ) : (
                    report.data.rows.map((row) => (
                      <tr key={row.classGroupId} className="hover:bg-muted/20">
                        <td className="py-2 px-3">
                          <span className="block font-medium text-foreground print:text-black">{row.className}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {[
                              row.teacherName,
                              row.endDate
                                ? `${formatDate(row.startDate)} a ${formatDate(row.endDate)}`
                                : `Desde ${formatDate(row.startDate)}`,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">{row.enrolled}</td>
                        <td className="py-2 px-3 text-center">{row.completed}</td>
                        <td className="py-2 px-3 text-center">{row.canceled}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatCents(row.contractedCents)}</td>
                        <td className="py-2 px-3 text-right text-emerald-700">{formatCents(row.receivedCents)}</td>
                        <td className="py-2 px-3 text-right text-amber-700">{formatCents(row.openCents)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {report.type === "package_summary" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground print:text-black">Pacotes de aulas</h2>
              <p className="text-xs text-muted-foreground print:text-zinc-600">
                Vendas, aulas usadas e recebido no mês. Saldo de hoje.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">Vendidos</span>
                <span className="text-base font-bold text-foreground print:text-black">{report.data.totalSold}</span>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">Aulas usadas</span>
                <span className="text-base font-bold text-foreground print:text-black">
                  {report.data.totalLessonsUsed}
                </span>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">Saldo de aulas</span>
                <span className="text-base font-bold text-foreground print:text-black">
                  {report.data.totalLessonsRemaining}
                </span>
              </div>
              <div className="p-3 rounded-lg border bg-emerald-50/50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <span className="text-[11px] block">Recebido</span>
                <span className="text-base font-bold">{formatCents(report.data.totalReceivedCents)}</span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border print:border-zinc-300">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 print:bg-zinc-100 text-muted-foreground print:text-zinc-700 uppercase font-semibold border-b border-border print:border-zinc-300">
                  <tr>
                    <th className="py-2.5 px-3">Pacote</th>
                    <th className="py-2.5 px-3 text-center">Vendidos</th>
                    <th className="py-2.5 px-3 text-center">Aulas vendidas</th>
                    <th className="py-2.5 px-3 text-center">Aulas usadas</th>
                    <th className="py-2.5 px-3 text-center">Saldo</th>
                    <th className="py-2.5 px-3 text-right">Recebido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border print:divide-zinc-200">
                  {report.data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                        Nenhum pacote vendido, usado ou pago neste mês.
                      </td>
                    </tr>
                  ) : (
                    report.data.rows.map((row) => (
                      <tr key={row.packageId} className="hover:bg-muted/20">
                        <td className="py-2 px-3 font-medium text-foreground print:text-black">{row.packageName}</td>
                        <td className="py-2 px-3 text-center">{row.sold}</td>
                        <td className="py-2 px-3 text-center">{row.lessonsSold}</td>
                        <td className="py-2 px-3 text-center">{row.lessonsUsed}</td>
                        <td className="py-2 px-3 text-center">{row.lessonsRemaining}</td>
                        <td className="py-2 px-3 text-right text-emerald-700">{formatCents(row.receivedCents)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {report.type === "monthly_birthdays" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground print:text-black">
                  Aniversariantes do Mês ({report.data.monthName})
                </h2>
                <p className="text-xs text-muted-foreground print:text-zinc-600">
                  Alunos aniversariantes para homenagens, congratulações e campanhas.
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {report.data.totalBirthdays} Aniversariantes
              </Badge>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border print:border-zinc-300">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 print:bg-zinc-100 text-muted-foreground print:text-zinc-700 uppercase font-semibold border-b border-border print:border-zinc-300">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-16">Dia</th>
                    <th className="py-2.5 px-3">Nome do Aluno</th>
                    <th className="py-2.5 px-3">WhatsApp</th>
                    <th className="py-2.5 px-3">Data Nascimento</th>
                    <th className="py-2.5 px-3">Plano Atual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border print:divide-zinc-200">
                  {report.data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground text-xs">
                        Nenhum aluno aniversariante cadastrado neste mês.
                      </td>
                    </tr>
                  ) : (
                    report.data.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 text-center font-bold text-primary print:text-black">
                          {String(row.day).padStart(2, "0")}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-foreground print:text-black">{row.name}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{formatPhone(row.phone)}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{formatDate(row.birthDate)}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{row.planName}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {report.type === "financial_income_statement" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground print:text-black">
                Demonstrativo de Resultado do Exercício (DRE)
              </h2>
              <p className="text-xs text-muted-foreground print:text-zinc-600">
                Visão contábil e gerencial do lucro operacional e estrutura de custos.
              </p>
            </div>

            {report.data.grossRevenueCents === 0 && report.data.operatingExpensesCents === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Sem recebimentos nem despesas pagas neste mês.
              </p>
            ) : (
            <div className="rounded-lg border border-border print:border-zinc-300 divide-y divide-border print:divide-zinc-200">
              <div className="flex items-center justify-between p-3.5 bg-muted/30 print:bg-zinc-100 font-semibold text-sm">
                <span>(+) RECEITA BRUTA OPERACIONAL</span>
                <span className="text-emerald-700 print:text-black font-bold">
                  {formatCents(report.data.grossRevenueCents)}
                </span>
              </div>

              {/* Uma linha por origem (mensalidades, cursos, pacotes, avulsas, receitas manuais) */}
              {report.data.incomeCategories.length > 0 ? (
                <div className="divide-y divide-border/60 pl-6 pr-3.5 text-xs text-muted-foreground">
                  {report.data.incomeCategories.map((cat) => (
                    <div key={cat.name} className="py-2 flex items-center justify-between">
                      <span>{cat.name} ({cat.percent}%)</span>
                      <span>{formatCents(cat.amountCents)}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {report.data.deductionsCents > 0 ? (
                <div className="pl-6 pr-3.5 py-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>(-) Taxas de pagamento</span>
                  <span>-{formatCents(report.data.deductionsCents)}</span>
                </div>
              ) : null}

              <div className="flex items-center justify-between p-3.5 bg-emerald-50/30 print:bg-transparent font-semibold text-sm">
                <span>(=) RECEITA LÍQUIDA OPERACIONAL</span>
                <span className="font-bold text-foreground print:text-black">
                  {formatCents(report.data.netRevenueCents)}
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-rose-50/20 print:bg-transparent font-semibold text-sm text-rose-800 print:text-black">
                <span>(-) DESPESAS OPERACIONAIS</span>
                <span className="font-bold">
                  -{formatCents(report.data.operatingExpensesCents)}
                </span>
              </div>

              {/* Sub-breakdown */}
              <div className="divide-y divide-border/60 pl-6 pr-3.5 text-xs text-muted-foreground">
                {report.data.expenseCategories.map((cat) => (
                  <div key={cat.name} className="py-2 flex items-center justify-between">
                    <span>{cat.name} ({cat.percent}%)</span>
                    <span>{formatCents(cat.amountCents)}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between p-4 bg-primary/10 print:bg-zinc-100 font-extrabold text-base">
                <span>(=) RESULTADO OPERACIONAL LÍQUIDO</span>
                <div className="text-right">
                  <span className="text-primary print:text-black">
                    {formatCents(report.data.operationalResultCents)}
                  </span>
                  <span className="block text-[11px] font-normal text-muted-foreground print:text-zinc-600">
                    Margem Líquida: {report.data.operatingMarginPercent}%
                  </span>
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        {report.type === "churn_retention" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground print:text-black">
                Análise de Retenção & Churn de Alunos
              </h2>
              <p className="text-xs text-muted-foreground print:text-zinc-600">
                Comportamento da base de alunos, adesão e cancelamentos.
              </p>
            </div>

            {/* Churn Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">Alunos no início</span>
                <span className="text-base font-bold text-foreground print:text-black">
                  {report.data.activeStudentsStart}
                </span>
              </div>
              <div className="p-3 rounded-lg border bg-emerald-50/50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <span className="text-[11px] block">Novos</span>
                <span className="text-base font-bold flex items-center gap-1">
                  <TrendingUp className="size-4" />
                  +{report.data.newEnrollments}
                </span>
              </div>
              <div className="p-3 rounded-lg border bg-rose-50/50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                <span className="text-[11px] block">Saíram</span>
                <span className="text-base font-bold flex items-center gap-1">
                  <TrendingDown className="size-4" />
                  -{report.data.cancellations}
                </span>
              </div>
              <div className="p-3 rounded-lg border bg-primary/10 text-primary">
                <span className="text-[11px] block">Retenção</span>
                <span className="text-base font-bold">
                  {percentText(report.data.retentionRatePercent)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border print:border-zinc-300">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 print:bg-zinc-100 text-muted-foreground print:text-zinc-700 uppercase font-semibold border-b border-border print:border-zinc-300">
                  <tr>
                    <th className="py-2.5 px-3">Turma</th>
                    <th className="py-2.5 px-3 text-center">Alunos Ativos</th>
                    <th className="py-2.5 px-3 text-center">Taxa de Churn</th>
                    <th className="py-2.5 px-3 text-center">Retenção</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border print:divide-zinc-200">
                  {report.data.modalitiesBreakdown.map((m) => (
                    <tr key={m.modalityName} className="hover:bg-muted/20">
                      <td className="py-2 px-3 font-medium text-foreground print:text-black">{m.modalityName}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground">{m.activeCount}</td>
                      <td className="py-2 px-3 text-center font-semibold text-rose-600">
                        {percentText(m.churnRatePercent)}
                      </td>
                      <td className="py-2 px-3 text-center font-semibold text-emerald-600">
                        {percentText(Math.round((100 - m.churnRatePercent) * 10) / 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Document Footer */}
        <div className="mt-12 pt-6 border-t border-border print:border-zinc-300 text-[10px] text-muted-foreground print:text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>
            Documento gerado eletronicamente pelo GestaraHub em {formatDateTime(header.generatedAt)}.
          </span>
          <div className="print:block hidden border-t border-zinc-400 w-48 text-center pt-1">
            Assinatura do Responsável
          </div>
        </div>
      </div>
    </div>
  );
}
