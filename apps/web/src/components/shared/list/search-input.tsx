"use client";

import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchInputProps
  extends Omit<ComponentPropsWithoutRef<"input">, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  /** Espera depois da ultima tecla antes de avisar (ms). 0 = a cada tecla. */
  debounceMs?: number;
}

/**
 * Espera padrao da busca: cada busca e uma ida ao servidor (que carrega o
 * espaco); a cada tecla, um nome de 10 letras enfileirava 10 (doc 19, fase 1).
 */
const SEARCH_DEBOUNCE_MS = 300;

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Buscar...",
  className,
  "aria-label": ariaLabel = "Buscar",
  debounceMs = SEARCH_DEBOUNCE_MS,
  onKeyDown,
  ...props
}: SearchInputProps) {
  // O campo mostra o que se digita na hora; a tela recebe o texto depois da pausa.
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    // A tela mudou o valor (limpar filtros, voltar): o campo acompanha.
    setSynced(value);
    setDraft(value);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const emit = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSynced(next);
    onChange(next);
  };
  const handleChange = (next: string) => {
    setDraft(next);
    if (debounceMs <= 0) return emit(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => emit(next), debounceMs);
  };
  const handleClear = () => {
    setDraft("");
    emit("");
    onClear?.();
  };

  return (
    <div className={cn("relative flex-1", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          // Enter busca na hora, sem esperar a pausa.
          if (e.key === "Enter" && draft !== value) emit(draft);
          onKeyDown?.(e);
        }}
        placeholder={placeholder}
        className="pl-9 pr-8"
        autoComplete="off"
        aria-label={ariaLabel}
        {...props}
      />
      {draft ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Limpar busca"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
