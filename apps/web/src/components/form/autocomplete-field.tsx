"use client";

import { useState } from "react";
import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { normalizeText } from "@/lib/text";
import { FieldShell } from "./field-shell";

interface AutocompleteFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  /** Opcoes sugeridas (ex.: cargos cadastrados). Vazio = nao sugere nada. */
  suggestions: string[];
  maxSuggestions?: number;
  /**
   * Select-only: o valor deve ser uma das `suggestions`. Texto que nao casa e
   * limpo no blur (e mostra `emptyMessage` enquanto digita). Sem isto, aceita
   * texto livre.
   */
  strict?: boolean;
  emptyMessage?: string;
  id?: string;
}

/**
 * Campo de texto com sugestoes (autocomplete) e filtro conforme se digita. Em
 * modo `strict`, funciona como um select com busca: so aceita valores das
 * `suggestions`.
 */
export function AutocompleteField<T extends FieldValues>({
  name,
  label,
  placeholder,
  hint,
  required,
  disabled,
  suggestions,
  maxSuggestions = 8,
  strict = false,
  emptyMessage = "Nenhum resultado.",
  id,
}: AutocompleteFieldProps<T>) {
  const { control } = useFormContext<T>();
  const [open, setOpen] = useState(false);
  const fieldId = id ?? String(name);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = (field.value as string | undefined) ?? "";
        const query = normalizeText(value);
        const matches = suggestions
          .filter((s) => {
            const n = normalizeText(s);
            return n !== query && (query === "" || n.includes(query));
          })
          .slice(0, maxSuggestions);
        const hasAnyMatch = suggestions.some(
          (s) => query === "" || normalizeText(s).includes(query),
        );
        // Em strict, avisa quando o texto digitado nao casa com nenhuma opcao.
        const showEmpty = strict && open && query !== "" && !hasAnyMatch;
        const showList = open && (matches.length > 0 || showEmpty);

        return (
          <FieldShell
            id={fieldId}
            label={label}
            hint={hint}
            error={fieldState.error?.message}
            required={required}
          >
            <div className="relative">
              <Input
                id={fieldId}
                ref={field.ref}
                name={field.name}
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete="off"
                aria-invalid={fieldState.invalid}
                onChange={(event) => {
                  field.onChange(event.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                  field.onBlur();
                  setOpen(false);
                  // strict: ao sair, alinha ao valor canonico ou limpa se invalido.
                  if (strict && value.trim() !== "") {
                    const canonical = suggestions.find(
                      (s) => normalizeText(s) === query,
                    );
                    if (canonical !== value) field.onChange(canonical ?? "");
                  }
                }}
              />
              {showList ? (
                <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto overscroll-contain rounded-md border bg-popover py-1 text-popover-foreground shadow-md">
                  {matches.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      // mousedown preventDefault mantem o foco no input (sem blur);
                      // a selecao acontece no click.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        field.onChange(suggestion);
                        setOpen(false);
                      }}
                      className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                  {showEmpty ? (
                    <p className="px-3 py-1.5 text-sm text-muted-foreground">
                      {emptyMessage}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </FieldShell>
        );
      }}
    />
  );
}
