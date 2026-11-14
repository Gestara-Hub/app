"use client";

import { Badge } from "@/components/ui/badge";

/**
 * Selo "Em atraso" (decisao 10A do teste geral; 13/11/2026): o aluno tem
 * alguma cobranca vencida. So para quem ve cobrancas; a lista so recebe os ids
 * (`billing.listOverdueStudentIds`), sem carregar as cobrancas.
 */
export function OverdueBadge({ overdue }: { overdue: boolean | undefined }) {
  if (!overdue) return null;
  return (
    <Badge variant="outline" className="border-overdue/40 bg-overdue/10 text-overdue" title="Tem cobrança vencida">
      Em atraso
    </Badge>
  );
}
