"use client";

import { Controller, useFormContext, type FieldValues, type Path } from "react-hook-form";
import { fieldAria, fieldErrorId } from "./field-shell";

interface CheckboxFieldProps<T extends FieldValues = FieldValues> {
  name: Path<T>;
  label: string;
  id?: string;
  className?: string;
}

/** Caixa de marcar com o erro do schema logo abaixo do texto. */
export function CheckboxField<T extends FieldValues = FieldValues>({ name, label, id, className }: CheckboxFieldProps<T>) {
  const { control } = useFormContext<T>();
  const fieldId = id ?? String(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={className}>
          <label className="flex items-start gap-2 text-sm">
            <input
              id={fieldId}
              type="checkbox"
              className="mt-1"
              checked={Boolean(field.value)}
              onChange={(event) => field.onChange(event.target.checked)}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              {...fieldAria(fieldId, fieldState.error?.message)}
            />
            <span>{label}</span>
          </label>
          {fieldState.error?.message ? (
            <p id={fieldErrorId(fieldId)} role="alert" className="mt-1 text-xs text-destructive">
              {fieldState.error.message}
            </p>
          ) : null}
        </div>
      )}
    />
  );
}
