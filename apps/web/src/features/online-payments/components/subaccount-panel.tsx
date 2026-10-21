"use client";

import type { OnlinePaymentMethod } from "@gestarahub/contracts";
import { ONLINE_METHOD_LABEL } from "@gestarahub/core/payment-fees";
import {
  periodFromPreset,
  periodLabel,
  PeriodRangePicker,
  type PeriodRange,
} from "@/components/shared/period-range-picker";
import { PaginationBar } from "@/components/shared/list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReceiptStatusFilter, SubaccountReceiptItem } from "@/services/onlinePaymentsBackend";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LINK_PAYMENT_METHOD_LABEL } from "@gestarahub/core/payment-fees";
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

const RECEIPT_STATUS_MAP: Record<
  string,
  { label: string; className: string }
> = {
  paid: {
    label: "Pago",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  awaiting: {
    label: "Aguardando",
    className:
      "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  expired: {
    label: "Expirado",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  canceled: {
    label: "Cancelado",
    className:
      "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
};

const TRANSFER_STATUS_MAP: Record<
  string,
  { label: string; className: string }
> = {
  DONE: {
    label: "Concluída",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  BANK_PROCESSING: {
    label: "Em processamento",
    className:
      "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  CANCELLED: {
    label: "Cancelada",
    className:
      "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
  FAILED: {
    label: "Falhou",
    className:
      "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
};

export function SubaccountPanel({
  organizationId,
  defaultPixKey = "",
}: SubaccountPanelProps) {
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [tab, setTab] = useState<"receipts" | "transfers">("receipts");

  const balanceQuery = useSubaccountBalance(organizationId);
  const transfersQuery = useSubaccountTransfers(organizationId);
  // Filtros do historico (no banco): mes, situacao (abre em pagas e aguardando) e forma.
  // Periodo: abre em "Este mes"; sugestoes de trimestre, semestre e ano, ou intervalo livre.
  const [period, setPeriod] = useState<PeriodRange>(() => periodFromPreset("this_month"));
  const [statusFilter, setStatusFilter] = useState<ReceiptStatusFilter>("open");
  const [methodFilter, setMethodFilter] = useState<"all" | OnlinePaymentMethod>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const receiptsQuery = useSubaccountReceipts({
    organizationId,
    from: period.from,
    to: period.to,
    status: statusFilter,
    method: methodFilter,
    page,
    pageSize,
  });
  const hasFilters = statusFilter !== "open" || methodFilter !== "all" || period.preset !== "this_month";
  const clearFilters = () => {
    setPeriod(periodFromPreset("this_month"));
    setStatusFilter("open");
    setMethodFilter("all");
    setPage(1);
  };

  const availableCents = balanceQuery.data?.availableForTransferCents ?? 0;
  const awaitingCents = balanceQuery.data?.awaitingCents ?? 0;
  const receipts = receiptsQuery.data?.items ?? [];
  const receiptsTotal = receiptsQuery.data?.total ?? 0;
  const summary = receiptsQuery.data?.summary;
  const transfers = transfersQuery.data || [];


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
            <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-950 dark:text-emerald-100">
              {balanceQuery.isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                formatCents(availableCents)
              )}
            </div>
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
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {balanceQuery.isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                formatCents(awaitingCents)
              )}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
            Liberação em 30 dias (D+30)
          </div>
        </div>

        {/* Total Recebido Líquido */}
        <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>{period.preset === "this_month" ? "Recebido líquido no mês" : "Recebido líquido no período"}</span>
              <Receipt className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {receiptsQuery.isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                formatCents(summary?.netCents ?? 0)
              )}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
            Taxas: {formatCents(summary?.feeCents ?? 0)} · {periodLabel(period).toLowerCase()}
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
              Recebimentos
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
            <div className="space-y-3">
              {/* Filtros: mes, situacao e forma */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <PeriodRangePicker
                  value={period}
                  onChange={(next) => {
                    setPeriod(next);
                    setPage(1);
                  }}
                  className="sm:min-w-56"
                />
                <div className="grid grid-cols-1 gap-2 sm:flex">
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                      setStatusFilter(v as ReceiptStatusFilter);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-44" aria-label="Filtrar por situação">
                      <SelectValue>{RECEIPT_STATUS_FILTER_LABEL[statusFilter]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(RECEIPT_STATUS_FILTER_LABEL) as ReceiptStatusFilter[]).map((v) => (
                        <SelectItem key={v} value={v}>
                          {RECEIPT_STATUS_FILTER_LABEL[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={methodFilter}
                    onValueChange={(v) => {
                      setMethodFilter(v as "all" | OnlinePaymentMethod);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-40" aria-label="Filtrar por forma">
                      <SelectValue>{methodFilter === "all" ? "Todas as formas" : ONLINE_METHOD_LABEL[methodFilter]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as formas</SelectItem>
                      {(Object.keys(ONLINE_METHOD_LABEL) as OnlinePaymentMethod[]).map((m) => (
                        <SelectItem key={m} value={m}>
                          {ONLINE_METHOD_LABEL[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {hasFilters ? (
                <div className="flex justify-end px-1 text-xs">
                  <button type="button" onClick={clearFilters} className="cursor-pointer font-medium text-foreground hover:underline">
                    Limpar filtros
                  </button>
                </div>
              ) : null}

            <div className="overflow-x-auto rounded-lg border border-border/60">
              {receipts.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  {hasFilters
                    ? "Nenhuma movimentação com estes filtros."
                    : "Nenhuma movimentação neste período."}
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3.5 py-2.5 font-medium">Data / Hora</th>
                      <th className="px-3.5 py-2.5 font-medium">Método</th>
                      <th className="px-3.5 py-2.5 font-medium">Valor Bruto</th>
                      <th className="px-3.5 py-2.5 font-medium">Taxas</th>
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
                              {r.method === "pix"
                                ? "Pix"
                                : `${RECEIPT_METHOD_LABEL[r.method] ?? "Link"}${
                                    r.paidMethod ? ` · ${LINK_PAYMENT_METHOD_LABEL[r.paidMethod]}` : ""
                                  }`}
                            </Badge>
                          </td>
                          <td className="px-3.5 py-2.5 font-medium text-foreground">
                            <div className="flex items-center gap-1.5">
                              <span>{formatCents(r.amountCents)}</span>
                              {r.feePassedToCustomer ? (
                                <Badge
                                  variant="secondary"
                                  className="h-4 px-1 text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-normal"
                                >
                                  Repassada
                                </Badge>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-muted-foreground">
                            <FeesPopover receipt={r} />
                          </td>
                          <td
                            className={cn(
                              "px-3.5 py-2.5 font-medium",
                              r.status === "paid" && "font-semibold text-emerald-600 dark:text-emerald-400",
                              r.status === "awaiting" && "text-foreground",
                              (r.status === "canceled" || r.status === "expired") &&
                                "text-muted-foreground line-through opacity-70",
                            )}
                          >
                            {r.method !== "pix" && !r.paidMethod && r.status === "awaiting"
                              ? `a partir de ${formatCents(r.netAmountCents)}`
                              : formatCents(r.netAmountCents)}
                          </td>
                          <td className="px-3.5 py-2.5">
                            {(() => {
                              const badge = RECEIPT_STATUS_MAP[r.status] || {
                                label: r.status,
                                className: "border-border/60 bg-muted/50 text-muted-foreground",
                              };
                              return (
                                <div className="flex flex-col items-start gap-1">
                                  <span
                                    title={r.canceledReason}
                                    className={cn(
                                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none shrink-0",
                                      badge.className,
                                    )}
                                  >
                                    {badge.label}
                                  </span>
                                  {r.canceledReason ? (
                                    <span
                                      title={r.canceledReason}
                                      className="text-[10px] text-muted-foreground whitespace-normal leading-tight max-w-[150px]"
                                    >
                                      {r.canceledReason}
                                    </span>
                                  ) : null}
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

              {receiptsTotal > 0 ? (
                <PaginationBar
                  page={page}
                  pageSize={pageSize}
                  total={receiptsTotal}
                  totalPages={Math.max(1, Math.ceil(receiptsTotal / pageSize))}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  itemLabel="movimentações"
                  disabled={receiptsQuery.isFetching}
                />
              ) : null}
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
                            {(() => {
                              const badge = TRANSFER_STATUS_MAP[t.status] || {
                                label: t.status,
                                className: "border-border/60 bg-muted/50 text-muted-foreground",
                              };
                              return (
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none shrink-0",
                                    badge.className,
                                  )}
                                >
                                  {badge.label}
                                </span>
                              );
                            })()}
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

const RECEIPT_STATUS_FILTER_LABEL: Record<ReceiptStatusFilter, string> = {
  open: "Pagas e aguardando",
  paid: "Pagas",
  awaiting: "Aguardando",
  canceled: "Canceladas",
  all: "Todas",
};

/** Forma gerada, no historico (o meio usado entra depois do ponto, quando o Asaas confirma). */
const RECEIPT_METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  link: "Cartão",
  boleto: "Boleto",
  choice: "Escolha do aluno",
};

/**
 * "Taxas" do historico: o total (Asaas + GestaraHub) com um popup que explica
 * cada parte. Clique (funciona no celular); no link ainda nao pago, avisa que
 * e a estimativa pelo credito.
 */
function FeesPopover({ receipt: r }: { receipt: SubaccountReceiptItem }) {
  const total = r.gatewayFeeCents + r.splitAmountCents;
  // Fora o Pix, o meio so e conhecido no pagamento: antes disso a tarifa e a maior possivel.
  const estimated = r.method !== "pix" && !r.paidMethod && r.gatewayFeeCents > 0;
  const methodLabel =
    r.method === "pix" || r.paidMethod === "pix"
      ? "Pix"
      : r.paidMethod === "boleto"
        ? "boleto"
        : r.paidMethod
          ? `cartão de ${LINK_PAYMENT_METHOD_LABEL[r.paidMethod].toLowerCase()}`
          : "meio mais caro da forma escolhida";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
          aria-label="Ver o detalhe das taxas"
        >
          {estimated ? "até " : ""}- {formatCents(total)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2.5 text-xs">
        <p className="text-sm font-medium text-foreground">Taxas desta cobrança</p>
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">
              Tarifa do Asaas
              <span className="block text-[11px]">
                {r.gatewayFeeCents > 0 ? `Pelo ${methodLabel}, cobrada pelo banco.` : "Não registrada nesta cobrança."}
              </span>
            </span>
            <span className="shrink-0 font-medium text-foreground">
              {r.gatewayFeeCents > 0 ? formatCents(r.gatewayFeeCents) : "—"}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">
              Taxa GestaraHub
              <span className="block text-[11px]">Fixa por cobrança recebida.</span>
            </span>
            <span className="shrink-0 font-medium text-foreground">{formatCents(r.splitAmountCents)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-1.5 font-semibold text-foreground">
            <span>Total</span>
            <span>{formatCents(total)}</span>
          </div>
        </div>
        {estimated ? (
          <p className="text-[11px] text-muted-foreground">
            O aluno ainda não pagou. A tarifa mostrada é a maior possível nesta forma; se ele pagar por um meio mais
            barato, é menor. Quando o Asaas confirmar, fica o valor real.
          </p>
        ) : null}
        {r.feePassedToCustomer ? (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
            Taxas repassadas: o aluno pagou o acréscimo.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
