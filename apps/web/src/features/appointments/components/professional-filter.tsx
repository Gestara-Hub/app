"use client";

import { useState } from "react";
import { Check, ChevronDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface ProfessionalOption {
  id: string;
  name: string;
}

interface ProfessionalFilterProps {
  professionals: ProfessionalOption[];
  /** `null` = Todos; `string[]` = subconjunto explicito. */
  value: string[] | null;
  onChange: (value: string[] | null) => void;
}

/**
 * Multi-select standalone (fora de form) para escolher quais profissionais
 * aparecem na Agenda. "Todos" e o padrao e normaliza para `null` — assim
 * profissionais adicionados depois entram automaticamente.
 */
export function ProfessionalFilter({
  professionals,
  value,
  onChange,
}: ProfessionalFilterProps) {
  const [open, setOpen] = useState(false);
  const allIds = professionals.map((p) => p.id);
  const isAll = value === null;
  const selected = new Set(isAll ? allIds : value);

  const toggle = (id: string) => {
    const next = new Set(isAll ? allIds : value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // Todos marcados volta a "Todos" (null); senao guarda o subconjunto na
    // ordem canonica dos profissionais.
    onChange(next.size === allIds.length ? null : allIds.filter((x) => next.has(x)));
  };

  const label = isAll
    ? "Todos os profissionais"
    : value.length === 0
      ? "Nenhum profissional"
      : value.length === 1
        ? (professionals.find((p) => p.id === value[0])?.name ?? "1 profissional")
        : `${value.length} profissionais`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Filtrar profissionais"
          className="justify-between gap-2 sm:w-56"
        >
          <span className="flex items-center gap-2 truncate">
            <Users className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <Command>
          <CommandInput placeholder="Buscar profissional..." />
          <CommandList>
            <CommandEmpty>Nenhum profissional.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="Todos os profissionais"
                onSelect={() => onChange(isAll ? [] : null)}
              >
                <Check className={cn("size-4", isAll ? "opacity-100" : "opacity-0")} />
                Todos os profissionais
              </CommandItem>
            </CommandGroup>
            <CommandGroup>
              {professionals.map((prof) => (
                <CommandItem
                  key={prof.id}
                  value={prof.name}
                  onSelect={() => toggle(prof.id)}
                >
                  <Check
                    className={cn(
                      "size-4",
                      selected.has(prof.id) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {prof.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
