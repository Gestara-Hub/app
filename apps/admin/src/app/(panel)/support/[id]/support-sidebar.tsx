"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SupportSidebarProps {
  attendance: ReactNode;
  diagnostic: ReactNode;
  diagnosticCount?: number;
  hasError?: boolean;
}

/**
 * Barra lateral da conversa de suporte dividida em duas abas:
 * - Atendimento: Ações imediatas, dados de quem escreveu, contexto e andamento do bug.
 * - Diagnóstico: Erro técnico registrado, passos antes do relato e histórico em volta.
 */
export function SupportSidebar({
  attendance,
  diagnostic,
  diagnosticCount = 0,
  hasError = false,
}: SupportSidebarProps) {
  const [tab, setTab] = useState<"attendance" | "diagnostic">("attendance");

  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <nav
        aria-label="Seções do chamado"
        className="flex w-full rounded-lg border bg-muted/40 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "attendance"}
          onClick={() => setTab("attendance")}
          className={cn(
            "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors text-center cursor-pointer",
            tab === "attendance"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Atendimento
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "diagnostic"}
          onClick={() => setTab("diagnostic")}
          className={cn(
            "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors text-center inline-flex items-center justify-center gap-1.5 cursor-pointer",
            tab === "diagnostic"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span>Diagnóstico</span>
          {hasError ? (
            <span
              className="size-2 rounded-full bg-destructive shrink-0"
              title="Possui erro registrado"
            />
          ) : diagnosticCount > 0 ? (
            <Badge variant="secondary" className="h-4.5 px-1.5 text-[10px] font-normal">
              {diagnosticCount}
            </Badge>
          ) : null}
        </button>
      </nav>

      <div className={tab === "attendance" ? "space-y-4" : "hidden"}>
        {attendance}
      </div>

      <div className={tab === "diagnostic" ? "space-y-4" : "hidden"}>
        {diagnostic}
      </div>
    </aside>
  );
}
