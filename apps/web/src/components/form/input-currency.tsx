"use client";

import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FieldShell } from "./field-shell";

/**
 * Campo monetario: exibe em reais (R$ 45,00) e ARMAZENA em centavos
 * (precoCentavos). Cada digito digitado e um centavo; nunca aceita negativo.
 */

function digitsToCentavos(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return Number(digits);
}

function formatCentavos(centavos: number | null | undefined): string {
  if (centavos === undefined || centavos === null || Number.isNaN(centavos)) {
    return "";
  }
  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface InputCurrencyProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

export function InputCurrency<T extends FieldValues>({
  name,
  label,
  placeholder = "0,00",
  hint,
  required,
  disabled,
  id,
}: InputCurrencyProps<T>) {
  const { control } = useFormContext<T>();
  const fieldId = id ?? String(name);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell
          id={fieldId}
          label={label}
          hint={hint}
          error={fieldState.error?.message}
          required={required}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              R$
            </span>
            <Input
              id={fieldId}
              inputMode="numeric"
              placeholder={placeholder}
              disabled={disabled}
              className="pl-9"
              value={formatCentavos(field.value as number | null | undefined)}
              onChange={(event) =>
                field.onChange(digitsToCentavos(event.target.value))
              }
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              aria-invalid={fieldState.invalid}
            />
          </div>
        </FieldShell>
      )}
    />
  );
}
