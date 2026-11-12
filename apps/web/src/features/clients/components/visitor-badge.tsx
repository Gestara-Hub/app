"use client";

import { Badge } from "@/components/ui/badge";

/**
 * Selo "Visitante" (doc product/29, decisao 2; 11/11/2026): veio so para evento,
 * sem matricula, plano ou pacote. Some sozinho quando passa a frequentar.
 */
export function VisitorBadge({ visitor }: { visitor: boolean | undefined }) {
  if (!visitor) return null;
  return (
    <Badge
      variant="outline"
      className="border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300"
      title="Veio só para evento: sem matrícula, plano ou pacote"
    >
      Visitante
    </Badge>
  );
}
