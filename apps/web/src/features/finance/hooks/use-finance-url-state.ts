"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_FINANCE_TAB,
  currentCompetence,
  isCompetence,
  isFinanceTab,
  type FinanceTab,
} from "../lib";

/**
 * Estado do Financeiro na URL: aba (`?tab=`, padrao resumo) e competencia
 * (`?month=YYYY-MM`, padrao o mes atual), compartilhada entre as abas. Troca
 * com `router.replace` (sem empilhar historico).
 */
export function useFinanceUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const paramTab = searchParams.get("tab");
  const tab: FinanceTab = isFinanceTab(paramTab) ? paramTab : DEFAULT_FINANCE_TAB;
  const paramMonth = searchParams.get("month");
  const competence = isCompetence(paramMonth) ? paramMonth : currentCompetence();

  const update = useCallback(
    (patch: { tab?: FinanceTab; month?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (patch.tab) {
        params.set("tab", patch.tab);
        // Filtro inicial de Lancamentos (financeHref) vale so para aquele link.
        params.delete("type");
        params.delete("status");
      }
      if (patch.month) params.set("month", patch.month);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setTab = useCallback((next: FinanceTab) => update({ tab: next }), [update]);
  const setCompetence = useCallback((next: string) => update({ month: next }), [update]);

  return { tab, setTab, competence, setCompetence };
}
