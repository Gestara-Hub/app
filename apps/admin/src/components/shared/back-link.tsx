import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** "‹ Voltar" das telas de detalhe (dentro de um <nav>, para o foco do Next cair nele). */
export function BackLink({ href, label = "Voltar" }: { href: string; label?: string }) {
  return (
    <nav aria-label="Voltar" className="mb-3">
      <Link href={href} className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden />
        {label}
      </Link>
    </nav>
  );
}
