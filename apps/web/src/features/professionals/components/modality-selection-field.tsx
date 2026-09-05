"use client";

import type { FieldValues, Path } from "react-hook-form";
import {
  MultiSelectField,
  type MultiSelectOption,
} from "@/components/form/multi-select-field";
import { useCategories } from "@/features/categories";

interface ModalitySelectionFieldProps<T extends FieldValues> {
  name: Path<T>;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Multi-select das modalidades que o instrutor leciona (M3). Reaproveita a
 * entidade Category — no modelo de turmas, "modalidade" É a categoria (Judô,
 * Yoga...). Associação informativa: não restringe as turmas.
 */
export function ModalitySelectionField<T extends FieldValues>({
  name,
  required,
  disabled,
}: ModalitySelectionFieldProps<T>) {
  const { data: categories } = useCategories({ status: "active" });

  const options: MultiSelectOption[] = (categories ?? []).map((category) => ({
    label: category.name,
    value: category.id,
  }));

  return (
    <MultiSelectField<T>
      name={name}
      label="Modalidades que leciona"
      placeholder="Selecione as modalidades (opcional)"
      searchPlaceholder="Buscar modalidade..."
      emptyMessage="Nenhuma modalidade cadastrada."
      hint="Informa o que o instrutor leciona — não limita as turmas."
      options={options}
      required={required}
      disabled={disabled}
    />
  );
}
