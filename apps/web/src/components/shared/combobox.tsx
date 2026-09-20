"use client";

import { useCallback, useId, useState, type Ref } from "react";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, X } from "lucide-react";
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

export interface ComboboxOption {
  label: string;
  value: string;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  id?: string;
  ariaLabel?: string;
  invalid?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  onBlur?: () => void;
  triggerRef?: Ref<HTMLButtonElement>;
}

/**
 * Select de uma opcao com busca por digitacao (combobox). Para listas que podem
 * crescer (ex.: profissionais) — diferente do `Select`, que e melhor para
 * conjuntos fixos e pequenos.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Selecione",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado.",
  className,
  id,
  ariaLabel,
  invalid,
  disabled,
  clearable,
  onBlur,
  triggerRef,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const listId = useId();
  const selected = options.find((o) => o.value === value);
  const updateScrollIndicators = useCallback((node: HTMLElement) => {
    setCanScrollUp(node.scrollTop > 1);
    setCanScrollDown(node.scrollTop + node.clientHeight < node.scrollHeight - 1);
  }, []);

  const setListNode = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      requestAnimationFrame(() => updateScrollIndicators(node));
    },
    [updateScrollIndicators],
  );

  return (
    <Popover modal={true} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel}
          aria-invalid={invalid}
          disabled={disabled}
          onBlur={onBlur}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs outline-none transition-[color,box-shadow] dark:bg-input/30",
            "focus:border-ring focus:ring-[3px] focus:ring-ring/50",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='text-'])]:text-muted-foreground",
            className,
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <span className="flex items-center gap-1">
            {clearable && selected && !disabled ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label={`Limpar ${ariaLabel ?? "seleção"}`}
                onClick={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  onChange("");
                }}
                className="pointer-events-auto rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </span>
            ) : null}
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList
            id={listId}
            ref={setListNode}
            onScroll={(event) => updateScrollIndicators(event.currentTarget)}
            className="max-h-[min(16rem,var(--radix-popover-content-available-height))]"
          >
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(clearable && option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      option.value === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {canScrollUp ? (
          <div className="pointer-events-none absolute inset-x-0 top-9 flex h-10 items-start justify-center bg-gradient-to-b from-popover via-popover/90 to-transparent pt-1 text-muted-foreground">
            <ChevronUp className="size-4" />
          </div>
        ) : null}
        {canScrollDown ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-10 items-end justify-center rounded-b-md bg-gradient-to-t from-popover via-popover/90 to-transparent pb-1 text-muted-foreground">
            <ChevronDown className="size-4" />
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
