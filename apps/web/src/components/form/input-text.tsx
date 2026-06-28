"use client";

import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FieldShell } from "./field-shell";

interface InputTextProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  type?: "text" | "email" | "tel" | "url";
  id?: string;
}

export function InputText<T extends FieldValues>({
  name,
  label,
  placeholder,
  hint,
  required,
  disabled,
  type = "text",
  id,
}: InputTextProps<T>) {
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
            type={type}
            placeholder={placeholder}
            disabled={disabled}
            value={(field.value as string | undefined) ?? ""}
            onChange={(event) => field.onChange(event.target.value)}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
            aria-invalid={fieldState.invalid}
          />
        </FieldShell>
      )}
    />
  );
}
