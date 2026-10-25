"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { plural } from "@gestarahub/core/format";

export interface ListSummaryBarProps {
  count: number;
  singularLabel: string;
  pluralLabel: string;
  isLoading?: boolean;
  hasFilters?: boolean;
  onClearFilters?: () => void;
  className?: string;
}

export function ListSummaryBar({
  count,
  singularLabel,
  pluralLabel,
  isLoading = false,
  hasFilters = false,
  onClearFilters,
  className = "flex items-center justify-between px-1 text-xs text-muted-foreground",
}: ListSummaryBarProps) {
  if (isLoading) {
    return (
      <div className={className} aria-hidden="true">
        <Skeleton className="h-4 w-36 rounded-sm" />
      </div>
    );
  }

  if (count === 0) return null;

  return (
    <div className={className}>
      <span>
        {plural(count, singularLabel, pluralLabel)}
      </span>
      {hasFilters && onClearFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="text-primary hover:underline"
        >
          Limpar filtros
        </button>
      ) : null}
    </div>
  );
}
