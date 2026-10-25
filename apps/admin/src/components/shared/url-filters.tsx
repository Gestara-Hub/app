"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchInput } from "./list/search-input";

/** Troca parâmetros do endereço (e volta para a página 1): a lista é renderizada no servidor com o que está no endereço. */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const set = useCallback(
    (changes: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      next.delete("page");
      const query = next.toString();
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );
  return { params, set, pending, pathname };
}

/** Busca por texto no endereço (`?q=`), com a pausa de digitação do app dos clientes. */
export function UrlSearch({ param = "q", placeholder = "Buscar...", ariaLabel = "Buscar" }: { param?: string; placeholder?: string; ariaLabel?: string }) {
  const { params, set } = useUrlParams();
  return <SearchInput value={params.get(param) ?? ""} onChange={(value) => set({ [param]: value.trim() || undefined })} placeholder={placeholder} aria-label={ariaLabel} />;
}

/** Lista de escolha no endereço; `allLabel` é a opção sem filtro. */
export function UrlSelect({
  param,
  options,
  allLabel,
  ariaLabel,
  className = "sm:w-44",
}: {
  param: string;
  options: readonly (readonly [string, string])[];
  allLabel: string;
  ariaLabel: string;
  className?: string;
}) {
  const { params, set } = useUrlParams();
  const value = params.get(param) ?? "__all";
  const current = options.find(([option]) => option === value)?.[1] ?? allLabel;
  return (
    <Select value={value} onValueChange={(next) => set({ [param]: next === "__all" ? undefined : next })}>
      <SelectTrigger className={cn("w-full", className)} aria-label={ariaLabel}>
        <SelectValue>{current}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">{allLabel}</SelectItem>
        {options.map(([option, label]) => (
          <SelectItem key={option} value={option}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** "Limpar filtros" quando há algum parâmetro de filtro no endereço. */
export function UrlClearFilters({ params: names }: { params: string[] }) {
  const { params, set } = useUrlParams();
  if (!names.some((name) => params.get(name))) return null;
  return (
    <Button variant="ghost" onClick={() => set(Object.fromEntries(names.map((name) => [name, undefined])))}>
      Limpar filtros
    </Button>
  );
}
