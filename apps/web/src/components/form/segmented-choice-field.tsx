"use client";

import { useRef, type KeyboardEvent } from "react";
import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
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
  disabled?: boolean;
}

/**
 * Escolha unica entre poucas opcoes (2 a 3) exibidas lado a lado, no estilo
 * "segmented control". Semantica de radiogroup: setas navegam e selecionam.
 */
export function SegmentedChoiceField<T extends FieldValues>({
  name,
  options,
  ariaLabel,
  disabled,
}: SegmentedChoiceFieldProps<T>) {
  const { control } = useFormContext<T>();
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const selectedIndex = Math.max(
          0,
          options.findIndex((o) => o.value === field.value),
        );

        const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
          const step =
            event.key === "ArrowRight" || event.key === "ArrowDown"
              ? 1
              : event.key === "ArrowLeft" || event.key === "ArrowUp"
                ? -1
                : 0;
          if (!step) return;
          event.preventDefault();
          const next = (selectedIndex + step + options.length) % options.length;
          field.onChange(options[next].value);
          buttonsRef.current[next]?.focus();
        };

        return (
          <div
            role="radiogroup"
            aria-label={ariaLabel}
            onKeyDown={handleKeyDown}
            className="grid gap-1 rounded-lg border border-border/60 bg-muted/40 p-1"
            style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
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
                  tabIndex={selected ? 0 : -1}
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
          </div>
        );
      }}
    />
  );
}
