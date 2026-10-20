"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, LayoutDashboard, Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useCan, useCurrentUser } from "@/features/auth";
import { markDiscoveryVisit } from "@/lib/discovery-flags";
import { cn } from "@/lib/utils";
import { useFinanceUrlState } from "../hooks/use-finance-url-state";
import type { FinanceTab } from "../lib";
import { CompetencePicker } from "./competence-picker";
import { FinanceEntriesTab } from "./finance-entries-tab";
import { FinanceEntryFormDialog } from "./finance-entry-form-dialog";
import { FinanceSummaryTab } from "./finance-summary-tab";
import { TeacherPayTab } from "./teacher-pay-tab";

const TABS: { value: FinanceTab; label: string; icon: typeof LayoutDashboard }[] = [
  { value: "resumo", label: "Resumo", icon: LayoutDashboard },
  { value: "lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { value: "professores", label: "Professores", icon: Users },
];

/**
 * Tela do Financeiro (plano pago): abas por URL (`?tab=`, padrao resumo) e mes
 * compartilhado (`?month=`). A page ja checou permissao e recurso do plano.
 * So a aba ativa monta (cada uma busca os proprios dados).
 */
export function FinanceView() {
  const { tab, setTab, competence, setCompetence } = useFinanceUrlState();
  const can = useCan();
  const canManage = can("finance:manage");
  const [createOpen, setCreateOpen] = useState(false);
  // Abrir o Financeiro conclui "Ver o resultado do mês" (Dashboard).
  const user = useCurrentUser();
  useEffect(() => {
    markDiscoveryVisit(user, "finance");
  }, [user]);

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Entradas, saídas, resultado do mês e pagamento dos professores."
      >
        <div className="flex flex-wrap items-center gap-2">
          <CompetencePicker competence={competence} onChange={setCompetence} label="Mês" />
          {canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Novo lançamento
            </Button>
          ) : null}
        </div>
      </PageHeader>

      <div
        role="tablist"
        aria-label="Seções do financeiro"
        className="mb-6 inline-flex max-w-full flex-wrap gap-1 rounded-lg border bg-muted/40 p-1"
      >
        {TABS.map((t) => {
          const active = t.value === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              id={`finance-tab-${t.value}`}
              aria-selected={active}
              aria-controls={`finance-panel-${t.value}`}
              onClick={() => setTab(t.value)}
              className={cn(
                "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`finance-panel-${tab}`}
        aria-labelledby={`finance-tab-${tab}`}
        className="space-y-4"
      >
        {tab === "resumo" ? (
          <FinanceSummaryTab
            competence={competence}
            onCreateEntry={() => setCreateOpen(true)}
          />
        ) : null}
        {tab === "lancamentos" ? (
          <FinanceEntriesTab
            competence={competence}
            onCreateEntry={() => setCreateOpen(true)}
          />
        ) : null}
        {tab === "professores" ? <TeacherPayTab competence={competence} /> : null}
      </div>

      <FinanceEntryFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        competence={competence}
      />
    </>
  );
}
