"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function PaginationBar({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  itemLabel = "registros",
  className,
  disabled = false,
}: PaginationBarProps) {
  if (total <= 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // Generate page numbers to show around current page
  const pagesToShow: (number | "ellipsis")[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pagesToShow.push(i);
  } else {
    pagesToShow.push(1);
    if (page > 3) pagesToShow.push("ellipsis");
    const startPage = Math.max(2, page - 1);
    const endPage = Math.min(totalPages - 1, page + 1);
    for (let i = startPage; i <= endPage; i++) {
      pagesToShow.push(i);
    }
    if (page < totalPages - 2) pagesToShow.push("ellipsis");
    pagesToShow.push(totalPages);
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          Mostrando <span className="font-medium text-foreground">{start}</span>–
          <span className="font-medium text-foreground">{end}</span> de{" "}
          <span className="font-medium text-foreground">{total}</span> {itemLabel}
        </span>

        {onPageSizeChange && (
          <div className="ml-2 hidden items-center gap-1.5 sm:flex">
            <span>por página:</span>
            <select
              aria-label="Itens por página"
              value={pageSize}
              disabled={disabled}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-1 sm:justify-end">
        {/* Mobile simple controls */}
        <div className="flex items-center gap-1 sm:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || disabled}
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-4" />
            <span>Anterior</span>
          </Button>
          <span className="px-2 text-xs font-medium text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || disabled}
            aria-label="Próxima página"
          >
            <span>Próxima</span>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Desktop full pagination */}
        <div className="hidden items-center gap-1 sm:flex">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(1)}
            disabled={page <= 1 || disabled}
            aria-label="Primeira página"
            title="Primeira página"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || disabled}
            aria-label="Página anterior"
            title="Página anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <div className="flex items-center gap-0.5 px-1">
            {pagesToShow.map((p, idx) =>
              p === "ellipsis" ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="flex size-8 items-center justify-center text-xs text-muted-foreground"
                >
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="icon-sm"
                  onClick={() => onPageChange(p)}
                  disabled={disabled}
                  aria-label={`Ir para a página ${p}`}
                  aria-current={p === page ? "page" : undefined}
                >
                  {p}
                </Button>
              ),
            )}
          </div>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || disabled}
            aria-label="Próxima página"
            title="Próxima página"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages || disabled}
            aria-label="Última página"
            title="Última página"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
