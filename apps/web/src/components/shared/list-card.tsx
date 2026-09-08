import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Container de listagem: filtros no topo (fora do Card) e a lista de itens
 * (ou estado vazio) dentro do Card, padronizado em todo o sistema.
 */
export function ListCard({
  filters,
  items,
  emptyState,
  className,
}: {
  filters?: ReactNode;
  items: ReactNode[];
  emptyState?: ReactNode;
  className?: string;
}) {
  const card = (
    <Card className={className}>
      <CardContent>
        <div className="space-y-2">{items.length ? items : emptyState}</div>
      </CardContent>
    </Card>
  );

  if (!filters) {
    return card;
  }

  return (
    <div className="space-y-4">
      {filters}
      {card}
    </div>
  );
}
