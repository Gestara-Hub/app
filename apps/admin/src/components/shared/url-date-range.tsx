"use client";

import { Input } from "@/components/ui/input";
import { useUrlParams } from "./url-filters";

/** Dois campos de data opcionais no endereço (`?from=` e `?to=`, AAAA-MM-DD). */
export function UrlDateRange({ fromParam = "from", toParam = "to" }: { fromParam?: string; toParam?: string }) {
  const { params, set } = useUrlParams();
  const from = params.get(fromParam) ?? "";
  const to = params.get(toParam) ?? "";
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
      <label className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        De
        <Input key={`from-${from}`} type="date" aria-label="Data inicial" className="min-w-0 flex-1 sm:w-40 sm:flex-none" defaultValue={from} max={to || undefined} onChange={(event) => set({ [fromParam]: event.target.value || undefined })} />
      </label>
      <label className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        até
        <Input key={`to-${to}`} type="date" aria-label="Data final" className="min-w-0 flex-1 sm:w-40 sm:flex-none" defaultValue={to} min={from || undefined} onChange={(event) => set({ [toParam]: event.target.value || undefined })} />
      </label>
    </div>
  );
}
