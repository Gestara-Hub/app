"use client";

import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FieldShell } from "./field-shell";

interface TimeFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  /** Granularidade em segundos. Default 300 (5 min), igual ao resto da agenda. */
  step?: number;
  id?: string;
}

/** Campo de horário (`<input type="time">`), integrado ao RHF via Controller. */
export function TimeField<T extends FieldValues>({
  name,
  label,
  hint,
  required,
  disabled,
  step = 300,
  id,
}: TimeFieldProps<T>) {
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
          <Input
            id={fieldId}
            type="time"
            step={step}
            ref={field.ref}
            name={field.name}
            value={field.value ?? ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
          />
        </FieldShell>
      )}
    />
  );
}
