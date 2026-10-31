"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "@/lib/toast";
import { Ban, ChevronDown, Plus, RefreshCw } from "lucide-react";
import { ListContainer, ListRow } from "@/components/shared/list";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { withKind } from "@/lib/text";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { plural } from "@gestarahub/core/format";
import type { Id, StudentPackageStatus, StudentPackageView } from "@gestarahub/contracts";
import { useCancelStudentPackage, useStudentPackages } from "../hooks/use-packages";
import { useClassGroups } from "../hooks/use-turmas";
import { StudentPackageBadge } from "./student-package-badge";
import { canCancelPackage, canRenewPackage } from "../package-actions";

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
 * Pacotes do aluno (ficha do aluno, secao "Plano e pacotes", 30/10/2026): os
 * em uso com a barra do saldo, avisos e aulas usadas; renovados e cancelados
 * atras de "Mostrar encerrados". Renovar e cancelar no menu de cada um. Vender
 * e renovar abrem o dialogo da tela (`onSell`), que tambem atende o "Vender
 * pacote" do topo; com pacote em uso a venda renova, e cancelado ou renovado
 * nao impede vender outro.
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
  const [showEnded, setShowEnded] = useState(false);
  const [expanded, setExpanded] = useState<Record<Id, boolean>>({});
  const { data, isPending } = useStudentPackages({ studentId });
  const { data: classes } = useClassGroups();
  const cancelMut = useCancelStudentPackage();
  const { confirm, dialog } = useConfirmAction();

  const classNameById = useMemo(
    () => new Map((classes ?? []).map((g) => [g.id, g.name])),
    [classes],
  );
  const all = data ?? [];
  const current = all.filter((p) => p.status === "active");
  const ended = all.filter((p) => p.status !== "active");
  const rows = showEnded ? [...current, ...ended] : current;

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
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Pacotes</p>
        {canManage && onSell ? (
          <Button variant="outline" onClick={() => onSell()}>
            <Plus className="size-4" />
            Vender pacote
          </Button>
        ) : null}
      </div>

      {!isPending && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{all.length === 0 ? "Nenhum pacote." : "Nenhum pacote em uso."}</p>
      ) : (
        <ListContainer>
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
                      {pkg.status === "active" && pkg.lessonsTotal > 0 ? (
                        <div
                          role="progressbar"
                          aria-label={`Restam ${pkg.remaining} de ${pkg.lessonsTotal} aulas`}
                          aria-valuemin={0}
                          aria-valuemax={pkg.lessonsTotal}
                          aria-valuenow={pkg.remaining}
                          className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted"
                        >
                          <div
                            className={cn("h-full rounded-full", pkg.remaining > 0 && !pkg.isExpired ? "bg-primary" : "bg-muted-foreground/40")}
                            style={{ width: `${Math.min(100, Math.round((pkg.remaining / pkg.lessonsTotal) * 100))}%` }}
                          />
                        </div>
                      ) : null}
                      <p className="mt-1.5 text-xs text-muted-foreground">{packageFacts(pkg)}</p>
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
      )}

      {ended.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowEnded((v) => !v)}
          className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {showEnded ? "Ocultar encerrados" : `Mostrar encerrados (${ended.length})`}
        </button>
      ) : null}
    </div>
  );
}
