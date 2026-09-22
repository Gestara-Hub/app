"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  RotateCw,
  ScrollText,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { AuditEntityType, AuditLogEntry, OperationalModel } from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
import { useAuditLog } from "../hooks/use-audit-log";
import { AuditLogDetailDialog } from "./audit-log-detail-dialog";

const ENTITY_TYPES_BY_MODEL: Record<OperationalModel, AuditEntityType[]> = {
  scheduling: ["appointment", "client", "service", "category", "role", "professional", "user", "settings"],
  classes: [
    "client",
    "category",
    "class_group",
    "enrollment",
    "plan",
    "charge",
    "professional",
    "user",
    "settings",
  ],
  delivery: ["client", "service", "category", "role", "professional", "user", "settings"],
};

function AuditRow({
  entry,
  onSelect,
}: {
  entry: AuditLogEntry;
  onSelect: (entry: AuditLogEntry) => void;
}) {
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
              {auditEntityTypeLabel(entry.target.type, model)}
            </span>
            {entry.security ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
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
              · {userProfileLabel(entry.actor.profile)}
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

export function AuditLogList() {
  const model = useModel();
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState<"all" | AuditEntityType>("all");
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const filter = {
    search: search.trim() || undefined,
    entityType: entityType === "all" ? undefined : entityType,
  };

  const { data, isPending, isError, refetch } = useAuditLog(filter);
  const entries = data ?? [];

  const hasSearch = Boolean(filter.search);
  const hasFilters = Boolean(filter.search || filter.entityType);

  const clearSearch = () => setSearch("");
  const clearAll = () => {
    setSearch("");
    setEntityType("all");
  };

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
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    );
  } else if (entries.length === 0) {
    emptyState = (
      <ListEmptyState
        hasSearch={hasSearch}
        hasFilters={Boolean(filter.entityType)}
        onClearSearch={clearSearch}
        onClearFilters={clearAll}
        emptyGuide={
          <ModuleEmptyGuide
            icon={<ScrollText className="size-8" />}
            title="Nenhum evento registrado ainda."
            description="As ações feitas no sistema (agendamentos, cadastros, acessos) aparecem aqui."
          />
        }
      />
    );
  } else {
    items = entries.map((entry) => (
      <AuditRow key={entry.id} entry={entry} onSelect={setSelected} />
    ));
  }

  return (
    <>
      <div className="space-y-4">
        {/* Barra de Filtros */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            onClear={clearSearch}
            placeholder="Buscar no histórico..."
            aria-label="Buscar no log de auditoria"
          />

          <Select
            value={entityType}
            onValueChange={(value) =>
              setEntityType(value as "all" | AuditEntityType)
            }
          >
            <SelectTrigger className="sm:w-44" aria-label="Filtrar por tipo">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {ENTITY_TYPES_BY_MODEL[model].map((type) => (
                <SelectItem key={type} value={type}>
                  {auditEntityTypeLabel(type, model)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Contador / Resumo */}
        {!isPending && !isError && entries.length > 0 ? (
          <ListSummaryBar
            count={entries.length}
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
