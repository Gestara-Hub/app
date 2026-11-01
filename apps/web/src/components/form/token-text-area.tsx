"use client";

import { Fragment, useId, useRef, useState, type KeyboardEvent } from "react";
import { Controller, useFormContext, type FieldValues, type Path } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FieldShell, fieldAria } from "./field-shell";

export interface TextToken {
  /** O que vai dentro das chaves ("aluno" vira "{aluno}"). */
  key: string;
  /** Nome amigavel na lista ("Aluno"). */
  label: string;
}

interface TokenTextAreaProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  id?: string;
  /** Variaveis aceitas: destacadas no campo e sugeridas ao digitar "{". */
  tokens: readonly TextToken[];
}

const TOKEN_RE = /\{(\w+)\}/g;

const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** O "{" aberto antes do cursor (sem "}" depois dele) e o que ja foi digitado. */
function openToken(value: string, caret: number): { start: number; typed: string } | null {
  const match = /\{(\w*)$/.exec(value.slice(0, caret));
  return match ? { start: match.index, typed: match[1] } : null;
}

/**
 * Campo de texto com variaveis entre chaves: as conhecidas aparecem destacadas
 * (as desconhecidas em vermelho) e digitar "{" abre a lista para escolher, com
 * setas e Enter. O texto fica num fundo com a mesma fonte, atras do textarea
 * (que escreve transparente): o navegador continua cuidando de cursor,
 * selecao e rolagem.
 */
export function TokenTextArea<T extends FieldValues>({
  name,
  label,
  placeholder,
  hint,
  required,
  disabled,
  rows = 3,
  maxLength,
  id,
  tokens,
}: TokenTextAreaProps<T>) {
  const { control } = useFormContext<T>();
  const fieldId = id ?? String(name);
  const listId = useId();
  const backdropRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [open, setOpen] = useState<{ start: number; typed: string } | null>(null);
  const [active, setActive] = useState(0);
  const known = new Set(tokens.map((t) => t.key));

  const suggestions = open
    ? tokens.filter((t) => {
        const typed = fold(open.typed);
        return !typed || fold(t.key).startsWith(typed) || fold(t.label).startsWith(typed);
      })
    : [];

  function syncList() {
    const el = textareaRef.current;
    if (!el) return;
    const next = openToken(el.value, el.selectionStart ?? el.value.length);
    setOpen(next);
    setActive(0);
  }

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = (field.value as string | undefined) ?? "";

        function pick(token: TextToken) {
          const el = textareaRef.current;
          if (!el) return;
          // Le o campo de verdade, nao o estado: entre uma tecla e outra o estado pode estar um passo atras.
          const current = el.value;
          const caret = el.selectionStart ?? current.length;
          const at = openToken(current, caret);
          if (!at) return;
          const inserted = `{${token.key}}`;
          const next = `${current.slice(0, at.start)}${inserted}${current.slice(caret)}`;
          field.onChange(next);
          setOpen(null);
          requestAnimationFrame(() => {
            el.focus();
            const end = at.start + inserted.length;
            el.setSelectionRange(end, end);
          });
        }

        function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
          if (!open || suggestions.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((i) => (i + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
          } else if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            pick(suggestions[active]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(null);
          }
        }

        const parts: { text: string; kind: "plain" | "known" | "unknown" }[] = [];
        let last = 0;
        for (const match of value.matchAll(TOKEN_RE)) {
          const at = match.index ?? 0;
          if (at > last) parts.push({ text: value.slice(last, at), kind: "plain" });
          parts.push({ text: match[0], kind: known.has(match[1]) ? "known" : "unknown" });
          last = at + match[0].length;
        }
        if (last < value.length) parts.push({ text: value.slice(last), kind: "plain" });
        const listOpen = open !== null && suggestions.length > 0;

        return (
          <FieldShell id={fieldId} label={label} hint={hint} error={fieldState.error?.message} required={required}>
            <div className="relative">
              {/* Mesma caixa, fonte e espacamento do textarea; a quebra de linha final precisa de um caractere para contar. */}
              <div
                ref={backdropRef}
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-transparent px-3 py-2 text-base whitespace-pre-wrap break-words text-foreground md:text-sm"
              >
                {parts.map((part, index) => (
                  <Fragment key={index}>
                    {part.kind === "plain" ? (
                      part.text
                    ) : (
                      <mark
                        className={cn(
                          "rounded-sm bg-transparent px-0.5 -mx-0.5",
                          part.kind === "known" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive",
                        )}
                      >
                        {part.text}
                      </mark>
                    )}
                  </Fragment>
                ))}
                {value.endsWith("\n") ? "​" : null}
              </div>
              <Textarea
                id={fieldId}
                placeholder={placeholder}
                disabled={disabled}
                rows={rows}
                maxLength={maxLength}
                value={value}
                onChange={(event) => {
                  field.onChange(event.target.value);
                  // O cursor ja esta depois do que foi digitado.
                  const next = openToken(event.target.value, event.target.selectionStart ?? event.target.value.length);
                  setOpen(next);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                onClick={syncList}
                onKeyUp={(event) => {
                  if (event.key.startsWith("Arrow") && !open) syncList();
                }}
                onBlur={() => {
                  field.onBlur();
                  setOpen(null);
                }}
                onScroll={(event) => {
                  if (backdropRef.current) backdropRef.current.scrollTop = event.currentTarget.scrollTop;
                }}
                name={field.name}
                ref={(el) => {
                  textareaRef.current = el;
                  field.ref(el);
                }}
                className="relative bg-transparent text-transparent caret-foreground selection:bg-primary/20 dark:bg-transparent"
                autoComplete="off"
                spellCheck={false}
                role="combobox"
                aria-expanded={listOpen}
                aria-controls={listOpen ? listId : undefined}
                aria-activedescendant={listOpen ? `${listId}-${active}` : undefined}
                aria-autocomplete="list"
                {...fieldAria(fieldId, fieldState.error?.message, hint)}
              />
              {listOpen ? (
                <ul
                  id={listId}
                  role="listbox"
                  aria-label="Variáveis"
                  className="absolute top-full left-0 z-50 mt-1 max-h-56 w-64 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                >
                  {suggestions.map((token, index) => (
                    <li
                      key={token.key}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === active}
                      // mousedown, nao click: o textarea nao perde o foco antes de inserir.
                      onMouseDown={(event) => {
                        event.preventDefault();
                        pick(token);
                      }}
                      onMouseEnter={() => setActive(index)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm",
                        index === active && "bg-accent text-accent-foreground",
                      )}
                    >
                      <span>{token.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">{`{${token.key}}`}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </FieldShell>
        );
      }}
    />
  );
}
