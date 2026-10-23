"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./globals.css";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/log";

// Erro no root layout: substitui o <html> inteiro (sem providers nem shell).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Registra (doc technical/21) e mostra o codigo: a queixa leva a linha certa.
  const [reference, setReference] = useState<string | null>(null);
  useEffect(() => {
    void reportError("render-root", error, { context: { digest: error.digest } }).then(setReference);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="min-h-full antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Algo deu errado
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Ocorreu um erro inesperado no GestaraHub. Tente novamente.
          </p>
          {reference ? (
            <p className="text-xs text-muted-foreground">Código do erro: {reference}</p>
          ) : null}
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => reset()}>Tentar novamente</Button>
            <Button variant="outline" asChild>
              <Link href="/">Voltar para o início</Link>
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
