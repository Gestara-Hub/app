"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ban, Check, ChevronDown, Search, X } from "lucide-react";
import { formatPhone } from "@gestarahub/core/format";
import type { Id } from "@gestarahub/contracts";
import { Input } from "@/components/ui/input";
import { normalizeText } from "@/lib/text";
import { cn } from "@/lib/utils";

/** Teto de linhas renderizadas: com base grande, a busca e que filtra. */
const MAX_ROWS = 50;

export interface StudentPickRow {
  id: Id;
  name: string;
  phone?: string | null;
  /** Presente, a linha aparece desabilitada com este motivo ("já matriculado"). */
  disabledReason?: string;
}

interface StudentMultiSelectProps {
  rows: StudentPickRow[];
  selected: Set<Id>;
  onToggle: (id: Id) => void;
  disabled?: boolean;
  /** Altura maxima da lista (padrao segue a matricula em turma). */
  listClassName?: string;
}

/**
 * Escolha de varios alunos (matricula em turma, inscricao em evento): busca
 * por nome ou telefone, chips dos escolhidos e lista com caixa de marcar.
 * Quem nao pode entrar aparece DESABILITADO com o motivo, em vez de sumir:
 * some da lista faz o atendente achar que o aluno nao existe e cadastrar duplicado.
 */
export function StudentMultiSelect({ rows, selected, onToggle, disabled, listClassName }: StudentMultiSelectProps) {
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [listContainer, setListContainer] = useState<HTMLDivElement | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    if (!listContainer) return;
    setCanScrollUp(listContainer.scrollTop > 6);
    setCanScrollDown(listContainer.scrollHeight - listContainer.scrollTop - listContainer.clientHeight > 6);
  }, [listContainer]);

  const filtered = useMemo(() => {
    const term = normalizeText(search);
    // So compara telefone quando o termo TEM digitos: `includes("")` e sempre
    // verdadeiro e faria a busca por nome casar com a base inteira.
    const digits = term.replace(/\D/g, "");
    return rows.filter((r) => {
      if (!term) return true;
      if (normalizeText(r.name).includes(term)) return true;
      return digits.length > 0 && (r.phone ?? "").replace(/\D/g, "").includes(digits);
    });
  }, [rows, search]);

  const shown = filtered.slice(0, MAX_ROWS);
  const hidden = filtered.length - shown.length;
  const selectedList = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);

  useEffect(() => {
    if (!listContainer) return;
    const resizeObserver = new ResizeObserver(() => checkScroll());
    resizeObserver.observe(listContainer);
    for (const child of Array.from(listContainer.children)) resizeObserver.observe(child);
    const mutationObserver = new MutationObserver(() => checkScroll());
    mutationObserver.observe(listContainer, { childList: true, subtree: true, attributes: true });
    const rafId = requestAnimationFrame(() => checkScroll());
    const timer1 = setTimeout(() => checkScroll(), 60);
    const timer2 = setTimeout(() => checkScroll(), 220);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [listContainer, shown.length, checkScroll]);

  const toggle = (id: Id) => {
    if (disabled) return;
    onToggle(id);
    // Volta para a busca so com teclado fisico: no toque abriria o teclado.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    requestAnimationFrame(() => {
      const input = searchInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    });
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && search.trim()) {
              const availableMatches = shown.filter((r) => !r.disabledReason && !selected.has(r.id));
              if (availableMatches.length === 1) {
                event.preventDefault();
                toggle(availableMatches[0].id);
              }
            }
          }}
          placeholder="Buscar por nome ou telefone..."
          className="px-8"
          autoComplete="off"
          aria-label="Buscar aluno"
          disabled={disabled}
        />
        {search ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              searchInputRef.current?.focus();
            }}
            aria-label="Limpar busca"
            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {selectedList.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedList.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => toggle(r.id)}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-foreground hover:bg-accent"
            >
              {r.name}
              <X className="size-3 text-muted-foreground" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-md border">
        <div
          className={cn(
            "pointer-events-none absolute top-0 right-0 left-0 z-10 h-4 bg-gradient-to-b from-black/10 to-transparent transition-opacity duration-200 dark:from-black/40",
            canScrollUp ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          ref={setListContainer}
          onScroll={checkScroll}
          role="listbox"
          aria-multiselectable
          aria-label="Alunos"
          className={cn("space-y-0.5 overflow-y-auto p-1", listClassName ?? "max-h-[max(18rem,calc(100dvh-30rem))]")}
        >
          {shown.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhum aluno encontrado{search ? ` para "${search}"` : ""}.</p>
          ) : (
            shown.map((r) => {
              const rowDisabled = Boolean(r.disabledReason);
              const checked = selected.has(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  disabled={rowDisabled || disabled}
                  onClick={() => toggle(r.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                    rowDisabled ? "cursor-not-allowed opacity-60" : "hover:bg-accent",
                  )}
                >
                  {rowDisabled ? (
                    <Ban className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    // Caixa decorativa: a propria linha e o alvo clicavel, entao
                    // um <Checkbox> aqui seria um <button> dentro de <button>.
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {checked ? <Check className="size-3" /> : null}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="min-w-0 text-sm break-words">{r.name}</p>
                    {r.phone ? <p className="min-w-0 text-xs break-words text-muted-foreground">{formatPhone(r.phone)}</p> : null}
                  </div>
                  {rowDisabled ? <span className="shrink-0 text-xs text-muted-foreground">{r.disabledReason}</span> : null}
                </button>
              );
            })
          )}
          {hidden > 0 ? <p className="px-2 py-1.5 text-center text-xs text-muted-foreground">Mais {hidden} alunos. Refine a busca.</p> : null}
        </div>
        <div
          className={cn(
            "pointer-events-none absolute right-0 bottom-0 left-0 z-10 h-8 bg-gradient-to-t from-background/95 via-background/50 to-transparent transition-opacity duration-200",
            canScrollDown ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "pointer-events-auto absolute bottom-2 left-1/2 z-20 -translate-x-1/2 transition-all duration-300",
            canScrollDown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
          )}
        >
          <button
            type="button"
            onClick={() => listContainer?.scrollBy({ top: 180, behavior: "smooth" })}
            aria-label="Rolar para ver mais alunos"
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border/80 bg-background/95 px-3 py-1 text-xs font-medium text-muted-foreground shadow-md backdrop-blur-xs transition-all select-none hover:border-border hover:bg-accent hover:text-foreground active:scale-95"
            title="Clique para rolar e ver mais alunos"
          >
            <span>Mais alunos abaixo</span>
            <ChevronDown className="size-3.5 animate-bounce text-primary" />
          </button>
        </div>
      </div>
    </div>
  );
}
