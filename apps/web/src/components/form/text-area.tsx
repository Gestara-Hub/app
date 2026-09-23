"use client";

import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { FieldShell, fieldAria } from "./field-shell";

interface TextAreaProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  id?: string;
}

export function TextArea<T extends FieldValues>({
  name,
  label,
  placeholder,
  hint,
  required,
  disabled,
  rows = 3,
  id,
}: TextAreaProps<T>) {
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
          <Textarea
            id={fieldId}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            value={(field.value as string | undefined) ?? ""}
            onChange={(event) => field.onChange(event.target.value)}
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
