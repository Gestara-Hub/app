"use client";

import type { FieldValues, Path } from "react-hook-form";
import {
  MultiSelectField,
  type MultiSelectOption,
} from "@/components/form/multi-select-field";
import { useServices } from "@/features/services";
import { useCategories } from "@/features/categories";

interface ServiceSelectionFieldProps<T extends FieldValues> {
  name: Path<T>;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Multi-select dos servicos que o profissional realiza, agrupado por categoria.
 * Wrapper de MultiSelectField alimentado por useServices + useCategories.
 */
export function ServiceSelectionField<T extends FieldValues>({
  name,
  required,
  disabled,
}: ServiceSelectionFieldProps<T>) {
  const { data: services } = useServices({ status: "active" });
  const { data: categories } = useCategories({ status: "active" });

  const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const options: MultiSelectOption[] = (services ?? []).map((service) => ({
    label: service.name,
    value: service.id,
    group: categoryName.get(service.categoryId) ?? "Outros",
  }));

  return (
    <MultiSelectField<T>
      name={name}
      label="Serviços realizados"
      placeholder="Selecione os serviços..."
      searchPlaceholder="Buscar serviço..."
      emptyMessage="Nenhum serviço encontrado."
      options={options}
      required={required}
      disabled={disabled}
    />
  );
}
