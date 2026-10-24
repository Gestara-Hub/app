"use client";

import { useTeamWords } from "@/features/settings";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronDown,
  RotateCw,
  ScrollText,
  ShieldAlert,
} from "lucide-react";
import { format, parseISO, subDays, startOfMonth, endOfMonth } from "date-fns";
import { todayISO } from "@gestarahub/core/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ListContainer,
  ListEmptyState,
  ListRow,
  ListSummaryBar,
  SearchInput,
} from "@/components/shared/list";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import {
  auditActionLabel,
  auditEntityTypeLabel,
  userProfileLabel,
} from "@/lib/labels";
import { formatDateTime } from "@gestarahub/core/format";
import type { AuditEntityType, AuditLogEntry, AuditLogFilter, OperationalModel } from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
import { useUsers } from "@/features/users";
import { useAuditLog } from "../hooks/use-audit-log";
import { AuditLogDetailDialog } from "./audit-log-detail-dialog";

const ENTITY_TYPES_BY_MODEL: Record<OperationalModel, AuditEntityType[]> = {
  scheduling: ["appointment", "client", "service", "category", "role", "professional", "user", "settings", "subscription"],
  classes: [
    "client",
    "category",
    "class_group",
    "enrollment",
    "assessment",
    "plan",
    "lesson_package",
    "charge",
    "professional",
    "user",
    "settings",
    "financial_entry",
    "financial_category",
    "teacher_pay_rule",
    "teacher_payout",
    "online_payment",
    "subscription",
  ],
  delivery: ["client", "service", "category", "role", "professional", "user", "settings", "subscription"],
};

