"use client";

import { useId, useState } from "react";
import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { FieldShell } from "./field-shell";

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  options: SelectOption[];
  id?: string;
}

/**
 * Campo de selecao unica. Internamente usa DropdownMenu (nao o Select do Radix):
 * o trigger e um <button> nativo que recebe `field.ref`, entao o foco no 1o campo
 * invalido (RHF `shouldFocusError`) funciona — inclusive visualmente, via `focus:`.
 */
export function SelectField<T extends FieldValues>({
  name,
  label,
  placeholder = "Selecione...",
  hint,
  required,
  disabled,
  options,
  id,
}: SelectFieldProps<T>) {
  const { control } = useFormContext<T>();
  const fieldId = id ?? String(name);
  const [open, setOpen] = useState(false);
  const menuId = useId();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected = options.find((o) => o.value === field.value);
        return (
          <FieldShell
            id={fieldId}
            label={label}
            hint={hint}
            error={fieldState.error?.message}
            required={required}
          >
            <DropdownMenu open={open} onOpenChange={setOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={label}
                  ref={field.ref}
                  role="combobox"
                  aria-expanded={open}
                  aria-haspopup="menu"
                  aria-controls={menuId}
                  onBlur={field.onBlur}
                  disabled={disabled}
                  aria-invalid={fieldState.invalid}
                  className={cn(
                    "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] dark:bg-input/30",
                    "focus:border-ring focus:ring-[3px] focus:ring-ring/50",
                    "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    !selected && "text-muted-foreground",
                  )}
                >
                  <span className="truncate">
                    {selected ? selected.label : placeholder}
                  </span>
                  <ChevronDown className="size-4 shrink-0 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                id={menuId}
                align="start"
                className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
              >
                {options.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onSelect={() => field.onChange(option.value)}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </FieldShell>
        );
      }}
    />
  );
}
