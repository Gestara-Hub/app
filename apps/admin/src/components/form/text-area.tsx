"use client";

import { Controller, useFormContext, type FieldValues, type Path } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FieldShell, fieldAria } from "./field-shell";

interface TextAreaProps<T extends FieldValues = FieldValues> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  id?: string;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
}

export function TextArea<T extends FieldValues = FieldValues>({
  name,
  label,
  placeholder,
  hint,
  required,
  disabled,
  rows = 3,
  maxLength,
  id,
  className,
  inputClassName,
  ariaLabel,
}: TextAreaProps<T>) {
  const { control } = useFormContext<T>();
  const fieldId = id ?? String(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell id={fieldId} label={label} hint={hint} error={fieldState.error?.message} required={required} className={className}>
          <Textarea
            id={fieldId}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            maxLength={maxLength}
            aria-label={label ? undefined : ariaLabel}
            className={cn("text-base md:text-sm", inputClassName)}
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
