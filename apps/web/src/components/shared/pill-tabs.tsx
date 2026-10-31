"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PillTab {
  value: string;
  label: string;
  /** Depois do rotulo (ex.: a faixa atual na modalidade). */
  extra?: ReactNode;
}

/**
 * Abas em pilula para escolher a modalidade dentro de um painel (Notas, Testes
 * e medidas, Graduacao). Uma so marcacao para as tres (revisao geral de
 * 31/10/2026); com uma opcao so, nao aparece.
 */
export function PillTabs({
  tabs,
  value,
  onChange,
  label = "Modalidade",
}: {
  tabs: PillTab[];
  value: string | undefined;
  onChange: (value: string) => void;
  label?: string;
}) {
  if (tabs.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              selected ? "border-foreground/50 bg-foreground/5 text-foreground" : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            {tab.label}
            {tab.extra}
          </button>
        );
      })}
    </div>
  );
}
