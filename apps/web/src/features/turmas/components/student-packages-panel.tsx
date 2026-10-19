"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Ban, ChevronDown, Plus, RefreshCw, Ticket } from "lucide-react";
import {
  ListContainer,
  ListEmptyState,
  ListRow,
  ListSummaryBar,
  SearchInput,
} from "@/components/shared/list";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeText, withKind } from "@/lib/text";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { plural } from "@gestarahub/core/format";
import type { Id, StudentPackageStatus, StudentPackageView } from "@gestarahub/contracts";
import { useCancelStudentPackage, useStudentPackages } from "../hooks/use-packages";
import { useClassGroups } from "../hooks/use-turmas";
import { StudentPackageBadge } from "./student-package-badge";
import { canCancelPackage, canRenewPackage } from "../package-actions";

type StatusFilter = "all" | StudentPackageStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos os pacotes" },
  { value: "active", label: "Em uso" },
  { value: "renewed", label: "Renovados" },
  { value: "canceled", label: "Cancelados" },
];

const ddmmyy = (iso: string) => format(parseISO(iso), "dd/MM/yy");

function EndedBadge({ status }: { status: Exclude<StudentPackageStatus, "active"> }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        status === "renewed"
          ? "border-border/60 bg-muted/50 text-muted-foreground"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700 line-through dark:text-amber-400",
      )}
    >
      {status === "renewed" ? "Renovado" : "Cancelado"}
    </span>
  );
}

