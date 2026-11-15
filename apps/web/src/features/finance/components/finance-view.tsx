"use client";

import { useTeamWords } from "@/features/settings";
import { useEffect, useState } from "react";
import { ArrowLeftRight, LayoutDashboard, Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { type PageTab, PageTabs } from "@/components/shared/page-tabs";
import { Button } from "@/components/ui/button";
import { useCan, useCurrentUser } from "@/features/auth";
import { markDiscoveryVisit } from "@/lib/discovery-flags";
import { useFinanceUrlState } from "../hooks/use-finance-url-state";
import type { FinanceTab } from "../lib";
import { CompetencePicker } from "./competence-picker";
import { FinanceEntriesTab } from "./finance-entries-tab";
import { FinanceEntryFormDialog } from "./finance-entry-form-dialog";
import { FinanceSummaryTab } from "./finance-summary-tab";
import { TeacherPayTab } from "./teacher-pay-tab";

function financeTabs(teacherLabel: string): PageTab<FinanceTab>[] {
  return [
    { value: "resumo", label: "Resumo", icon: LayoutDashboard },
    { value: "lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
    { value: "professores", label: teacherLabel, icon: Users },
  ];
}

/**
 * Tela do Financeiro (plano pago): abas por URL (`?tab=`, padrao resumo) e mes
 * compartilhado (`?month=`). A page ja checou permissao e recurso do plano.
 * So a aba ativa monta (cada uma busca os proprios dados).
 */
export function FinanceView() {
  const team = useTeamWords();
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
        description={`Entradas, saídas, resultado do mês e pagamento dos ${team.lowerPlural}.`}
      >
        <CompetencePicker competence={competence} onChange={setCompetence} label="Mês" />
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Novo lançamento
          </Button>
        ) : null}
      </PageHeader>

      <PageTabs
        tabs={financeTabs(team.titlePlural)}
        value={tab}
        onChange={setTab}
        label="Seções do financeiro"
        idPrefix="finance"
        className="mb-6"
      />

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
