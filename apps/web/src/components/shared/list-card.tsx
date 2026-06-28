import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Container de listagem (baseado no old/gestarahub-web): um Card com area de
 * filtros no topo e a lista de itens (ou o estado vazio) abaixo.
 */
export function ListCard({
  filters,
  items,
  emptyState,
}: {
  filters?: ReactNode;
  items: ReactNode[];
  emptyState: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        {filters}
        <div className="space-y-2">{items.length ? items : emptyState}</div>
      </CardContent>
    </Card>
  );
}