/** "comprado 01/09/26 · vale até 30/10/26 · todas as turmas" (ou "3 de 10 aulas usadas · ..." quando encerrado/vencido). */
function packageFacts(pkg: StudentPackageView): string {
  const showUsed = pkg.status !== "active" || pkg.isExpired;
  return [
    showUsed
      ? `${pkg.lessonsUsed} de ${pkg.lessonsTotal} ${pkg.lessonsTotal === 1 ? "aula usada" : "aulas usadas"}`
      : null,
    `comprado ${ddmmyy(pkg.purchasedAt)}`,
    pkg.expiresAt ? `${pkg.isExpired ? "venceu" : "vale até"} ${ddmmyy(pkg.expiresAt)}` : "sem validade",
    pkg.classNames.length > 0
      ? pkg.classNames.join(", ")
      : pkg.modalityNames.length > 0
        ? pkg.modalityNames.join(", ")
        : "todas as turmas",
    pkg.carriedOverLessons ? `${plural(pkg.carriedOverLessons, "aula trazida", "aulas trazidas")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Pacotes do aluno (ficha do aluno, aba Pacotes): saldo, avisos, aulas usadas
 * e as acoes de renovar e cancelar. Vender e renovar abrem o dialogo da tela
 * (`onSell`), que tambem atende o "Vender pacote" do topo. O botao de vender
 * fica sempre na barra: com pacote em uso a venda renova, e cancelado ou
 * renovado nao impede vender outro.
 */
export function StudentPackagesPanel({
  studentId,
  canManage,
  onSell,
}: {
  studentId: Id;
  canManage: boolean;
  /** Renovar passa o pacote do catalogo; vender, nada. */
  onSell?: (packageId?: Id) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [expanded, setExpanded] = useState<Record<Id, boolean>>({});
  const { data, isPending } = useStudentPackages({ studentId });
  const { data: classes } = useClassGroups();
  const cancelMut = useCancelStudentPackage();
  const { confirm, dialog } = useConfirmAction();

  const classNameById = useMemo(
    () => new Map((classes ?? []).map((g) => [g.id, g.name])),
    [classes],
  );
  const query = normalizeText(search);
  const rows = (data ?? []).filter(
    (p) => (status === "all" || p.status === status) && (query === "" || normalizeText(p.name).includes(query)),
  );
  const hasFilters = status !== "all";

  async function cancel(pkg: StudentPackageView) {
    const ok = await confirm({
      title: "Cancelar pacote?",
      description: `O ${withKind("pacote", pkg.name)} é cancelado. As cobranças em aberto dele também; as pagas ficam.`,
      confirmLabel: "Cancelar pacote",
      cancelLabel: "Voltar",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await cancelMut.mutateAsync(pkg.id);
      toast.success("Pacote cancelado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível cancelar o pacote."));
    }
  }

  const toggle = (id: Id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  function actionsFor(pkg: StudentPackageView): ListItemAction[] {
    return [
      ...(pkg.usages.length > 0
        ? [
            {
              key: "usages",
              label: expanded[pkg.id] ? "Ocultar aulas" : "Ver aulas usadas",
              icon: <ChevronDown className="size-4" />,
              onSelect: () => toggle(pkg.id),
            },
          ]
        : []),
      ...(canManage && onSell && canRenewPackage(pkg)
        ? [
            {
              key: "renew",
              label: "Renovar",
              icon: <RefreshCw className="size-4" />,
              onSelect: () => onSell(pkg.packageId),
            },
          ]
        : []),
      ...(canManage && canCancelPackage(pkg)
        ? [
            {
              key: "cancel",
              label: "Cancelar pacote",
              icon: <Ban className="size-4" />,
              destructive: true,
              onSelect: () => void cancel(pkg),
            },
          ]
        : []),
    ];
  }

  return (
    <div className="space-y-3">
      {dialog}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar pacote..."
          aria-label="Buscar pacote"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="sm:w-44" aria-label="Filtrar por situação">
            <SelectValue>{STATUS_FILTERS.find((f) => f.value === status)?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canManage && onSell ? (
          <Button variant="outline" className="sm:ml-auto" onClick={() => onSell()}>
            <Plus className="size-4" />
            Vender pacote
          </Button>
        ) : null}
      </div>

      <ListSummaryBar
        count={rows.length}
        singularLabel="pacote"
        pluralLabel="pacotes"
        isLoading={isPending}
        hasFilters={hasFilters || query !== ""}
        onClearFilters={() => {
          setSearch("");
          setStatus("all");
        }}
      />

      <ListContainer
        emptyState={
          !isPending && rows.length === 0 ? (
            <ListEmptyState
              hasSearch={query !== ""}
              hasFilters={hasFilters}
              onClearSearch={() => setSearch("")}
              onClearFilters={() => setStatus("all")}
              searchEmptyMessage="Nenhum pacote para esta busca."
              filtersEmptyMessage="Nenhum pacote nesta situação."
              emptyGuide={
                <ModuleEmptyGuide
                  icon={<Ticket className="size-8" />}
                  title="Nenhum pacote ainda."
                  description="Os pacotes de aulas vendidos ao aluno aparecem aqui."
                />
              }
            />
          ) : undefined
        }
      >
        {isPending
          ? Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-1.5 px-4 py-3.5 sm:px-5">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
            ))
          : rows.map((pkg) => {
              const actions = actionsFor(pkg);
              const isOpen = Boolean(expanded[pkg.id]);
              const usages = [...pkg.usages].sort((a, b) => b.date.localeCompare(a.date));
              const row = (
                <div key={pkg.id}>
                  <ListRow
                    onClick={pkg.usages.length > 0 ? () => toggle(pkg.id) : undefined}
                    actions={
                      actions.length > 0 ? (
                        <ListItemActionsMenu
                          actions={actions}
                          title="Ações do pacote"
                          ariaLabel={`Ações do ${withKind("pacote", pkg.name)}`}
                          variant="ghost"
                        />
                      ) : null
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{pkg.name}</p>
                      {pkg.status === "active" ? <StudentPackageBadge pkg={pkg} /> : <EndedBadge status={pkg.status} />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{packageFacts(pkg)}</p>
                  </ListRow>
                  {isOpen ? (
                    <div className="border-t border-border/50 bg-muted/20 px-4 py-2.5 sm:px-6">
                      <ul className="divide-y divide-border/40 rounded-lg border border-border/50 bg-card text-xs">
                        {usages.map((u) => (
                          <li key={u.sessionId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-3.5 py-2">
                            <span className="text-foreground">
                              {format(parseISO(u.date), "dd/MM/yyyy")}
                              {classNameById.get(u.classGroupId) ? ` · ${classNameById.get(u.classGroupId)}` : ""}
                            </span>
                            <span className="text-muted-foreground">
                              {u.reason === "present" ? "Presença" : "Falta sem justificativa"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
              if (actions.length === 0) return row;
              return (
                <ListItemContextMenu key={pkg.id} actions={actions}>
                  {row}
                </ListItemContextMenu>
              );
            })}
      </ListContainer>
    </div>
  );
}
