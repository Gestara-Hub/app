"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { hasPreviousRoute } from "@/lib/navigation-history";

/**
 * "‹ Voltar" das telas de detalhe: volta para a tela anterior do painel;
 * aberta direto (ou recarregada), vai para `href`. O texto e sempre "Voltar":
 * o destino depende de onde a pessoa veio. Fica dentro de um `<nav>`
 * para o foco do Next nao cair no link ao navegar.
 */
export function BackLink({ href }: { href: string }) {
  const router = useRouter();
  return (
    <nav aria-label="Voltar" className="mb-3">
      <Link
        href={href}
        onClick={(event) => {
          // Ctrl/Cmd/Shift abre em outra aba: deixa o link seguir.
          if (event.metaKey || event.ctrlKey || event.shiftKey || !hasPreviousRoute()) return;
          event.preventDefault();
          router.back();
        }}
        className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Voltar
      </Link>
    </nav>
  );
}
