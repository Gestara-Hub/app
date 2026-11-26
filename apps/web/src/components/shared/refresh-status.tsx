"use client";

import { useEffect, useState } from "react";
import { useIsFetching, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { elapsedLabel } from "@gestarahub/core/date";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Atualizado ha X · Atualizar" de uma tela (26/11/2026, Cobrancas; o mesmo
 * da Carteira de Recebimentos online). Os dados so recarregam no clique (o
 * aviso do Asaas grava na hora, mas a tela nao se atualiza sozinha); o horario
 * e o mais antigo entre as leituras dessa chave que estao na tela. So o texto
 * do tempo anda, a cada 30 s.
 */
export function RefreshStatus({ queryKey, className }: { queryKey: QueryKey; className?: string }) {
  const queryClient = useQueryClient();
  // Muda quando uma leitura comeca ou termina: refaz o horario lido do cache.
  const fetching = useIsFetching({ queryKey }) > 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const loadedAt = queryClient
    .getQueryCache()
    .findAll({ queryKey })
    .filter((query) => query.isActive() && query.state.dataUpdatedAt > 0)
    .map((query) => query.state.dataUpdatedAt);
  const lastUpdatedAt = loadedAt.length ? Math.min(...loadedAt) : 0;

  return (
    <div className={cn("flex items-center justify-end gap-1 text-xs text-muted-foreground", className)}>
      <span aria-live="polite">
        {lastUpdatedAt ? `Atualizado ${elapsedLabel(lastUpdatedAt, Math.max(now, lastUpdatedAt))}` : "Carregando..."}
      </span>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setNow(Date.now());
          void queryClient.invalidateQueries({ queryKey });
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
