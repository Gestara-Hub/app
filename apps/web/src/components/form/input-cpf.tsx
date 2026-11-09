"use client";

import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import type { ReactNode } from "react";
import { formatCpf } from "@gestarahub/core/payer";
import { Input } from "@/components/ui/input";
import { FieldShell, fieldAria } from "./field-shell";

interface InputCpfProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  labelExtra?: ReactNode;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

/** CPF com mascara (000.000.000-00) e teclado numerico; o valor fica formatado no formulario. */
export function InputCpf<T extends FieldValues>({
  name,
  label = "CPF",
  labelExtra,
  hint,
  required,
  disabled,
  id,
}: InputCpfProps<T>) {
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
          labelExtra={labelExtra}
          hint={hint}
          error={fieldState.error?.message}
          required={required}
        >
          <Input
            id={fieldId}
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            disabled={disabled}
            value={formatCpf((field.value as string | undefined) ?? "")}
            onChange={(event) => field.onChange(formatCpf(event.target.value))}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
            {...fieldAria(fieldId, fieldState.error?.message, hint)}
          />
        </FieldShell>
      )}
    />
  );
}
