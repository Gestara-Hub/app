"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeText } from "@/lib/text";

/** Quantas sugestoes aparecem abaixo do campo. */
const VISIBLE_SUGGESTIONS = 6;

/**
 * Pontos fortes em uma linha: selos com X e "+ Adicionar", que abre o campo com
 * as sugestoes do que o espaco ja usou (sem lista fixa). Digitando, as
 * sugestoes passam a ser as que contem o texto. Termo igual a um ja usado
 * (ignorando maiusculas e acentos) entra com a grafia ja usada.
 */
export function ProgressionTermsEditor({
  title,
  placeholder,
  items,
  suggestions,
  disabled,
  onAdd,
  onRemove,
}: {
  title: string;
  placeholder: string;
  items: string[];
  suggestions: string[];
  disabled?: boolean;
  onAdd: (term: string) => void;
  onRemove: (term: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const itemKeys = new Set(items.map(normalizeText));
  const query = normalizeText(draft);
  const visible = suggestions
    .filter((term) => {
      const key = normalizeText(term);
      return !itemKeys.has(key) && (!query || key.includes(query));
    })
    .slice(0, VISIBLE_SUGGESTIONS);

  function add(term: string) {
    const typed = term.trim();
    if (!typed) return;
    const key = normalizeText(typed);
    const known = suggestions.find((s) => normalizeText(s) === key) ?? typed;
    if (!itemKeys.has(key)) onAdd(known);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v);
            setDraft("");
          }}
          className="text-xs font-medium text-primary hover:underline"
        >
          {adding ? "Fechar" : "+ Adicionar"}
        </button>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(item)}
                disabled={disabled}
                className="opacity-70 hover:opacity-100"
                aria-label={`Remover ${item}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : adding ? null : (
        <p className="text-xs text-muted-foreground">Nenhum ainda.</p>
      )}

      {adding ? (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <Input
              placeholder={placeholder}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) {
                  e.preventDefault();
                  add(draft);
                }
              }}
              className="h-8 text-base md:text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5"
              aria-label={`Adicionar em ${title}`}
              disabled={disabled}
              onClick={() => add(draft)}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
          {visible.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {visible.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => add(term)}
                  className="rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-emerald-500/40 hover:text-foreground"
                >
                  + {term}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
