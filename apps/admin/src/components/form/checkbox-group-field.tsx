"use client";

import { Controller, useFormContext, type FieldValues, type Path } from "react-hook-form";
import { cn } from "@/lib/utils";
import { fieldErrorId } from "./field-shell";

interface CheckboxGroupFieldProps<T extends FieldValues = FieldValues> {
  name: Path<T>;
  legend: string;
  options: readonly (readonly [string, string])[];
  columns?: boolean;
  id?: string;
}

/** Varias caixas de marcar que viram uma lista no formulario (ex.: planos, areas). */
export function CheckboxGroupField<T extends FieldValues = FieldValues>({ name, legend, options, columns, id }: CheckboxGroupFieldProps<T>) {
  const { control } = useFormContext<T>();
  const fieldId = id ?? String(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected = (field.value as string[] | undefined) ?? [];
        return (
          <fieldset aria-describedby={fieldState.error ? fieldErrorId(fieldId) : undefined}>
            <legend className="sr-only">{legend}</legend>
            <div className={cn(columns ? "grid gap-2 sm:grid-cols-2" : "flex flex-wrap gap-4")}>
              {options.map(([value, text]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(value)}
                    onChange={(event) => field.onChange(event.target.checked ? [...selected, value] : selected.filter((v) => v !== value))}
                    onBlur={field.onBlur}
                  />
                  {text}
                </label>
              ))}
            </div>
            {fieldState.error?.message ? (
              <p id={fieldErrorId(fieldId)} role="alert" className="mt-1 text-xs text-destructive">
                {fieldState.error.message}
              </p>
            ) : null}
          </fieldset>
        );
      }}
    />
  );
}
