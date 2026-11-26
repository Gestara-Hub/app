"use client";

import { useRef, type CSSProperties, type KeyboardEvent } from "react";
import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Check } from "lucide-react";
import { FieldShell } from "./field-shell";
import { cn } from "@/lib/utils";

export interface SegmentedChoiceOption {
  value: string;
  label: string;
  description?: string;
}

interface SegmentedChoiceFieldProps<T extends FieldValues> {
  name: Path<T>;
  options: SegmentedChoiceOption[];
  ariaLabel: string;
  /**
   * Sem valor, nada fica marcado e a pessoa precisa escolher (26/11/2026,
   * estorno). Sem isto, a 1a opcao aparece marcada quando o valor esta vazio.
   */
  allowEmpty?: boolean;
  /** Rotulo acima das opcoes (com o asterisco quando `required`). */
  label?: string;
  required?: boolean;
  disabled?: boolean;
  /**
   * `segmented` (padrao): faixa unica, no estilo "segmented control".
   * `cards`: cartoes de opcao em 2 colunas em qualquer largura (grade 2x2 com
   * 4 opcoes), para escolhas com titulo e dica que nao cabem lado a lado.
   */
  variant?: "segmented" | "cards";
}

/**
 * Escolha unica entre poucas opcoes (2 a 4) exibidas lado a lado, no estilo
 * "segmented control". Com 4 opcoes, o celular mostra 2 por linha. Semantica
 * de radiogroup: setas navegam e selecionam.
 */
export function SegmentedChoiceField<T extends FieldValues>({
  name,
  options,
  ariaLabel,
  allowEmpty,
  label,
  required,
  disabled,
  variant = "segmented",
}: SegmentedChoiceFieldProps<T>) {
  const { control } = useFormContext<T>();
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const matchIndex = options.findIndex((o) => o.value === field.value);
        // `allowEmpty`: sem valor, nada marcado (so o foco cai na 1a opcao).
        const selectedIndex = allowEmpty ? matchIndex : Math.max(0, matchIndex);
        const focusIndex = selectedIndex >= 0 ? selectedIndex : 0;
        const error = fieldState.error?.message;

        const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
          const step =
            event.key === "ArrowRight" || event.key === "ArrowDown"
              ? 1
              : event.key === "ArrowLeft" || event.key === "ArrowUp"
                ? -1
                : 0;
          if (!step) return;
          event.preventDefault();
          const next =
            selectedIndex < 0
              ? step > 0
                ? 0
                : options.length - 1
              : (selectedIndex + step + options.length) % options.length;
          field.onChange(options[next].value);
          buttonsRef.current[next]?.focus();
        };

        const shell = (control: React.ReactNode) => (
          <FieldShell id={String(name)} label={label} required={required} error={error}>
            {control}
          </FieldShell>
        );
        const isCards = variant === "cards";
        const wraps = options.length > 3;
        if (isCards) {
          return shell(
            <div
              role="radiogroup"
              aria-label={ariaLabel}
              aria-invalid={error ? true : undefined}
              onKeyDown={handleKeyDown}
              className="grid grid-cols-2 gap-2"
            >
              {options.map((option, index) => {
                const selected = index === selectedIndex;
                return (
                  <button
                    key={option.value}
                    ref={(el) => {
                      buttonsRef.current[index] = el;
                      if (index === 0) field.ref(el);
                    }}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={index === focusIndex ? 0 : -1}
                    disabled={disabled}
                    onClick={() => field.onChange(option.value)}
                    className={cn(
                      "relative flex min-h-16 flex-col justify-start rounded-lg border px-3 py-2.5 pr-8 text-left transition-colors cursor-pointer select-none",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : error
                          ? "border-destructive bg-background hover:bg-muted/40"
                          : "border-border/70 bg-background hover:border-border hover:bg-muted/40",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute right-2.5 top-2.5 flex size-4 items-center justify-center rounded-full border",
                        selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}
                    >
                      {selected ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                    <span
                      className={cn(
                        "block text-sm font-medium leading-tight",
                        selected ? "text-foreground" : "text-foreground/90",
                      )}
                    >
                      {option.label}
                    </span>
                    {option.description ? (
                      <span className="mt-1 block text-xs text-muted-foreground leading-snug">
                        {option.description}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>,
          );
        }
        return shell(
          <div
            role="radiogroup"
            aria-label={ariaLabel}
            aria-invalid={error ? true : undefined}
            onKeyDown={handleKeyDown}
            className={cn(
              "grid gap-1 rounded-lg border bg-muted/40 p-1",
              error ? "border-destructive" : "border-border/60",
              wraps && "grid-cols-2 sm:[grid-template-columns:repeat(var(--segment-count),minmax(0,1fr))]",
            )}
            style={
              wraps
                ? ({ "--segment-count": options.length } as CSSProperties)
                : { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }
            }
          >
            {options.map((option, index) => {
              const selected = index === selectedIndex;
              return (
                <button
                  key={option.value}
                  ref={(el) => {
                    buttonsRef.current[index] = el;
                    if (index === 0) field.ref(el);
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={index === focusIndex ? 0 : -1}
                  disabled={disabled}
                  onClick={() => field.onChange(option.value)}
                  className={cn(
                    "rounded-md px-3 py-2 text-left transition-colors cursor-pointer select-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    selected
                      ? "bg-background shadow-xs ring-1 ring-border"
                      : "hover:bg-background/50",
                  )}
                >
                  <span
                    className={cn(
                      "block text-sm font-medium leading-tight",
                      selected ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground leading-snug">
                      {option.description}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>,
        );
      }}
    />
  );
}
