"use client";

import { useRef, type KeyboardEvent } from "react";
import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Check } from "lucide-react";
import type { PaymentMethod } from "@gestarahub/contracts";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { FieldShell } from "./field-shell";

interface PaymentMethodFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

/**
 * Forma de pagamento (Pix, Dinheiro, Cartao, Outro) em grade 2x2, semantica de
 * radiogroup (setas navegam e selecionam). Sem valor inicial: o schema exige a
 * escolha, evitando baixa por clique acidental.
 */
export function PaymentMethodField<T extends FieldValues>({
  name,
  label = "Forma de pagamento",
  required = true,
  disabled,
  id,
}: PaymentMethodFieldProps<T>) {
  const { control } = useFormContext<T>();
  const fieldId = id ?? String(name);
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = field.value as PaymentMethod | undefined;
        const current = value ? PAYMENT_METHODS.indexOf(value) : -1;

        const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
          const step =
            event.key === "ArrowRight" || event.key === "ArrowDown"
              ? 1
              : event.key === "ArrowLeft" || event.key === "ArrowUp"
                ? -1
                : 0;
          if (!step || disabled) return;
          event.preventDefault();
          const next = (Math.max(0, current) + step + PAYMENT_METHODS.length) % PAYMENT_METHODS.length;
          field.onChange(PAYMENT_METHODS[next]);
          buttonsRef.current[next]?.focus();
        };

        return (
          <FieldShell label={label} required={required} error={fieldState.error?.message}>
            <div
              id={fieldId}
              role="radiogroup"
              aria-label={label}
              aria-invalid={fieldState.error ? true : undefined}
              onKeyDown={handleKeyDown}
              className="grid grid-cols-2 gap-2"
            >
              {PAYMENT_METHODS.map((m, index) => {
                const selected = value === m;
                return (
                  <button
                    key={m}
                    ref={(el) => {
                      buttonsRef.current[index] = el;
                      if (index === 0) field.ref(el);
                    }}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    // Tab entra no selecionado (ou no primeiro); setas trocam.
                    tabIndex={selected || (current === -1 && index === 0) ? 0 : -1}
                    disabled={disabled}
                    onClick={() => field.onChange(m)}
                    onBlur={field.onBlur}
                    className={cn(
                      "flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                      selected
                        ? "border-foreground bg-muted text-foreground"
                        : fieldState.error
                          ? "border-destructive/50 text-muted-foreground hover:bg-muted/50"
                          : "border-border/70 text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    {selected ? <Check className="size-4" /> : null}
                    {paymentMethodLabel(m)}
                  </button>
                );
              })}
            </div>
          </FieldShell>
        );
      }}
    />
  );
}
