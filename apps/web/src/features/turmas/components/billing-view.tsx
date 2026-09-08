"use client";

import { useState, useSyncExternalStore } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  InitialsAvatar,
  ListContainer,
  ListRow,
} from "@/components/shared/list";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
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
  pending: "border-border/60 bg-muted/50 text-muted-foreground",
  paid: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  overdue: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
  canceled: "border-border/40 bg-muted/30 text-muted-foreground/60 line-through",
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
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{list.length} cobrança(s)</span>
              <span>·</span>
              <span>Total {formatCents(totalCents)}</span>
              <span>·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Pago {formatCents(paidCents)}
              </span>
              {overdue > 0 ? (
                <>
                  <span>·</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {overdue} em atraso
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <ListContainer
            emptyState={
              !isLoading && list.length === 0 ? (
                <div className="py-6">
                  <ModuleEmptyGuide
                    icon={<Wallet className="size-8" />}
                    title="Nenhuma cobrança nesta competência."
                    description={
                      canManage
                        ? 'Gere as mensalidades do mês com "Gerar cobranças".'
                        : "Ainda não há cobranças para o mês selecionado."
                    }
                    actionLabel={canManage ? "Gerar cobranças" : undefined}
                    onAction={canManage ? generate : undefined}
                  />
                </div>
              ) : null
            }
          >
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <Skeleton className="size-9 rounded-full shrink-0" />
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-24 rounded-md shrink-0" />
                </div>
              ))
            ) : (
              list.map((c) => (
                <ListRow
                  key={c.id}
                  actions={
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium tabular-nums text-foreground">
                        {formatCents(c.amountCents)}
                      </span>
                      {canManage ? (
                        c.status === "paid" ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-8"
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
                  }
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <InitialsAvatar name={c.studentName} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-sm text-foreground truncate">
                          {c.studentName}
                        </p>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none shrink-0",
                            STATUS_CLASS[c.status],
                          )}
                        >
                          {STATUS_LABEL[c.status]}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                        {c.className ? <span>{c.className}</span> : null}
                        {c.className && c.planName ? <span>·</span> : null}
                        {c.planName ? <span>{c.planName}</span> : null}
                        <span>·</span>
                        <span>vence {format(parseISO(c.dueDate), "dd/MM")}</span>
                      </div>
                    </div>
                  </div>
                </ListRow>
              ))
            )}
          </ListContainer>
        </div>
      )}
    </>
  );
}
