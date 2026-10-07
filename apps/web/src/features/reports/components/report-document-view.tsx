"use client";

import type { GeneratedReportData } from "@gestarahub/contracts";
import { formatCents, formatDate, formatDateTime, formatPhone } from "@gestarahub/core/format";
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
import { toast } from "sonner";

interface ReportDocumentViewProps {
  report: GeneratedReportData;
  onBack: () => void;
}

export function ReportDocumentView({ report, onBack }: ReportDocumentViewProps) {
  const { header } = report.data;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM para Excel ler acentuação corretamente

    switch (report.type) {
      case "attendance_sheet": {
        csvContent += `Turma;${report.data.className}\n`;
        csvContent += `Modalidade;${report.data.modalityName}\n`;
        csvContent += `Data;${report.data.sessionDate}\n\n`;
        csvContent += "Aluno;Graduação;Presença;Check-in\n";
        report.data.rows.forEach((r) => {
          csvContent += `"${r.studentName}";"${r.belt || ""}";"${r.status === "present" ? "Presente" : "Ausente"}";"${r.checkInTime || ""}"\n`;
        });
        break;
      }
      case "students_roster": {
        csvContent += "Aluno;Telefone;Plano;Vencimento;Status;Faixa;Matrícula\n";
        report.data.rows.forEach((r) => {
          csvContent += `"${r.name}";"${formatPhone(r.phone)}";"${r.planName}";"${r.dueDay}";"${r.status}";"${r.belt || ""}";"${r.enrolledAt}"\n`;
        });
        break;
      }
      case "billing_statement": {
        csvContent += "Aluno;Vencimento;Valor;Status;Data Pagamento;Forma\n";
        report.data.rows.forEach((r) => {
          csvContent += `"${r.studentName}";"${r.dueDate}";"${(r.amountCents / 100).toFixed(2)}";"${r.status}";"${r.paidAt || ""}";"${r.paymentMethod || ""}"\n`;
        });
        break;
      }
      case "monthly_birthdays": {
        csvContent += "Dia;Aluno;Telefone;Data Nascimento;Plano\n";
        report.data.rows.forEach((r) => {
          csvContent += `"${r.day}";"${r.name}";"${formatPhone(r.phone)}";"${r.birthDate}";"${r.planName}"\n`;
        });
        break;
      }
      case "financial_income_statement": {
        csvContent += `Demonstrativo do Resultado do Exercício (DRE);${header.periodLabel}\n\n`;
        csvContent += `Receita Bruta;${(report.data.grossRevenueCents / 100).toFixed(2)}\n`;
        csvContent += `Deduções;${(report.data.deductionsCents / 100).toFixed(2)}\n`;
        csvContent += `Receita Líquida;${(report.data.netRevenueCents / 100).toFixed(2)}\n`;
        csvContent += `Despesas Operacionais;${(report.data.operatingExpensesCents / 100).toFixed(2)}\n`;
        csvContent += `Resultado Operacional;${(report.data.operationalResultCents / 100).toFixed(2)}\n`;
        csvContent += `Margem Operacional;${report.data.operatingMarginPercent}%\n\n`;
        csvContent += "Despesas Detalhadas;Valor;%\n";
        report.data.expenseCategories.forEach((cat) => {
          csvContent += `"${cat.name}";"${(cat.amountCents / 100).toFixed(2)}";"${cat.percent}%"\n`;
        });
        break;
      }
      case "churn_retention": {
        csvContent += `Análise de Churn e Retenção;${header.periodLabel}\n\n`;
        csvContent += `Alunos Início;${report.data.activeStudentsStart}\n`;
        csvContent += `Novas Matrículas;${report.data.newEnrollments}\n`;
        csvContent += `Cancelamentos;${report.data.cancellations}\n`;
        csvContent += `Alunos Fim;${report.data.activeStudentsEnd}\n`;
        csvContent += `Taxa de Churn;${report.data.churnRatePercent}%\n`;
        csvContent += `Taxa de Retenção;${report.data.retentionRatePercent}%\n`;
        break;
      }
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `relatorio-${report.type}-${header.periodLabel.replace(/\s+/g, "_")}.csv`);
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
          size="sm"
          onClick={onBack}
          className="gap-2 text-xs w-fit"
        >
          <ArrowLeft className="size-3.5" />
          Voltar aos Relatórios
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-1.5 text-xs"
          >
            <Download className="size-3.5" />
            Exportar CSV / Excel
          </Button>

          <Button
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Printer className="size-3.5" />
            Imprimir / Salvar em PDF
          </Button>
        </div>
      </div>

      {/* Printable Sheet Container */}
      <div className="bg-card print:bg-white text-card-foreground print:text-black rounded-xl border print:border-none shadow-sm print:shadow-none p-6 sm:p-10 max-w-4xl mx-auto print:max-w-none print:p-0">
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
                  Lista de Chamada & Frequência
                </h2>
                <p className="text-xs text-muted-foreground print:text-zinc-600">
                  {report.data.className} • {report.data.modalityName} ({report.data.teacherName})
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                  {report.data.totalPresent} Presentes
                </Badge>
                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300">
                  {report.data.totalAbsent} Ausentes
                </Badge>
                <Badge variant="secondary">
                  {report.data.occupancyRatePercent}% Ocupação
                </Badge>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="overflow-x-auto rounded-lg border border-border print:border-zinc-300">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 print:bg-zinc-100 text-muted-foreground print:text-zinc-700 uppercase font-semibold border-b border-border print:border-zinc-300">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Nome do Aluno</th>
                    <th className="py-2.5 px-3">Graduação</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Check-in</th>
                    <th className="py-2.5 px-3 w-40 text-center">Rubrica / Assinatura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border print:divide-zinc-200">
                  {report.data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                        Nenhum aluno registrado ou matriculado nesta turma para a data selecionada.
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
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 print:text-zinc-500">
                              <XCircle className="size-3 text-rose-500 print:hidden" />
                              Ausente
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center text-muted-foreground">{row.checkInTime || "—"}</td>
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
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                  {report.data.totalActive} Ativos
                </Badge>
                <Badge variant="outline" className="bg-amber-50 text-amber-700">
                  {report.data.totalPaused} Trancados
                </Badge>
                <Badge variant="outline" className="bg-zinc-100 text-zinc-700">
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
                    <th className="py-2.5 px-3">Faixa</th>
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
              <div className="p-3 rounded-lg border bg-emerald-50/50 text-emerald-800">
                <span className="text-[11px] block">Recebido</span>
                <span className="text-base font-bold">
                  {formatCents(report.data.totalReceivedCents)}
                </span>
              </div>
              <div className="p-3 rounded-lg border bg-amber-50/50 text-amber-800">
                <span className="text-[11px] block">Pendente</span>
                <span className="text-base font-bold">
                  {formatCents(report.data.totalPendingCents)}
                </span>
              </div>
              <div className="p-3 rounded-lg border bg-rose-50/50 text-rose-800">
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
                        <td className="py-2 px-3 text-muted-foreground">{row.paymentMethod || "—"}</td>
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

            {/* DRE Summary Table */}
            <div className="rounded-lg border border-border print:border-zinc-300 divide-y divide-border print:divide-zinc-200">
              <div className="flex items-center justify-between p-3.5 bg-muted/30 print:bg-zinc-100 font-semibold text-sm">
                <span>(+) RECEITA BRUTA OPERACIONAL</span>
                <span className="text-emerald-700 print:text-black font-bold">
                  {formatCents(report.data.grossRevenueCents)}
                </span>
              </div>

              <div className="pl-6 pr-3.5 py-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>(-) Deduções de Receita e Taxas de Gateway</span>
                <span>-{formatCents(report.data.deductionsCents)}</span>
              </div>

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
                <span className="text-[11px] text-muted-foreground block">Alunos Início</span>
                <span className="text-base font-bold text-foreground print:text-black">
                  {report.data.activeStudentsStart}
                </span>
              </div>
              <div className="p-3 rounded-lg border bg-emerald-50/50 text-emerald-800">
                <span className="text-[11px] block">Novas Matrículas</span>
                <span className="text-base font-bold flex items-center gap-1">
                  <TrendingUp className="size-4" />
                  +{report.data.newEnrollments}
                </span>
              </div>
              <div className="p-3 rounded-lg border bg-rose-50/50 text-rose-800">
                <span className="text-[11px] block">Cancelamentos</span>
                <span className="text-base font-bold flex items-center gap-1">
                  <TrendingDown className="size-4" />
                  -{report.data.cancellations}
                </span>
              </div>
              <div className="p-3 rounded-lg border bg-primary/10 text-primary">
                <span className="text-[11px] block">Taxa de Retenção</span>
                <span className="text-base font-bold">
                  {report.data.retentionRatePercent}%
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border print:border-zinc-300">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 print:bg-zinc-100 text-muted-foreground print:text-zinc-700 uppercase font-semibold border-b border-border print:border-zinc-300">
                  <tr>
                    <th className="py-2.5 px-3">Modalidade</th>
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
                        {m.churnRatePercent}%
                      </td>
                      <td className="py-2 px-3 text-center font-semibold text-emerald-600">
                        {(100 - m.churnRatePercent).toFixed(1)}%
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
