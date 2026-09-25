"use client";

import { useCallback, useId, useRef, useState } from "react";
import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FieldShell, fieldAria } from "./field-shell";

export interface MultiSelectOption {
  label: string;
  value: string;
  /** Rotulo do grupo (opcional). Opcoes do mesmo grupo aparecem juntas. */
  group?: string;
  /** Marcador de destaque (ex.: "realiza"), exibido em cor de acento. */
  badge?: string;
}

interface MultiSelectFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  options: MultiSelectOption[];
  /** Quantos badges mostrar antes de colapsar em "+x". */
  maxVisible?: number;
  id?: string;
}

function groupOptions(options: MultiSelectOption[]) {
  const order: string[] = [];
  const map = new Map<string, MultiSelectOption[]>();
  for (const opt of options) {
    const key = opt.group ?? "";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(opt);
  }
  return order.map((key) => ({ heading: key, items: map.get(key)! }));
}

/**
 * Multi-select (combobox) com busca. Mostra os selecionados como badges no
 * trigger; ao passar de `maxVisible`, colapsa o excedente em "+x". O valor do
 * campo e um array de values.
 */
export function MultiSelectField<T extends FieldValues>({
  name,
  label,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado.",
  hint,
  required,
  disabled,
  options,
  maxVisible = 4,
  id,
}: MultiSelectFieldProps<T>) {
  const { control } = useFormContext<T>();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fieldId = id ?? String(name);
  const listId = useId();

  // Indicadores de scroll (a lista do cmdk nao tem setas nativas como o Select):
  // mostram uma setinha no topo/base quando ha mais conteudo a rolar.
  const listRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  // Callback ref: monta os observers quando a lista entra no DOM (timing certo,
  // independente do portal/animacao do Popover).
  const setListNode = useCallback(
    (node: HTMLDivElement | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      listRef.current = node;
      if (!node) return;
      updateScroll();
      const raf = requestAnimationFrame(updateScroll);
      const resize = new ResizeObserver(updateScroll); // layout inicial
      resize.observe(node);
      const mutation = new MutationObserver(updateScroll); // filtragem da busca
      mutation.observe(node, { childList: true, subtree: true });
      cleanupRef.current = () => {
        cancelAnimationFrame(raf);
        resize.disconnect();
        mutation.disconnect();
      };
    },
    [updateScroll],
  );
  const groups = groupOptions(options);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch("");
    }
  };

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected = (field.value as string[] | undefined) ?? [];
        const toggle = (value: string) =>
          field.onChange(
            selected.includes(value)
              ? selected.filter((v) => v !== value)
              : [...selected, value],
          );

        const selectedOptions = options.filter((o) =>
          selected.includes(o.value),
        );
        const visible = selectedOptions.slice(0, maxVisible);
        const overflow = selectedOptions.length - visible.length;

        return (
          <FieldShell
            id={fieldId}
            label={label}
            hint={hint}
            error={fieldState.error?.message}
            required={required}
          >
            <Popover modal={true} open={open} onOpenChange={handleOpenChange}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={label}
                  ref={field.ref}
                  role="combobox"
                  aria-expanded={open}
                  aria-haspopup="listbox"
                  aria-controls={listId}
                  onBlur={field.onBlur}
                  disabled={disabled}
                  {...fieldAria(fieldId, fieldState.error?.message, hint)}
                  className={cn(
                    "flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs outline-none transition-[color,box-shadow] dark:bg-input/30",
                    "focus:border-ring focus:ring-[3px] focus:ring-ring/50",
                    "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  <span className="flex flex-1 flex-wrap items-center gap-1">
                    {selectedOptions.length === 0 ? (
                      <span className="text-muted-foreground">
                        {placeholder}
                      </span>
                    ) : (
                      <>
                        {visible.map((o) => (
                          <Badge
                            key={o.value}
                            variant="secondary"
                            className="gap-1 pr-1 font-normal"
                          >
                            {o.label}
                            <span
                              role="button"
                              tabIndex={-1}
                              aria-label={`Remover ${o.label}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                event.preventDefault();
                                if (!disabled) toggle(o.value);
                              }}
                              className="rounded-sm text-muted-foreground hover:text-foreground"
                            >
                              <X className="size-3" />
                            </span>
                          </Badge>
                        ))}
                        {overflow > 0 ? (
                          <Badge variant="secondary" className="font-normal">
                            +{overflow}
                          </Badge>
                        ) : null}
                      </>
                    )}
                  </span>
                  <ChevronDown className="size-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-[var(--radix-popover-trigger-width)] p-0"
              >
                <Command>
                  <CommandInput
                    ref={inputRef}
                    placeholder={searchPlaceholder}
                    value={search}
                    onValueChange={setSearch}
                  />
                  <div className="relative">
                    <CommandList
                      id={listId}
                      ref={setListNode}
                      onScroll={updateScroll}
                      // overscroll-contain impede o scroll de "vazar" para o
                      // dialog ao bater no topo/fim da lista (scroll chaining).
                      className="overscroll-contain"
                    >
                      <CommandEmpty>{emptyMessage}</CommandEmpty>
                      {groups.map((group) => (
                        <CommandGroup
                          key={group.heading || "default"}
                          heading={group.heading || undefined}
                        >
                          {group.items.map((option) => {
                            const isSelected = selected.includes(option.value);
                            return (
                              <CommandItem
                                key={option.value}
                                value={option.label}
                                onSelect={() => {
                                  toggle(option.value);
                                  requestAnimationFrame(() => {
                                    inputRef.current?.focus();
                                    inputRef.current?.select();
                                  });
                                }}
                              >
                                <Check
                                  className={cn(
                                    "size-4",
                                    isSelected ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                {option.label}
                                {option.badge ? (
                                  <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                    {option.badge}
                                  </span>
                                ) : null}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      ))}
                    </CommandList>
                    {canScrollUp ? (
                      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-6 items-start justify-center bg-gradient-to-b from-popover to-transparent">
                        <ChevronUp className="size-4 text-muted-foreground" />
                      </div>
                    ) : null}
                    {canScrollDown ? (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-6 items-end justify-center bg-gradient-to-t from-popover to-transparent">
                        <ChevronDown className="size-4 text-muted-foreground" />
                      </div>
                    ) : null}
                  </div>
                </Command>
              </PopoverContent>
            </Popover>
          </FieldShell>
        );
      }}
    />
  );
}
