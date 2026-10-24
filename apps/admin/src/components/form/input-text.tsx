"use client";

import { Controller, useFormContext, type FieldValues, type Path } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FieldShell, fieldAria } from "./field-shell";

interface InputTextProps<T extends FieldValues = FieldValues> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  type?: "text" | "email" | "password" | "number" | "datetime-local";
  id?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text";
  maxLength?: number;
  min?: number;
  max?: number;
  className?: string;
  inputClassName?: string;
  /** Rotulo so para leitor de tela (campo sem rotulo visivel). */
  ariaLabel?: string;
}

export function InputText<T extends FieldValues = FieldValues>({
  name,
  label,
  placeholder,
  hint,
  required,
  disabled,
  type = "text",
  id,
  autoComplete,
  inputMode,
  maxLength,
  min,
  max,
  className,
  inputClassName,
  ariaLabel,
}: InputTextProps<T>) {
  const { control } = useFormContext<T>();
  const fieldId = id ?? String(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell id={fieldId} label={label} hint={hint} error={fieldState.error?.message} required={required} className={className}>
          <Input
            id={fieldId}
            type={type}
            placeholder={placeholder}
            autoComplete={autoComplete}
            inputMode={inputMode}
            maxLength={maxLength}
            min={min}
            max={max}
            disabled={disabled}
            aria-label={label ? undefined : ariaLabel}
            className={cn("text-base md:text-sm", inputClassName)}
            value={(field.value as string | number | undefined) ?? ""}
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
