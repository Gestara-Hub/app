"use client";

import Link from "next/link";
import { useAppRouter } from "@/lib/use-app-router";
import { ChevronLeft } from "lucide-react";
import { hasPreviousRoute } from "@/lib/navigation-history";
import { cn } from "@/lib/utils";

/**
 * "‹ Voltar" das telas de detalhe: volta para a tela anterior do app; aberta
 * direto (ou recarregada), vai para `fallbackHref`. Fica dentro de um `<nav>`
 * porque o Next foca o primeiro elemento da pagina ao navegar: no `<nav>` o
 * foco nao pega e o link nao aparece com a moldura de foco.
 */
export function BackLink({ fallbackHref, className }: { fallbackHref: string; className?: string }) {
  const router = useAppRouter();
  return (
    <nav aria-label="Navegação" className={cn("mb-3", className)}>
      <Link
        href={fallbackHref}
        onClick={(event) => {
          // Ctrl/Cmd/Shift abre em outra aba: deixa o link seguir.
          if (event.metaKey || event.ctrlKey || event.shiftKey || !hasPreviousRoute()) return;
          event.preventDefault();
          router.back();
        }}
        className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar
      </Link>
    </nav>
  );
}
