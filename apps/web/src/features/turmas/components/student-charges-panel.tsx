"use client";

import { dateInSpace } from "@gestarahub/core/date";
import { useState } from "react";
import { AlertCircle, FileText, RotateCw, Wallet } from "lucide-react";
import {
  ListContainer,
  ListEmptyState,
  ListRow,
  ListSummaryBar,
  SearchInput,
} from "@/components/shared/list";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isSupabaseOrganization } from "@/lib/session";
import { normalizeText } from "@/lib/text";
import { useCan, useCurrentUser } from "@/features/auth";
import type { ChargeKind, ChargeView, Id } from "@gestarahub/contracts";
import { useCharges } from "../hooks/use-billing";
import {
  ChargeAmount,
  ChargeDetails,
  ChargeStatusBadge,
  KIND_FILTER_LABEL,
  PaidViaBadge,
  RecurringLimitBadge,
  STATUS_FILTERS,
  ScholarshipBadge,
  WhatsAppSentBadge,
  isReplaced,
  matchesStatusFilter,
  statementTitle,
  type StatusFilterValue,
} from "./charge-parts";
import { useChargeActions } from "./use-charge-actions";

/** Mais nova primeiro: vencimento, depois a parcela. */
function newestFirst(a: ChargeView, b: ChargeView): number {
  return b.dueDate.localeCompare(a.dueDate) || (b.cycleIndex ?? 1) - (a.cycleIndex ?? 1);
}

function matchesSearch(c: ChargeView, query: string): boolean {
  if (query === "") return true;
  return [c.description, c.className, c.planName, statementTitle(c)].some(
    (text) => text !== undefined && normalizeText(text).includes(query),
  );
}

/**
 * Extrato do aluno (ficha do aluno, aba Cobranças): todas as cobranças de todos
 * os meses e tipos, da mais nova. Mesmas linhas, selos e ações da tela Cobranças.
 */
/** Anos com pagamento do aluno (do mais recente), para a declaracao. */
function paidYears(charges: ChargeView[]): number[] {
  const years = new Set<number>();
  for (const c of charges) {
    // Ano no fuso do espaco: pago em 31/12 depois das 21h nao vira o ano seguinte (achado V13).
    if (c.status === "paid" && c.paidAt) years.add(Number(dateInSpace(c.paidAt).slice(0, 4)));
  }
  return [...years].sort((a, b) => b - a);
}

