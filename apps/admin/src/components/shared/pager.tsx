import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * "Anterior" e "Próxima" de uma lista paginada no servidor; `href(page)` monta o endereço.
 * Com `totalPages` mostra "Página 2 de 7"; sem, só a página atual.
 */
export function Pager({ page, hasNext, href, totalPages }: { page: number; hasNext: boolean; href: (page: number) => string; totalPages?: number }) {
  if (page === 1 && !hasNext) return null;
  return (
    <nav aria-label="Páginas" className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
      <span>{totalPages ? `Página ${page} de ${totalPages}` : `Página ${page}`}</span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline">
            <Link href={href(page - 1)}>Anterior</Link>
          </Button>
        ) : null}
        {hasNext ? (
          <Button asChild variant="outline">
            <Link href={href(page + 1)}>Próxima</Link>
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