function AuditRow({
  entry,
  onSelect,
}: {
  entry: AuditLogEntry;
  onSelect: (entry: AuditLogEntry) => void;
}) {
  const team = useTeamWords();
  const model = useModel();
  return (
    <ListRow
      onClick={() => onSelect(entry)}
      canClick
      aria-label={`Detalhes: ${entry.summary}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {auditActionLabel(entry.action)}
            </span>
            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {auditEntityTypeLabel(entry.target.type, model, team.title)}
            </span>
            {entry.failed ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                <AlertTriangle className="size-3" />
                Falhou
              </span>
            ) : null}
            {entry.security ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                <ShieldAlert className="size-3" />
                Sensível
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {entry.summary}
          </p>

          {entry.changes && entry.changes.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {entry.changes.map((c) => (
                <span
                  key={c.field}
                  className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  <span className="font-medium text-foreground">{c.label}:</span>
                  <span className="line-through">{c.before}</span>
                  <span aria-hidden>→</span>
                  <span className="text-foreground">{c.after}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-xs font-medium text-muted-foreground">
            {formatDateTime(entry.timestamp)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entry.actor.name}
            <span className="text-muted-foreground/70">
              {" "}
              · {entry.source ? "Automático" : userProfileLabel(entry.actor.profile, team.title)}
            </span>
          </p>
        </div>
      </div>
    </ListRow>
  );
}

function SkeletonRows() {
  return Array.from({ length: 5 }).map((_, i) => (
    <div
      key={i}
      className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5"
    >
      <div className="space-y-1.5 min-w-0 flex-1">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-4 w-28 shrink-0" />
    </div>
  ));
}

type DatePreset = "all" | "today" | "7d" | "30d" | "month" | "custom";

export function AuditLogList() {
  const team = useTeamWords();
  const model = useModel();
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState<"all" | AuditEntityType>("all");
  const [actorId, setActorId] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  // Calcula datas para o filtro
  const { dateFrom, dateTo } = useMemo(() => {
    // O dia de hoje no fuso do espaco (doc technical/22).
    const now = parseISO(todayISO());
    if (datePreset === "today") {
      const today = format(now, "yyyy-MM-dd");
      return { dateFrom: today, dateTo: today };
    }
    if (datePreset === "7d") {
      return {
        dateFrom: format(subDays(now, 7), "yyyy-MM-dd"),
        dateTo: format(now, "yyyy-MM-dd"),
      };
    }
    if (datePreset === "30d") {
      return {
        dateFrom: format(subDays(now, 30), "yyyy-MM-dd"),
        dateTo: format(now, "yyyy-MM-dd"),
      };
    }
    if (datePreset === "month") {
      return {
        dateFrom: format(startOfMonth(now), "yyyy-MM-dd"),
        dateTo: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    }
    if (datePreset === "custom") {
      return {
        dateFrom: customFrom || undefined,
        dateTo: customTo || undefined,
      };
    }
    return { dateFrom: undefined, dateTo: undefined };
  }, [datePreset, customFrom, customTo]);

  const filter: AuditLogFilter = useMemo(
    () => ({
      search: search.trim() || undefined,
      entityType: entityType === "all" ? undefined : entityType,
      // "Responsavel": pessoas, sistema, so o que falhou ou um usuario.
      ...(actorId === "kind:user" ? { actorKind: "user" as const } : {}),
      ...(actorId === "kind:system" ? { actorKind: "system" as const } : {}),
      ...(actorId === "failed" ? { failed: true } : {}),
      actorId: actorId === "all" || actorId.startsWith("kind:") || actorId === "failed" ? undefined : actorId,
      dateFrom,
      dateTo,
    }),
    [search, entityType, actorId, dateFrom, dateTo],
  );

  const { data, isPending, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useAuditLog(filter);
  const entries = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  // Busca lista de usuários para o filtro de responsáveis
  const { data: usersData } = useUsers();
  const actorOptions = useMemo(() => {
    const map = new Map<string, string>();
    (usersData ?? []).forEach((u) => map.set(u.id, u.name));
    entries.forEach((e) => {
      // O sistema entra pela opcao "Sistema", nao como usuario.
      if (e.actor?.userId && !e.source && !map.has(e.actor.userId)) {
        map.set(e.actor.userId, e.actor.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [usersData, entries]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
  };
  const handleEntityTypeChange = (val: "all" | AuditEntityType) => {
    setEntityType(val);
  };
  const handleActorIdChange = (val: string) => {
    setActorId(val);
  };
  const handleDatePresetChange = (val: DatePreset) => {
    setDatePreset(val);
  };
  const handleCustomFromChange = (val: string) => {
    setCustomFrom(val);
  };
  const handleCustomToChange = (val: string) => {
    setCustomTo(val);
  };

  const hasSearch = Boolean(filter.search);
  const hasFilters = Boolean(
    filter.search ||
    filter.entityType ||
    filter.actorId ||
    filter.actorKind ||
    filter.failed ||
    datePreset !== "all"
  );

  const clearSearch = () => {
    setSearch("");
  };
  const clearAll = () => {
    setSearch("");
    setEntityType("all");
    setActorId("all");
    setDatePreset("all");
    setCustomFrom("");
    setCustomTo("");
  };

  // Total do banco (com os filtros); a lista traz uma pagina por vez.
  const totalCount = data?.pages[0]?.total ?? 0;
  const visibleEntries = entries;
  const hasMore = Boolean(hasNextPage);

  let items: ReactNode[] = [];
  let emptyState: ReactNode = null;

  if (isPending) {
    items = [<SkeletonRows key="skeleton" />];
  } else if (isError) {
    emptyState = (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertTriangle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar o log de auditoria. Tente novamente.
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    );
  } else if (entries.length === 0) {
    emptyState = (
      <ListEmptyState
        hasSearch={hasSearch}
        hasFilters={hasFilters}
        onClearSearch={clearSearch}
        onClearFilters={clearAll}
        emptyGuide={
          <ModuleEmptyGuide
            icon={<ScrollText className="size-8" />}
            title="Nenhum evento registrado."
            description="Tente ajustar os filtros ou o período para encontrar os eventos desejados."
          />
        }
      />
    );
  } else {
    items = visibleEntries.map((entry) => (
      <AuditRow key={entry.id} entry={entry} onSelect={setSelected} />
    ));
  }

  return (
    <>
      <div className="space-y-4">
        {/* Barra de Filtros Compostos */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            onClear={clearSearch}
            placeholder="Buscar no histórico..."
            aria-label="Buscar no log de auditoria"
            className="w-full"
          />

          <Select
            value={entityType}
            onValueChange={handleEntityTypeChange}
          >
            <SelectTrigger className="w-full" aria-label="Filtrar por tipo">
              <SelectValue placeholder="Tipo de registro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {ENTITY_TYPES_BY_MODEL[model].map((type) => (
                <SelectItem key={type} value={type}>
                  {auditEntityTypeLabel(type, model, team.title)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={actorId}
            onValueChange={handleActorIdChange}
          >
            <SelectTrigger className="w-full" aria-label="Filtrar por responsável">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="kind:user">Pessoas</SelectItem>
              <SelectItem value="kind:system">Sistema (rotinas e pagamentos)</SelectItem>
              <SelectItem value="failed">Só o que falhou</SelectItem>
              {actorOptions.map((actor) => (
                <SelectItem key={actor.id} value={actor.id}>
                  {actor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={datePreset}
            onValueChange={(val) => handleDatePresetChange(val as DatePreset)}
          >
            <SelectTrigger className="w-full" aria-label="Filtrar por período">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo o período</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Linha extra para Datas Personalizadas se selecionado */}
        {datePreset === "custom" ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-3">
            <span className="text-xs font-medium text-muted-foreground">
              Intervalo personalizado:
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">De:</span>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => handleCustomFromChange(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Até:</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => handleCustomToChange(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
          </div>
        ) : null}

        {/* Contador / Resumo */}
        {!isError ? (
          <ListSummaryBar
            isLoading={isPending}
            count={totalCount}
            singularLabel="evento registrado"
            pluralLabel="eventos registrados"
            hasFilters={hasFilters}
            onClearFilters={clearAll}
          />
        ) : null}

        {/* Container Unificado da Lista */}
        <ListContainer emptyState={emptyState}>
          {items}
        </ListContainer>

        {/* Botão Carregar Mais Eventos */}
        {!isPending && !isError && entries.length > 0 ? (
          hasMore ? (
            <div className="flex flex-col items-center justify-center pt-2 pb-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="gap-2 text-xs font-medium"
              >
                <ChevronDown className="size-3.5" />
                {isFetchingNextPage
                  ? "Carregando..."
                  : `Carregar mais eventos (${visibleEntries.length} de ${totalCount})`}
              </Button>
            </div>
          ) : (data?.pages.length ?? 0) > 1 ? (
            <p className="text-center text-xs text-muted-foreground pt-2 pb-4">
              Você chegou ao fim dos eventos deste período ({totalCount} eventos).
            </p>
          ) : null
        ) : null}
      </div>

      <AuditLogDetailDialog
        entry={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}
