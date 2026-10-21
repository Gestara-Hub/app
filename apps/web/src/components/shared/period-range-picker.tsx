"use client";

import { useState } from "react";
import {
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";
import { CalendarRange, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/** Intervalo de datas "AAAA-MM-DD", inclusive. Sem `from` e `to`: todo o periodo. */
export interface PeriodRange {
  from?: string;
  to?: string;
  /** Sugestao escolhida, para o rotulo do botao; ausente no intervalo livre. */
  preset?: PeriodPreset;
}

export type PeriodPreset =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_semester"
  | "last_semester"
  | "this_year"
  | "last_year"
  | "last_12_months"
  | "all";

const PRESET_LABEL: Record<PeriodPreset, string> = {
  this_month: "Este mês",
  last_month: "Mês passado",
  this_quarter: "Este trimestre",
  last_quarter: "Trimestre passado",
  this_semester: "Este semestre",
  last_semester: "Semestre passado",
  this_year: "Este ano",
  last_year: "Ano passado",
  last_12_months: "Últimos 12 meses",
  all: "Todo o período",
};

const PRESET_ORDER: PeriodPreset[] = [
  "this_month",
  "last_month",
  "this_quarter",
  "last_quarter",
  "this_semester",
  "last_semester",
  "this_year",
  "last_year",
  "last_12_months",
  "all",
];

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Semestre: jan-jun ou jul-dez. */
function startOfSemester(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() < 6 ? 0 : 6, 1);
}
function endOfSemester(d: Date): Date {
  return endOfMonth(new Date(d.getFullYear(), d.getMonth() < 6 ? 5 : 11, 1));
}

/** Intervalo de uma sugestao, a partir de hoje. */
export function periodFromPreset(preset: PeriodPreset, today: Date = new Date()): PeriodRange {
  switch (preset) {
    case "this_month":
      return { from: iso(startOfMonth(today)), to: iso(endOfMonth(today)), preset };
    case "last_month": {
      const d = subMonths(today, 1);
      return { from: iso(startOfMonth(d)), to: iso(endOfMonth(d)), preset };
    }
    case "this_quarter":
      return { from: iso(startOfQuarter(today)), to: iso(endOfQuarter(today)), preset };
    case "last_quarter": {
      const d = subQuarters(today, 1);
      return { from: iso(startOfQuarter(d)), to: iso(endOfQuarter(d)), preset };
    }
    case "this_semester":
      return { from: iso(startOfSemester(today)), to: iso(endOfSemester(today)), preset };
    case "last_semester": {
      const d = subMonths(startOfSemester(today), 1);
      return { from: iso(startOfSemester(d)), to: iso(endOfSemester(d)), preset };
    }
    case "this_year":
      return { from: iso(startOfYear(today)), to: iso(endOfYear(today)), preset };
    case "last_year": {
      const d = subYears(today, 1);
      return { from: iso(startOfYear(d)), to: iso(endOfYear(d)), preset };
    }
    case "last_12_months":
      return { from: iso(startOfMonth(subMonths(today, 11))), to: iso(endOfMonth(today)), preset };
    default:
      return { preset: "all" };
  }
}

const shortDate = (date: string) => format(parseISO(date), "dd/MM/yyyy");

/** Rotulo do botao: a sugestao ou "dd/MM/aaaa a dd/MM/aaaa". */
export function periodLabel(range: PeriodRange): string {
  if (range.preset) return PRESET_LABEL[range.preset];
  if (range.from && range.to) return `${shortDate(range.from)} a ${shortDate(range.to)}`;
  if (range.from) return `Desde ${shortDate(range.from)}`;
  if (range.to) return `Até ${shortDate(range.to)}`;
  return PRESET_LABEL.all;
}

/**
 * Datas do intervalo, curtas: "01/10 a 31/12/2026" no mesmo ano,
 * "01/11/2025 a 31/10/2026" entre anos. Vazio em todo o periodo.
 */
export function periodDatesLabel(range: PeriodRange): string {
  const { from, to } = range;
  if (from && to) {
    const sameYear = from.slice(0, 4) === to.slice(0, 4);
    return `${sameYear ? format(parseISO(from), "dd/MM") : shortDate(from)} a ${shortDate(to)}`;
  }
  if (from) return `desde ${shortDate(from)}`;
  if (to) return `até ${shortDate(to)}`;
  return "";
}

/**
 * Filtro de periodo: botao com o periodo atual que abre sugestoes (mes,
 * trimestre, semestre, ano) e um intervalo livre De/Ate.
 */
export function PeriodRangePicker({
  value,
  onChange,
  className,
}: {
  value: PeriodRange;
  onChange: (next: PeriodRange) => void;
  className?: string;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(value.from ?? "");
  const [draftTo, setDraftTo] = useState(value.to ?? "");
  const invalid = Boolean(draftFrom && draftTo && draftFrom > draftTo);

  const openChange = (next: boolean) => {
    if (next) {
      setDraftFrom(value.from ?? "");
      setDraftTo(value.to ?? "");
    }
    setOpen(next);
  };

  const pick = (preset: PeriodPreset) => {
    onChange(periodFromPreset(preset));
    setOpen(false);
  };

  const applyCustom = () => {
    if (invalid || (!draftFrom && !draftTo)) return;
    onChange({ from: draftFrom || undefined, to: draftTo || undefined });
    setOpen(false);
  };

  const dates = periodDatesLabel(value);

  const trigger = (
    <Button type="button" variant="outline" className="w-full justify-between gap-2 sm:w-auto">
      <span className="flex min-w-0 items-center gap-2">
        <CalendarRange className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {/* Sugestao e as datas que ela cobre, a vista depois de fechar. */}
        <span className="font-medium">{value.preset ? periodLabel(value) : "Período"}</span>
        {dates ? <span className="hidden tabular-nums text-muted-foreground sm:inline">{dates}</span> : null}
      </span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Button>
  );

  const panel = (
    <div className="flex flex-col sm:flex-row">
      <div className="grid grid-cols-2 gap-1 border-b border-border/60 p-2 sm:w-44 sm:grid-cols-1 sm:border-r sm:border-b-0">
        {PRESET_ORDER.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => pick(preset)}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted sm:py-1.5",
              value.preset === preset && "bg-muted font-medium text-foreground",
            )}
          >
            {PRESET_LABEL[preset]}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-3 p-3">
        <p className="text-sm font-medium text-foreground">Intervalo</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
          <label className="block space-y-1 text-xs text-muted-foreground">
            De
            <Input
              type="date"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="text-base md:text-sm"
            />
          </label>
          <label className="block space-y-1 text-xs text-muted-foreground">
            Até
            <Input
              type="date"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
              className="text-base md:text-sm"
            />
          </label>
        </div>
        {invalid ? <p className="text-xs text-destructive">A data final vem antes da inicial.</p> : null}
        <Button type="button" className="w-full" disabled={invalid || (!draftFrom && !draftTo)} onClick={applyCustom}>
          Aplicar
        </Button>
      </div>
    </div>
  );

  // Celular: painel de baixo (Sheet), com o espaco da tela inteira. Computador: popover junto do botao.
  if (isMobile) {
    return (
      <div className={cn("flex w-full flex-col gap-1", className)}>
        <div onClick={() => openChange(true)}>{trigger}</div>
        {dates ? <span className="px-1 text-xs tabular-nums text-muted-foreground">{dates}</span> : null}
        <Sheet open={open} onOpenChange={openChange}>
          <SheetContent side="bottom" className="gap-0 rounded-t-xl p-0 pb-[env(safe-area-inset-bottom)]">
            <SheetHeader className="border-b border-border/60 px-4 py-3 text-left">
              <SheetTitle className="text-base">Período</SheetTitle>
              <SheetDescription className="sr-only">Escolha uma sugestão ou um intervalo de datas.</SheetDescription>
            </SheetHeader>
            {panel}
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className="w-[30rem] p-0">
        {panel}
      </PopoverContent>
    </Popover>
  );
}
