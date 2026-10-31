"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageTab<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Depois do rotulo (ex.: ponto de alteracao nao salva). */
  extra?: ReactNode;
}

interface PageTabsProps<T extends string> {
  tabs: PageTab<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Rotulo acessivel da lista ("Seções do financeiro"). */
  label: string;
  /** Prefixo dos ids (`<prefixo>-tab-<valor>` e `<prefixo>-panel-<valor>`). */
  idPrefix?: string;
  className?: string;
}

/**
 * Abas segmentadas de uma tela (Financeiro, Comunicação, Configurações,
 * Planos). Quebram a linha, sem rolagem lateral escondida (doc 07). Revisão de
 * celular de 31/10/2026: no celular ocupam a largura toda, em partes iguais e
 * sem ícone (três abas cabem numa linha); do `sm` para cima, do tamanho do
 * texto e com ícone.
 */
export function PageTabs<T extends string>({ tabs, value, onChange, label, idPrefix, className }: PageTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "flex w-full flex-wrap gap-1 rounded-lg border bg-muted/40 p-1 sm:inline-flex sm:w-auto sm:max-w-full",
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${t.value}` : undefined}
            aria-selected={active}
            aria-controls={idPrefix ? `${idPrefix}-panel-${t.value}` : undefined}
            onClick={() => onChange(t.value)}
            className={cn(
              "inline-flex flex-auto cursor-pointer items-center justify-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors sm:flex-none sm:px-3.5",
              active ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="hidden size-4 shrink-0 sm:block" /> : null}
            {t.label}
            {t.extra}
          </button>
        );
      })}
    </div>
  );
}
