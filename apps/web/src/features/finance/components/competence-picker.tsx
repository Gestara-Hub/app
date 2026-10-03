"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { addCompetence } from "@gestarahub/core/finance";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { competenceLabel, currentCompetence } from "../lib";

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

function monthShortLabel(month: string): string {
  const label = format(new Date(2000, Number(month) - 1, 1), "MMM", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Seletor de mes (competencia): setas para o mes vizinho, rotulo que abre a
 * grade de meses e atalho "Hoje" quando outro mes esta aberto (tambem no
 * rodape da grade). O mes atual fica marcado so pelo selo "Atual" no rotulo.
 */
export function CompetencePicker({
  competence,
  onChange,
  label = "Competência",
}: {
  competence: string;
  onChange: (competence: string) => void;
  label?: string;
}) {
  const current = currentCompetence();
  const isCurrent = competence === current;
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(competence.slice(0, 4)));

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {!isCurrent ? (
        <Button variant="ghost" size="sm" onClick={() => onChange(current)}>
          <CalendarCheck className="size-4" />
          Hoje
        </Button>
      ) : null}
      <span className="text-muted-foreground">{label}</span>
      <div className="inline-flex items-center rounded-md border border-border/70 bg-background">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-9 rounded-r-none"
          aria-label="Mês anterior"
          onClick={() => onChange(addCompetence(competence, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Popover
          open={open}
          onOpenChange={(next) => {
            // Abre a grade no ano do mes exibido.
            if (next) setYear(Number(competence.slice(0, 4)));
            setOpen(next);
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Escolher mês (${competenceLabel(competence)})`}
              className="inline-flex h-9 min-w-40 cursor-pointer items-center justify-center gap-2 px-2 font-medium tabular-nums transition-colors hover:bg-accent"
            >
              <span aria-live="polite">{competenceLabel(competence)}</span>
              {isCurrent ? (
                <span className="rounded-full border border-info/25 bg-info/10 px-1.5 py-px text-[11px] font-medium leading-4 text-info">
                  Atual
                </span>
              ) : null}
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-72 p-3">
            <div className="mb-2 flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Ano anterior"
                onClick={() => setYear((y) => y - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm font-semibold tabular-nums">{year}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Próximo ano"
                onClick={() => setYear((y) => y + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((m) => {
                const value = `${year}-${m}`;
                const selected = value === competence;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={selected}
                    aria-label={competenceLabel(value)}
                    onClick={() => pick(value)}
                    className={cn(
                      "h-9 cursor-pointer rounded-md text-sm transition-colors",
                      selected
                        ? "bg-primary font-medium text-primary-foreground"
                        : "hover:bg-accent",
                    )}
                  >
                    {monthShortLabel(m)}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex justify-end border-t pt-3">
              <Button variant="outline" size="sm" disabled={isCurrent} onClick={() => pick(current)}>
                <CalendarCheck className="size-4" />
                Hoje
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-9 rounded-l-none"
          aria-label="Próximo mês"
          onClick={() => onChange(addCompetence(competence, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
