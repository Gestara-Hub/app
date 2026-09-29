"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { competenceLabel } from "../lib";

/** Seletor de mes (competencia), igual ao de Mensalidades. */
export function CompetencePicker({
  competence,
  onShift,
  label = "Competência",
}: {
  competence: string;
  /** -1 = mes anterior, +1 = proximo. */
  onShift: (delta: number) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="inline-flex items-center rounded-md border border-border/70 bg-background">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-9 rounded-r-none"
          aria-label="Competência anterior"
          onClick={() => onShift(-1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-36 px-2 text-center font-medium tabular-nums" aria-live="polite">
          {competenceLabel(competence)}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-9 rounded-l-none"
          aria-label="Próxima competência"
          onClick={() => onShift(1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
