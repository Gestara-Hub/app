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
  /**
   * A lista abre so com os ativos: se nao ha ativo mas ha inativo, o vazio diz
   * isso e leva a eles, em vez de "nenhum cadastrado" (achado 21).
   */
  inactiveLeft?: { count: number; noun: string; onShow: () => void };
}

export function ListEmptyState({
  hasSearch,
  hasFilters,
  onClearSearch,
  onClearFilters,
  emptyGuide,
  searchEmptyMessage = "Nenhum resultado para esta busca.",
  filtersEmptyMessage = "Nenhum resultado para os filtros aplicados.",
  inactiveLeft,
}: ListEmptyStateProps) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Search className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{searchEmptyMessage}</p>
        <Button variant="outline" onClick={onClearSearch}>
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
        <Button variant="outline" onClick={onClearFilters}>
          Limpar filtros
        </Button>
      </div>
    );
  }

  if (inactiveLeft && inactiveLeft.count > 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Search className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {inactiveLeft.noun} ativo no momento. Há {inactiveLeft.count} inativo{inactiveLeft.count === 1 ? "" : "s"}.
        </p>
        <Button variant="outline" onClick={inactiveLeft.onShow}>
          Ver inativos
        </Button>
      </div>
    );
  }

  return <div className="py-6">{emptyGuide}</div>;
}
