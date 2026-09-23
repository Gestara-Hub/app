"use client";

import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FieldShell, fieldAria } from "./field-shell";

interface DateFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  id?: string;
}

/** Campo de data (`<input type="date">`), integrado ao RHF via Controller. */
export function DateField<T extends FieldValues>({
  name,
  label,
  hint,
  required,
  disabled,
  min,
  max,
  id,
}: DateFieldProps<T>) {
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
            type="date"
            min={min}
            max={max}
            ref={field.ref}
            name={field.name}
            value={field.value ?? ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled}
            {...fieldAria(fieldId, fieldState.error?.message, hint)}
          />
        </FieldShell>
      )}
    />
  );
}
