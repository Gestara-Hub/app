import Link from "next/link";
import { Button } from "@/components/ui/button";

/** "Anterior" e "Proxima" de uma lista paginada no servidor; `href(page)` monta o endereco. */
export function Pager({ page, hasNext, href }: { page: number; hasNext: boolean; href: (page: number) => string }) {
  if (page === 1 && !hasNext) return null;
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
      <span>Página {page}</span>
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
    </div>
  );
}
