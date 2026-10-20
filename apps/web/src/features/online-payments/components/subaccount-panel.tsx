"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  ExternalLink,
  History,
  QrCode,
  Receipt,
} from "lucide-react";
import { formatCents } from "@gestarahub/core/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useSubaccountBalance,
  useSubaccountTransfers,
  useSubaccountReceipts,
} from "../hooks/use-online-payments";
import { SubaccountTransferDialog } from "./subaccount-transfer-dialog";

interface SubaccountPanelProps {
  organizationId: string;
  defaultPixKey?: string;
}

export function SubaccountPanel({
  organizationId,
  defaultPixKey = "",
}: SubaccountPanelProps) {
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [tab, setTab] = useState<"receipts" | "transfers">("receipts");

  const balanceQuery = useSubaccountBalance(organizationId);
  const transfersQuery = useSubaccountTransfers(organizationId);
  const receiptsQuery = useSubaccountReceipts(organizationId);

  const availableCents = balanceQuery.data?.availableForTransferCents ?? 0;
  const awaitingCents = balanceQuery.data?.awaitingCents ?? 0;
  const receipts = receiptsQuery.data || [];
  const transfers = transfersQuery.data || [];

  const totalReceivedCents = receipts
    .filter((r) => r.status === "paid")
    .reduce((acc, r) => acc + r.amountCents, 0);

  const totalSplitCents = receipts
    .filter((r) => r.status === "paid")
    .reduce((acc, r) => acc + r.splitAmountCents, 0);

  return (
    <div className="space-y-6">
      {/* Métricas Principais (Cards limpos) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Saldo Disponível */}
        <div className="flex flex-col justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-emerald-800 dark:text-emerald-300">
              <span>Disponível para saque</span>
              <ArrowDownLeft className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-950 dark:text-emerald-100">
              {balanceQuery.isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                formatCents(availableCents)
              )}
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between pt-2 border-t border-emerald-500/15">
            <span className="text-[11px] text-muted-foreground">
              Liquidação imediata (D+0)
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setTransferDialogOpen(true)}
              disabled={availableCents <= 0}
              className="h-7 text-xs border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
            >
              <ArrowUpRight className="mr-1 size-3" />
              Sacar Pix
            </Button>
          </div>
        </div>

        {/* Saldo a Compensar */}
        <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>A compensar (Cartão)</span>
              <Clock className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {balanceQuery.isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                formatCents(awaitingCents)
              )}
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
            Liberação em 30 dias (D+30)
          </div>
        </div>

        {/* Total Recebido Líquido */}
        <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Total recebido líquido</span>
              <Receipt className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {receiptsQuery.isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                formatCents(totalReceivedCents - totalSplitCents)
              )}
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
            Taxas retidas: {formatCents(totalSplitCents)}
          </div>
        </div>
      </div>

      {/* Extrato e Movimentações */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold">
            Histórico de Movimentações
          </CardTitle>

          {/* Seletor de Abas do Extrato */}
          <div
            role="tablist"
            className="inline-flex gap-1 rounded-lg bg-muted/50 p-1 text-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "receipts"}
              onClick={() => setTab("receipts")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors cursor-pointer",
                tab === "receipts"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <QrCode className="size-3.5" />
              Recebimentos ({receipts.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "transfers"}
              onClick={() => setTab("transfers")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors cursor-pointer",
                tab === "transfers"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <History className="size-3.5" />
              Saques ({transfers.length})
            </button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {tab === "receipts" ? (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              {receipts.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  Nenhum pagamento online recebido ainda.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3.5 py-2.5 font-medium">Data / Hora</th>
                      <th className="px-3.5 py-2.5 font-medium">Método</th>
                      <th className="px-3.5 py-2.5 font-medium">Valor Bruto</th>
                      <th className="px-3.5 py-2.5 font-medium">Taxa Retida</th>
                      <th className="px-3.5 py-2.5 font-medium">Valor Líquido</th>
                      <th className="px-3.5 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {receipts.map((r) => {
                      const dateFormatted = new Date(
                        r.paidAt || r.createdAt,
                      ).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      });

                      return (
                        <tr key={r.id} className="hover:bg-muted/30">
                          <td className="px-3.5 py-2.5 text-muted-foreground">
                            {dateFormatted}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {r.method === "pix" ? "Pix" : "Link"}
                            </Badge>
                          </td>
                          <td className="px-3.5 py-2.5 font-medium text-foreground">
                            {formatCents(r.amountCents)}
                          </td>
                          <td className="px-3.5 py-2.5 text-muted-foreground">
                            - {formatCents(r.splitAmountCents)}
                          </td>
                          <td className="px-3.5 py-2.5 font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCents(r.netAmountCents)}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <Badge
                              variant={r.status === "paid" ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {r.status === "paid"
                                ? "Pago"
                                : r.status === "awaiting"
                                  ? "Aguardando"
                                  : r.status === "expired"
                                    ? "Expirado"
                                    : "Cancelado"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}

          {tab === "transfers" ? (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              {transfers.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  Nenhum saque realizado ainda.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3.5 py-2.5 font-medium">Data</th>
                      <th className="px-3.5 py-2.5 font-medium">Valor do Saque</th>
                      <th className="px-3.5 py-2.5 font-medium">Status</th>
                      <th className="px-3.5 py-2.5 font-medium text-right">
                        Comprovante
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {transfers.map((t) => {
                      const dateFormatted = new Date(
                        t.dateCreated,
                      ).toLocaleDateString("pt-BR");

                      return (
                        <tr key={t.id} className="hover:bg-muted/30">
                          <td className="px-3.5 py-2.5 text-muted-foreground">
                            {dateFormatted}
                          </td>
                          <td className="px-3.5 py-2.5 font-semibold text-foreground">
                            {formatCents(t.valueCents)}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <Badge
                              variant={t.status === "DONE" ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {t.status === "DONE"
                                ? "Concluída"
                                : t.status === "BANK_PROCESSING"
                                  ? "Em processamento"
                                  : t.status === "CANCELLED"
                                    ? "Cancelada"
                                    : t.status}
                            </Badge>
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            {t.receiptUrl ? (
                              <a
                                href={t.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                              >
                                Ver comprovante
                                <ExternalLink className="size-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <SubaccountTransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        organizationId={organizationId}
        availableCents={availableCents}
        defaultPixKey={defaultPixKey}
      />
    </div>
  );
}
