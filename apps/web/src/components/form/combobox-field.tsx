"use client";

import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Combobox, type ComboboxOption } from "@/components/shared/combobox";
import { FieldShell } from "./field-shell";

interface ComboboxFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  options: ComboboxOption[];
  id?: string;
}

/**
 * Campo de selecao unica COM busca por digitacao (combobox), integrado ao RHF.
 * Mesma UX do filtro de profissionais da Lista; usa o `Combobox` compartilhado.
 * Indicado para listas que podem crescer (clientes, profissionais, servicos) —
 * o `SelectField` continua melhor para conjuntos pequenos e fixos.
 */
export function ComboboxField<T extends FieldValues>({
  name,
  label,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado.",
  hint,
  required,
  disabled,
  clearable,
  options,
  id,
}: ComboboxFieldProps<T>) {
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
          <Combobox
            triggerRef={field.ref}
            value={field.value ?? ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            options={options}
            placeholder={placeholder}
            searchPlaceholder={searchPlaceholder}
            emptyMessage={emptyMessage}
            ariaLabel={label}
            invalid={fieldState.invalid}
            disabled={disabled}
            clearable={clearable}
          />
        </FieldShell>
      )}
    />
  );
}
