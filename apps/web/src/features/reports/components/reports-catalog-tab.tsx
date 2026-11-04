"use client";

import type { ReportCategory, ReportMetadata, ReportType } from "@gestarahub/contracts";
import {
  Cake,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  Lock,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { ListContainer, ListRow } from "@/components/shared/list";
import { Skeleton } from "@/components/ui/skeleton";
import { useCan, useHasFeature } from "@/features/auth";
import { useReportsCatalog } from "../hooks/use-reports";

interface ReportsCatalogTabProps {
  onSelectReport: (reportType: ReportType) => void;
}

/** Grupos na ordem da tela; o nome e o que o usuario le como titulo do bloco. */
const CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: "operational", label: "Operacionais" },
  { value: "financial", label: "Financeiros" },
  { value: "retention", label: "Retenção" },
];

function ReportIcon({ name }: { name: string }) {
  const className = "size-5";
  switch (name) {
    case "ClipboardCheck":
      return <ClipboardCheck className={`${className} text-sky-500`} />;
    case "Users":
      return <Users className={`${className} text-indigo-500`} />;
    case "Wallet":
      return <Wallet className={`${className} text-emerald-500`} />;
    case "Cake":
      return <Cake className={`${className} text-amber-500`} />;
    case "GraduationCap":
      return <GraduationCap className={`${className} text-teal-500`} />;
    case "Ticket":
      return <Ticket className={`${className} text-orange-500`} />;
    case "FileSpreadsheet":
      return <FileSpreadsheet className={`${className} text-purple-500`} />;
    case "TrendingUp":
      return <TrendingUp className={`${className} text-rose-500`} />;
    default:
      return <FileSpreadsheet className={`${className} text-primary`} />;
  }
}

/**
 * Catalogo de relatorios (revisao de 01/11/2026): uma linha por relatorio,
 * agrupadas por categoria, a linha inteira abre. Sem busca nem mes: sao 8
 * itens fixos, e o mes se escolhe dentro do relatorio aberto. Os do Plano
 * Profissional ficam no grupo deles, com cadeado; clicar abre o convite.
 */
export function ReportsCatalogTab({ onSelectReport }: ReportsCatalogTabProps) {
  const { data: catalog = [], isLoading } = useReportsCatalog();
  const hasFeature = useHasFeature();
  const hasAdvancedReports = hasFeature("reports_advanced");
  const can = useCan();

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy>
        {[3, 1, 1].map((rows, group) => (
          <div key={group} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <div className="divide-y rounded-xl border">
              {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                  <Skeleton className="size-9 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const visibleCatalog = catalog.filter(
    (r) => !r.permissionRequired || can(r.permissionRequired),
  );

  const groups = CATEGORIES.map((category) => ({
    ...category,
    reports: visibleCatalog.filter((r) => r.category === category.value),
  })).filter((g) => g.reports.length > 0);

  return (
    <div className="space-y-6" data-testid="reports-catalog">
      {groups.map((group) => (
        <section key={group.value} className="space-y-2" aria-labelledby={`reports-group-${group.value}`}>
          <h2 id={`reports-group-${group.value}`} className="text-sm font-medium text-muted-foreground">
            {group.label}
          </h2>
          <ListContainer>
            {group.reports.map((report) => (
              <ReportRow
                key={report.type}
                report={report}
                locked={report.tierRequired === "pro" && !hasAdvancedReports}
                onOpen={() => onSelectReport(report.type)}
              />
            ))}
          </ListContainer>
        </section>
      ))}
    </div>
  );
}

function ReportRow({ report, locked, onOpen }: { report: ReportMetadata; locked: boolean; onOpen: () => void }) {
  return (
    <ListRow
      onClick={onOpen}
      className={locked ? "bg-muted/15" : undefined}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background shadow-2xs">
          <ReportIcon name={report.iconName} />
        </span>
        <div className="min-w-0 flex-1">
          <span className="sr-only">{locked ? "Ver no Plano Profissional: " : "Abrir "}</span>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium text-foreground">
            <span className="min-w-0 break-words">{report.title}</span>
            {report.tierRequired === "pro" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
                {locked ? <Lock className="size-3" aria-hidden /> : null}
                Plano Profissional
              </span>
            ) : null}
          </p>
          <p className="min-w-0 break-words text-xs text-muted-foreground">{report.description}</p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
    </ListRow>
  );
}
