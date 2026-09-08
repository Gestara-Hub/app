"use client";

export interface ListSummaryBarProps {
  count: number;
  singularLabel: string;
  pluralLabel: string;
  hasFilters?: boolean;
  onClearFilters?: () => void;
  className?: string;
}

export function ListSummaryBar({
  count,
  singularLabel,
  pluralLabel,
  hasFilters = false,
  onClearFilters,
  className = "flex items-center justify-between px-1 text-xs text-muted-foreground",
}: ListSummaryBarProps) {
  return (
    <div className={className}>
      <span>
        {count === 1 ? `1 ${singularLabel}` : `${count} ${pluralLabel}`}
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
