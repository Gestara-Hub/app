"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RecordStatus } from "@gestarahub/contracts";

export interface StatusFilterSelectProps {
  value: "all" | RecordStatus;
  onChange: (value: "all" | RecordStatus) => void;
  gender?: "male" | "female";
  className?: string;
}

export function StatusFilterSelect({
  value,
  onChange,
  gender = "male",
  className = "sm:w-36",
}: StatusFilterSelectProps) {
  const isFemale = gender === "female";
  const allLabel = isFemale ? "Todas" : "Todos";
  const activeLabel = isFemale ? "Ativas" : "Ativos";
  const inactiveLabel = isFemale ? "Inativas" : "Inativos";

  const currentLabel =
    value === "active"
      ? activeLabel
      : value === "inactive"
        ? inactiveLabel
        : allLabel;

  return (
    <Select
      value={value}
      onValueChange={(val) => onChange(val as "all" | RecordStatus)}
    >
      <SelectTrigger className={className} aria-label="Filtrar por status">
        <SelectValue placeholder="Status">{currentLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        <SelectItem value="active">{activeLabel}</SelectItem>
        <SelectItem value="inactive">{inactiveLabel}</SelectItem>
      </SelectContent>
    </Select>
  );
}
