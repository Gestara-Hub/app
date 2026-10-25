"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bug, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openSupport } from "@/features/support";
import { reportError } from "@/lib/log";

// Erro inesperado numa tela do app: mantem o shell e oferece nova tentativa.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Registra (doc technical/21) e mostra o codigo: a queixa leva a linha certa.
  const [reference, setReference] = useState<string | null>(null);
  useEffect(() => {
    void reportError("render", error, { context: { digest: error.digest } }).then(setReference);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <AlertTriangle className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold tracking-tight">
        Algo deu errado
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Não foi possível carregar esta tela. Tente novamente ou volte para o
        início.
      </p>
      {reference ? (
        <p className="text-xs text-muted-foreground">Código do erro: {reference}</p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => reset()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Voltar para o início</Link>
        </Button>
        {reference ? (
          <Button variant="outline" onClick={() => openSupport({ kind: "bug", errorReference: reference })}>
            <Bug className="size-4" />
            Relatar problema
          </Button>
        ) : null}
      </div>
    </div>
  );
}
