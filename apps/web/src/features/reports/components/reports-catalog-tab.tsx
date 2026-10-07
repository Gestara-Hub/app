"use client";

import { useMemo, useState } from "react";
import type { ReportType } from "@gestarahub/contracts";
import {
  Cake,
  Calendar,
  ClipboardCheck,
  FileSpreadsheet,
  Lock,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useHasFeature } from "@/features/auth";
import { useReportsCatalog } from "../hooks/use-reports";

interface ReportsCatalogTabProps {
  onSelectReport: (reportType: ReportType) => void;
  competence: string;
  onCompetenceChange: (competence: string) => void;
}

export function ReportsCatalogTab({
  onSelectReport,
  competence,
  onCompetenceChange,
}: ReportsCatalogTabProps) {
  const { data: catalog = [], isLoading } = useReportsCatalog();
  const hasFeature = useHasFeature();
  const hasAdvancedReports = hasFeature("reports_advanced");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filteredCatalog = useMemo(() => {
    return catalog.filter((r) => {
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [catalog, categoryFilter, search]);

  const getReportIcon = (iconName: string) => {
    switch (iconName) {
      case "ClipboardCheck":
        return <ClipboardCheck className="size-5 text-sky-500" />;
      case "Users":
        return <Users className="size-5 text-indigo-500" />;
      case "Wallet":
        return <Wallet className="size-5 text-emerald-500" />;
      case "Cake":
        return <Cake className="size-5 text-amber-500" />;
      case "FileSpreadsheet":
        return <FileSpreadsheet className="size-5 text-purple-500" />;
      case "TrendingUp":
        return <TrendingUp className="size-5 text-rose-500" />;
      default:
        return <FileSpreadsheet className="size-5 text-primary" />;
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse h-44 bg-muted/20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Period Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar relatórios por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5" />
            <span>Mês de Referência:</span>
          </div>
          <Input
            type="month"
            value={competence}
            onChange={(e) => onCompetenceChange(e.target.value)}
            className="w-36 text-xs h-9"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <Button
          variant={categoryFilter === "all" ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setCategoryFilter("all")}
        >
          Todos os Relatórios ({catalog.length})
        </Button>
        <Button
          variant={categoryFilter === "operational" ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setCategoryFilter("operational")}
        >
          Operacionais (Free)
        </Button>
        <Button
          variant={categoryFilter === "financial" ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setCategoryFilter("financial")}
        >
          Financeiros (DRE)
        </Button>
        <Button
          variant={categoryFilter === "retention" ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setCategoryFilter("retention")}
        >
          Retenção & Churn
        </Button>
      </div>

      {/* Grid of Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCatalog.map((report) => {
          const isLocked = report.tierRequired === "pro" && !hasAdvancedReports;

          return (
            <Card
              key={report.type}
              className={`flex flex-col justify-between transition-all duration-200 hover:border-primary/30 ${
                isLocked ? "bg-muted/15 border-dashed" : "shadow-xs"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-lg border bg-background p-2 shadow-2xs">
                    {getReportIcon(report.iconName)}
                  </div>
                  {report.tierRequired === "pro" ? (
                    <Badge
                      variant="outline"
                      className={`text-[10px] gap-1 ${
                        isLocked
                          ? "border-amber-500/40 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                          : "border-primary/40 bg-primary/5 text-primary"
                      }`}
                    >
                      {isLocked ? <Lock className="size-2.5" /> : <Sparkles className="size-2.5" />}
                      Plano Pro
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      Operacional
                    </Badge>
                  )}
                </div>

                <CardTitle className="text-base font-semibold mt-3">
                  {report.title}
                </CardTitle>
                <CardDescription className="text-xs line-clamp-2 leading-relaxed">
                  {report.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                <Button
                  className="w-full text-xs gap-1.5"
                  variant={isLocked ? "outline" : "default"}
                  onClick={() => onSelectReport(report.type)}
                >
                  {isLocked ? (
                    <>
                      <Lock className="size-3" />
                      Disponível no Plano Pro
                    </>
                  ) : (
                    "Visualizar & Exportar"
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
