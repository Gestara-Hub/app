"use client";

import { Controller, useFormContext, type FieldValues, type Path } from "react-hook-form";
import { cn } from "@/lib/utils";
import { FieldShell, fieldAria } from "./field-shell";

interface SelectFieldProps<T extends FieldValues = FieldValues> {
  name: Path<T>;
  label?: string;
  options: readonly (readonly [string, string])[];
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Aviso ao mudar (ex.: trocar o publico mostra outros campos). */
  onValueChange?: (value: string) => void;
}

/** Lista de escolha simples (select nativo, que no celular abre a roda do aparelho). */
export function SelectField<T extends FieldValues = FieldValues>({ name, label, options, hint, required, disabled, id, className, onValueChange }: SelectFieldProps<T>) {
  const { control } = useFormContext<T>();
  const fieldId = id ?? String(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell id={fieldId} label={label} hint={hint} error={fieldState.error?.message} required={required} className={className}>
          <select
            id={fieldId}
            disabled={disabled}
            className={cn("h-9 w-full rounded-md border bg-background px-3 text-base aria-invalid:border-destructive md:text-sm")}
            value={(field.value as string | undefined) ?? ""}
            onChange={(event) => {
              field.onChange(event.target.value);
              onValueChange?.(event.target.value);
            }}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
            {...fieldAria(fieldId, fieldState.error?.message, hint)}
          >
            {options.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </FieldShell>
      )}
    />
  );
}
