"use client";

import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { formatPhone } from "@gestarahub/core/format";
import { FieldShell } from "./field-shell";

interface InputPhoneProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

/**
 * Campo de telefone com mascara na digitacao. ARMAZENA apenas os digitos
 * (string, ate 11); a formatacao "(11) 99999-9999" e so de exibicao.
 */
export function InputPhone<T extends FieldValues>({
  name,
  label,
  placeholder = "(11) 99999-9999",
  hint,
  required,
  disabled,
  id,
}: InputPhoneProps<T>) {
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
            type="tel"
            inputMode="numeric"
            placeholder={placeholder}
            disabled={disabled}
            maxLength={15}
            value={formatPhone((field.value as string | undefined) ?? "")}
            onChange={(event) =>
              field.onChange(event.target.value.replace(/\D/g, "").slice(0, 11))
            }
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
