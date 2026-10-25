"use client";

import { Controller, useFormContext, type FieldValues, type Path } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

/** Lista de escolha (a mesma do app dos clientes: lista do Radix, que no celular abre por cima da tela). */
export function SelectField<T extends FieldValues = FieldValues>({ name, label, options, hint, required, disabled, id, className, onValueChange }: SelectFieldProps<T>) {
  const { control } = useFormContext<T>();
  const fieldId = id ?? String(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = (field.value as string | undefined) ?? "";
        const current = options.find(([option]) => option === value)?.[1];
        return (
          <FieldShell id={fieldId} label={label} hint={hint} error={fieldState.error?.message} required={required} className={className}>
            <Select
              value={value}
              disabled={disabled}
              onValueChange={(next) => {
                field.onChange(next);
                onValueChange?.(next);
              }}
              name={field.name}
            >
              <SelectTrigger id={fieldId} ref={field.ref} onBlur={field.onBlur} className="w-full" {...fieldAria(fieldId, fieldState.error?.message, hint)}>
                <SelectValue>{current}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {options.map(([option, text]) => (
                  <SelectItem key={option} value={option}>
                    {text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldShell>
        );
      }}
    />
  );
}
