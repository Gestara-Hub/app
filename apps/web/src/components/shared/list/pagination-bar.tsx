"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { singularLabel } from "@/lib/text";
import { cn } from "@/lib/utils";
import { scrollToListStart } from "./list-scroll";

export interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  screenKey?: string;
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
  screenKey,
  itemLabel = "registros",
  className,
  disabled = false,
}: PaginationBarProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  if (total <= 0) return null;

  // A barra fica embaixo: trocar de pagina leva a tela ao inicio da lista.
  const goTo = (next: number) => {
    onPageChange(next);
    scrollToListStart(rootRef.current);
  };

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

  // Setas duplas (« e ») so aparecem quando ha mais de 5 paginas no total
  const showFirstLast = totalPages > 5;

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          Mostrando{" "}
          <span className="font-medium text-foreground">
            {start === end ? start : `${start}–${end}`}
          </span>{" "}
          de <span className="font-medium text-foreground">{total}</span>{" "}
          {total === 1 ? singularLabel(itemLabel) : itemLabel}
        </span>

        {onPageSizeChange && (
          <>
            <span className="text-border" aria-hidden>·</span>
            <div className="flex items-center gap-1.5">
              <span>por página:</span>
              <Select
                value={String(pageSize)}
                disabled={disabled}
                onValueChange={(value) => {
                  const newSize = Number(value);
                  onPageSizeChange(newSize);
                  scrollToListStart(rootRef.current);
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("gestarahub:pagesize-change", {
                        detail: { screenKey, pageSize: newSize },
                      }),
                    );
                  }
                }}
              >
                <SelectTrigger size="sm" className="h-7 w-auto min-w-14 text-xs" aria-label="Itens por página">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((opt) => (
                    <SelectItem key={opt} value={String(opt)}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-1 sm:justify-end">
          {/* Mobile simple controls */}
          <div className="flex items-center gap-1 sm:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goTo(page - 1)}
              disabled={page <= 1 || disabled}
              className="h-8 gap-1 border-border/60 text-xs disabled:opacity-25"
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-3.5" />
              <span>Anterior</span>
            </Button>
            <span className="px-2 text-xs font-medium text-muted-foreground">
              {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goTo(page + 1)}
              disabled={page >= totalPages || disabled}
              className="h-8 gap-1 border-border/60 text-xs disabled:opacity-25"
              aria-label="Próxima página"
            >
              <span>Próxima</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          {/* Desktop full pagination */}
          <div className="hidden items-center gap-1 sm:flex">
            {showFirstLast && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => goTo(1)}
                disabled={page <= 1 || disabled}
                className="disabled:opacity-25 text-muted-foreground hover:text-foreground"
                aria-label="Primeira página"
                title="Primeira página"
              >
                <ChevronsLeft className="size-4" />
              </Button>
            )}

            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => goTo(page - 1)}
              disabled={page <= 1 || disabled}
              className="disabled:opacity-25 border-border/60 text-muted-foreground hover:text-foreground"
              aria-label="Página anterior"
              title="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>

            <div className="flex items-center gap-0.5 px-0.5">
              {pagesToShow.map((p, idx) =>
                p === "ellipsis" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="flex size-8 items-center justify-center text-xs text-muted-foreground select-none"
                  >
                    …
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "ghost"}
                    size="icon-sm"
                    onClick={() => goTo(p)}
                    disabled={disabled}
                    className={cn(
                      "text-xs font-medium transition-colors",
                      p === page
                        ? "shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/70",
                    )}
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
              onClick={() => goTo(page + 1)}
              disabled={page >= totalPages || disabled}
              className="disabled:opacity-25 border-border/60 text-muted-foreground hover:text-foreground"
              aria-label="Próxima página"
              title="Próxima página"
            >
              <ChevronRight className="size-4" />
            </Button>

            {showFirstLast && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => goTo(totalPages)}
                disabled={page >= totalPages || disabled}
                className="disabled:opacity-25 text-muted-foreground hover:text-foreground"
                aria-label="Última página"
                title="Última página"
              >
                <ChevronsRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
