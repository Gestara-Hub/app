"use client";

import { useState, useSyncExternalStore } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ListItemCard } from "@/components/shared/list-item-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCents } from "@gestarahub/core/format";
import type { CobrancaStatus } from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import {
  useCharges,
  useGenerateCharges,
  useMarkChargePaid,
  useMarkChargePending,
} from "../hooks/use-billing";

const STATUS_LABEL: Record<CobrancaStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
  canceled: "Cancelado",
};
const STATUS_CLASS: Record<CobrancaStatus, string> = {
  pending: "border-border bg-muted/40 text-muted-foreground",
  paid: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400",
  overdue:
    "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
  canceled: "border-border bg-muted/40 text-muted-foreground line-through",
};

export function BillingView() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [competencia, setCompetencia] = useState(() =>
    format(new Date(), "yyyy-MM"),
  );
  const { data: charges, isLoading } = useCharges({ competencia });
  const generateMut = useGenerateCharges();
  const paidMut = useMarkChargePaid();
  const pendingMut = useMarkChargePending();
  const can = useCan();
  const canManage = can("billing:manage");

  const list = charges ?? [];
  const totalCents = list.reduce((s, c) => s + c.amountCents, 0);
  const paidCents = list
    .filter((c) => c.status === "paid")
    .reduce((s, c) => s + c.amountCents, 0);
  const overdue = list.filter((c) => c.status === "overdue").length;

  const generate = () =>
    generateMut.mutate(competencia, {
      onSuccess: (r) =>
        toast.success(
          r.created > 0
            ? `${r.created} cobrança(s) gerada(s).`
            : "Nenhuma cobrança nova (já geradas).",
        ),
    });

  return (
    <>
      <PageHeader
        title="Mensalidades"
        description="Cobranças por competência (mês)."
      >
        {canManage ? (
          <Button onClick={generate} disabled={generateMut.isPending}>
            <Wallet className="size-4" />
            Gerar cobranças
          </Button>
        ) : null}
      </PageHeader>

      {!mounted ? (
        <Skeleton className="h-40 w-full rounded-md" />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Competência</span>
              <Input
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
                className="h-9 w-40"
                aria-label="Competência"
              />
            </label>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>{list.length} cobrança(s)</span>
              <span>Total {formatCents(totalCents)}</span>
              <span>Pago {formatCents(paidCents)}</span>
              {overdue > 0 ? (
                <span className="font-medium text-red-600 dark:text-red-400">
                  {overdue} em atraso
                </span>
              ) : null}
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-40 w-full rounded-md" />
          ) : list.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Sem cobranças nesta competência.
              {canManage ? ' Use "Gerar cobranças".' : ""}
            </p>
          ) : (
            <div className="space-y-2">
              {list.map((c) => (
                <ListItemCard key={c.id} disableHover>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{c.studentName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          c.className,
                          c.planName,
                          `vence ${format(parseISO(c.dueDate), "dd/MM")}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm tabular-nums">
                        {formatCents(c.amountCents)}
                      </span>
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                          STATUS_CLASS[c.status],
                        )}
                      >
                        {STATUS_LABEL[c.status]}
                      </span>
                      {canManage ? (
                        c.status === "paid" ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Desfazer pagamento"
                            onClick={() => pendingMut.mutate(c.id)}
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={paidMut.isPending}
                            onClick={() => paidMut.mutate({ id: c.id })}
                          >
                            <CheckCircle2 className="size-4" />
                            Marcar pago
                          </Button>
                        )
                      ) : null}
                    </div>
                  </div>
                </ListItemCard>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