/** Declaracao de pagamentos do ano em PDF (gerada no servidor). */
function PaymentsStatementButton({ studentId, years }: { studentId: Id; years: number[] }) {
  const url = (year: number) => `/api/documents/students/${studentId}/payments?ano=${year}`;
  if (years.length === 1) {
    return (
      <Button variant="outline" asChild className="shrink-0">
        <a href={url(years[0])} target="_blank" rel="noopener">
          <FileText className="size-4" />
          Declaração {years[0]}
        </a>
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="shrink-0">
          <FileText className="size-4" />
          Declaração de pagamentos
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {years.map((year) => (
          <DropdownMenuItem key={year} asChild>
            <a href={url(year)} target="_blank" rel="noopener">
              Pagamentos de {year}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StudentChargesPanel({ studentId }: { studentId: Id }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [kindFilter, setKindFilter] = useState<"all" | ChargeKind>("all");
  const { data, isPending: chargesPending, isError, refetch } = useCharges({ studentId });
  const actions = useChargeActions({ describeCharge: true });
  const isPending = chargesPending || (!isError && actions.isOrgPending);
  const can = useCan();
  const serverDocuments = isSupabaseOrganization(useCurrentUser().organizationId) && can("billing:view");
  const years = serverDocuments ? paidYears(data ?? []) : [];

  const all = [...(data ?? [])].sort(newestFirst);
  const ofKind = all.filter((c) => kindFilter === "all" || c.kind === kindFilter);
  const query = normalizeText(search);
  const rows = ofKind.filter((c) => matchesStatusFilter(c, statusFilter) && matchesSearch(c, query));
  const replacedCount = ofKind.filter(isReplaced).length;
  const hasFilters = statusFilter !== "all" || kindFilter !== "all";
  const clearFilters = () => {
    setStatusFilter("all");
    setKindFilter("all");
  };

  let emptyState = null;
  if (isError) {
    emptyState = (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Não foi possível carregar as cobranças.</p>
        <Button variant="outline" onClick={() => refetch()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    );
  } else if (!isPending && rows.length === 0) {
    emptyState = (
      <ListEmptyState
        hasSearch={query !== ""}
        hasFilters={hasFilters}
        onClearSearch={() => setSearch("")}
        onClearFilters={clearFilters}
        searchEmptyMessage="Nenhuma cobrança para esta busca."
        filtersEmptyMessage="Nenhuma cobrança com estes filtros."
        emptyGuide={
          <ModuleEmptyGuide
            icon={<Wallet className="size-8" />}
            title="Nenhuma cobrança ainda."
            description="Mensalidades, cursos, pacotes e avulsas do aluno aparecem aqui."
          />
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar cobrança..."
          aria-label="Buscar cobrança"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as "all" | ChargeKind)}>
            <SelectTrigger className="sm:w-44" aria-label="Filtrar por tipo">
              <SelectValue>{KIND_FILTER_LABEL[kindFilter]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(KIND_FILTER_LABEL) as ("all" | ChargeKind)[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_FILTER_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilterValue)}>
            <SelectTrigger className="sm:w-44" aria-label="Filtrar por situação">
              <SelectValue>{STATUS_FILTERS.find((f) => f.value === statusFilter)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  <span className="flex w-full items-center justify-between gap-3">
                    {f.label}
                    <span className="tabular-nums text-muted-foreground">
                      {ofKind.filter((c) => matchesStatusFilter(c, f.value)).length}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {years.length > 0 ? <PaymentsStatementButton studentId={studentId} years={years} /> : null}
      </div>

      {!isError ? (
        <ListSummaryBar
          count={rows.length}
          singularLabel="cobrança"
          pluralLabel="cobranças"
          isLoading={isPending}
          hasFilters={hasFilters || query !== ""}
          onClearFilters={() => {
            setSearch("");
            clearFilters();
          }}
        />
      ) : null}
      {statusFilter === "all" && replacedCount > 0 ? (
        <p className="-mt-1 px-1 text-xs text-muted-foreground">
          {replacedCount === 1
            ? "1 cobrança substituída por troca de plano ou regra está oculta."
            : `${replacedCount} cobranças substituídas por troca de plano ou regra estão ocultas.`}{" "}
          <button
            type="button"
            onClick={() => setStatusFilter("replaced")}
            className="font-medium text-primary hover:underline"
          >
            Mostrar
          </button>
        </p>
      ) : null}

      <ListContainer emptyState={emptyState}>
        {isPending
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
                <Skeleton className="h-5 w-20 shrink-0" />
              </div>
            ))
          : rows.map((c) =>
              actions.withContextMenu(
                c,
                <ListRow
                  key={c.id}
                  // No celular, valor e acoes descem para baixo do texto.
                  className="flex-wrap gap-y-2 sm:flex-nowrap [&>div:first-child]:basis-full sm:[&>div:first-child]:basis-0 [&>div:last-child]:ml-auto"
                  actions={
                    <div className="flex items-center gap-2">
                      <ChargeAmount charge={c} className="text-sm font-medium tabular-nums" />
                      {actions.renderActions(c, false)}
                    </div>
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{statementTitle(c)}</p>
                    {c.status === "waived" ? null : <ChargeStatusBadge charge={c} />}
                    <PaidViaBadge charge={c} />
                    <ScholarshipBadge charge={c} />
                    <RecurringLimitBadge limitCents={actions.overRecurringLimit(c)} />
                    <WhatsAppSentBadge charge={c} />
                  </div>
                  <ChargeDetails charge={c} showSubject={false} />
                </ListRow>,
              ),
            )}
      </ListContainer>

      {actions.dialogs}
    </div>
  );
}
