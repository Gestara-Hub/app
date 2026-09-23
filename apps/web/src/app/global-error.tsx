"use client";

import { useEffect } from "react";
import Link from "next/link";
import "./globals.css";
import { Button } from "@/components/ui/button";

// Erro no root layout: substitui o <html> inteiro (sem providers nem shell).
export default function GlobalError({
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
    <html lang="pt-BR">
      <body className="min-h-full antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Algo deu errado
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Ocorreu um erro inesperado no GestaraHub. Tente novamente.
          </p>
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
