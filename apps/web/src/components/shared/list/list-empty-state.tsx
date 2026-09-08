"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ListEmptyStateProps {
  hasSearch: boolean;
  hasFilters: boolean;
  onClearSearch: () => void;
  onClearFilters: () => void;
  emptyGuide: ReactNode;
  searchEmptyMessage?: string;
  filtersEmptyMessage?: string;
}

export function ListEmptyState({
  hasSearch,
  hasFilters,
  onClearSearch,
  onClearFilters,
  emptyGuide,
  searchEmptyMessage = "Nenhum resultado para esta busca.",
  filtersEmptyMessage = "Nenhum resultado para os filtros aplicados.",
}: ListEmptyStateProps) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Search className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{searchEmptyMessage}</p>
        <Button variant="outline" size="sm" onClick={onClearSearch}>
          Limpar busca
        </Button>
      </div>
    );
  }

  if (hasFilters) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Search className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{filtersEmptyMessage}</p>
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Limpar filtros
        </Button>
      </div>
    );
  }

  return <div className="py-6">{emptyGuide}</div>;
}
