"use client";

import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FieldShell } from "./field-shell";

interface InputNumberProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  /** Sufixo visual (ex.: "min"). */
  suffix?: string;
  id?: string;
}

export function InputNumber<T extends FieldValues>({
  name,
  label,
  placeholder,
  hint,
  required,
  disabled,
  min,
  max,
  step = 1,
  suffix,
  id,
}: InputNumberProps<T>) {
  const { control } = useFormContext<T>();
  const fieldId = id ?? String(name);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = field.value as number | undefined;
        return (
          <FieldShell
            id={fieldId}
            label={label}
            hint={hint}
            error={fieldState.error?.message}
            required={required}
          >
            <div className="relative">
              <Input
                id={fieldId}
                type="number"
                inputMode="numeric"
                placeholder={placeholder}
                disabled={disabled}
                min={min}
                max={max}
                step={step}
                className={suffix ? "pr-12" : undefined}
                value={value ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  field.onChange(raw === "" ? undefined : Number(raw));
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                aria-invalid={fieldState.invalid}
              />
              {suffix ? (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {suffix}
                </span>
              ) : null}
            </div>
          </FieldShell>
        );
      }}
    />
  );
}
