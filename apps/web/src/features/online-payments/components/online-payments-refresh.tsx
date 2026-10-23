"use client";

import { useEffect, useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { elapsedLabel } from "@gestarahub/core/date";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

/**
 * "Atualizado ha X · Atualizar" da Carteira (na linha das abas). Os dados so
 * recarregam no clique; o horario e o mais antigo entre o saldo e o historico
 * na tela (lidos do cache). So o texto do tempo anda, a cada 30 s.
 */
export function OnlinePaymentsRefresh({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  // Muda quando uma leitura comeca ou termina: refaz o horario lido do cache.
  const fetching = useIsFetching({ queryKey: queryKeys.onlinePayments.all }) > 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const cache = queryClient.getQueryCache();
  const balanceAt =
    queryClient.getQueryState([...queryKeys.onlinePayments.all, "balance", organizationId])?.dataUpdatedAt ?? 0;
  const receiptsAt = cache
    .findAll({ queryKey: [...queryKeys.onlinePayments.all, "receipts"] })
    .filter((query) => query.isActive())
    .map((query) => query.state.dataUpdatedAt);
  const loadedAt = [balanceAt, ...receiptsAt].filter((t) => t > 0);
  const lastUpdatedAt = loadedAt.length ? Math.min(...loadedAt) : 0;

  return (
    <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
      <span aria-live="polite">
        {lastUpdatedAt ? `Atualizado ${elapsedLabel(lastUpdatedAt, Math.max(now, lastUpdatedAt))}` : "Carregando..."}
      </span>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setNow(Date.now());
          void queryClient.invalidateQueries({ queryKey: queryKeys.onlinePayments.all });
        }}
        disabled={fetching}
        className="text-muted-foreground"
      >
        <RefreshCw className={cn("size-4", fetching && "animate-spin")} aria-hidden />
        Atualizar
      </Button>
    </div>
  );
}
