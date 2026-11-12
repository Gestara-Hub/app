"use client";

import { useEffect, useState } from "react";
import type { TicketCheckResult } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Button } from "@/components/ui/button";
import { TicketCheckResultView, useCheckInTicket } from "@/features/events";

/**
 * Equipe logada que abriu o ingresso pela camera comum (doc product/29 T4):
 * mostra o resultado e espera o "Confirmar entrada" (abrir o link sozinho nao
 * marca nada). Reserva do leitor dentro do app.
 */
export function StaffCheckIn({ sessionId, code }: { sessionId: string; code: string }) {
  const check = useCheckInTicket(sessionId);
  const [result, setResult] = useState<TicketCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    check
      .mutateAsync({ code, preview: true })
      .then(setResult)
      .catch((err: unknown) => setError(getErrorMessage(err, "Não foi possível conferir o ingresso.")));
    // Confere uma vez ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, sessionId]);

  const confirm = async () => {
    try {
      setResult(await check.mutateAsync({ code, confirm: true }));
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível confirmar a entrada."));
    }
  };

  if (error) return <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>;
  if (!result) return <p className="text-center text-sm text-muted-foreground">Conferindo o ingresso...</p>;
  const canEnter = !result.entered && (result.outcome === "ok" || result.outcome === "payment_pending");
  return (
    <div className="space-y-3">
      <TicketCheckResultView result={result} />
      {canEnter ? (
        <Button className="w-full" onClick={() => void confirm()} disabled={check.isPending}>
          {check.isPending ? "Confirmando..." : "Confirmar entrada"}
        </Button>
      ) : null}
    </div>
  );
}
