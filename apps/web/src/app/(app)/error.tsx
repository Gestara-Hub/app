"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Erro inesperado numa tela do app: mantem o shell e oferece nova tentativa.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
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
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => reset()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Voltar para o início</Link>
        </Button>
      </div>
    </div>
  );
}
