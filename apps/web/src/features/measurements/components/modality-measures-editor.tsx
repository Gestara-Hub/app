"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import type { MeasureDirection } from "@gestarahub/contracts";
import { MAX_MEASURES } from "@gestarahub/core/measurements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MeasureSuggestion } from "@/lib/business-segment-presets";

/** Linha do editor: `key` so para a lista; `id` vazio = medida nova (o servidor da o id). */
export interface MeasureDraft {
  key: string;
  id: string;
  name: string;
  unit: string;
  better: MeasureDirection;
}

let draftCounter = 0;
/** Chave local de uma linha nova (sem crypto: roda tambem em http na rede local). */
export function newMeasureKey(): string {
  draftCounter += 1;
  return `measure-${Date.now().toString(36)}-${draftCounter}`;
}

const INPUT = "h-9 text-base md:text-sm";

/**
 * Medidas da modalidade (doc 21 §2.4): nome, unidade e se e melhor subir ou
 * descer. As sugestoes da area entram com um toque, sem repetir as que ja
 * estao na lista.
 */
export function ModalityMeasuresEditor({
  value,
  onChange,
  suggestions,
  disabled,
  error,
}: {
  value: MeasureDraft[];
  onChange: (next: MeasureDraft[]) => void;
  suggestions: readonly MeasureSuggestion[];
  disabled?: boolean;
  error?: string;
}) {
  const names = new Set(value.map((m) => m.name.trim().toLocaleLowerCase("pt-BR")));
  const pending = suggestions.filter((s) => !names.has(s.name.toLocaleLowerCase("pt-BR")));
  const full = value.length >= MAX_MEASURES;
  const update = (key: string, patch: Partial<MeasureDraft>) =>
    onChange(value.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  const add = (draft: Omit<MeasureDraft, "key" | "id">) =>
    onChange([...value, { key: newMeasureKey(), id: "", ...draft }]);

  return (
    <div className="space-y-2.5">
      {value.length > 0 ? (
        <ul className="space-y-2">
          {value.map((m, index) => {
            const label = m.name.trim() || `Medida ${index + 1}`;
            return (
              <li
                key={m.key}
                className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 rounded-md border border-border/60 p-2 sm:grid-cols-[minmax(0,1fr)_5rem_10rem_auto] sm:border-0 sm:p-0"
              >
                <Input
                  value={m.name}
                  onChange={(e) => update(m.key, { name: e.target.value })}
                  placeholder="Nome da medida"
                  aria-label={`Nome da medida ${index + 1}`}
                  maxLength={40}
                  disabled={disabled}
                  className={INPUT}
                />
                <Input
                  value={m.unit}
                  onChange={(e) => update(m.key, { unit: e.target.value })}
                  placeholder="Unidade"
                  aria-label={`Unidade de ${label}`}
                  maxLength={10}
                  disabled={disabled}
                  className={INPUT}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  aria-label={`${label}: ${m.better === "higher" ? "melhor subir" : "melhor descer"}. Trocar`}
                  className="justify-start"
                  onClick={() => update(m.key, { better: m.better === "higher" ? "lower" : "higher" })}
                >
                  {m.better === "higher" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
                  {m.better === "higher" ? "Melhor subir" : "Melhor descer"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  aria-label={`Remover ${label}`}
                  className="justify-self-end sm:justify-self-auto"
                  onClick={() => onChange(value.filter((x) => x.key !== m.key))}
                >
                  <X className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {pending.length > 0 && !full ? (
        <div className="flex flex-wrap items-center gap-1">
          {pending.map((s) => (
            <button
              key={s.name}
              type="button"
              disabled={disabled}
              onClick={() => add({ name: s.name, unit: s.unit, better: s.better })}
              className="rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              + {s.name}
              {s.unit ? ` (${s.unit})` : ""}
            </button>
          ))}
        </div>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        disabled={disabled || full}
        onClick={() => add({ name: "", unit: "", better: "higher" })}
        className="-ml-2"
      >
        <Plus className="size-4" />
        Adicionar medida
      </Button>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
