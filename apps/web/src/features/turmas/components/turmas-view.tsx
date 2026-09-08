"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarRange,
  Clock,
  GraduationCap,
  MoreVertical,
  Plus,
  Power,
  PowerOff,
  Search,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { recordStatusLabel } from "@/lib/labels";
import type { ClassGroupView, ClassMeetingSlot, RecordStatus } from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import {
  useClassGroups,
  useDeactivateClassGroup,
  useReactivateClassGroup,
} from "../hooks/use-turmas";
import { TurmaFormDialog } from "./turma-form-dialog";

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function slotsSummary(slots: ClassMeetingSlot[]): string {
  return slots
    .map((s) => `${WEEKDAY_SHORT[s.weekday]} ${s.start}`)
    .join(" · ");
}

function statusPillClass(isActive: boolean): string {
  return isActive
    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "border border-border/60 bg-muted/50 text-muted-foreground";
}

// Menu de ações da turma (desativar / reativar).
function TurmaActionsMenu({
  turma,
  openConfirm,
  setOpenConfirm,
}: {
  turma: ClassGroupView;
  openConfirm: boolean;
  setOpenConfirm: (open: boolean) => void;
}) {
  const deactivate = useDeactivateClassGroup();
  const reactivate = useReactivateClassGroup();
  const isActive = turma.status === "active";

  const handleDeactivate = async () => {
    try {
      await deactivate.mutateAsync(turma.id);
      toast.success(`Turma "${turma.name}" desativada.`);
      setOpenConfirm(false);
    } catch {
      toast.error("Não foi possível desativar a turma.");
    }
  };

  const handleReactivate = async () => {
    try {
      await reactivate.mutateAsync(turma.id);
      toast.success(`Turma "${turma.name}" reativada.`);
    } catch {
      toast.error("Não foi possível reativar a turma.");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon-sm" className="size-8">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isActive ? (
            <DropdownMenuItem
              onClick={() => setOpenConfirm(true)}
              className="text-destructive"
            >
              <PowerOff className="mr-2 h-4 w-4" />
              Desativar turma
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleReactivate}>
              <Power className="mr-2 h-4 w-4" />
              Reativar turma
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={openConfirm} onOpenChange={setOpenConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>Desativar turma?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja desativar <strong>&ldquo;{turma.name}&rdquo;</strong>?
            <br />
            <br />
            Isso não deletará os dados — apenas impedirá novas aulas. O histórico
            de frequência e matrículas será preservado.
          </AlertDialogDescription>
          <div className="flex justify-end gap-3">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={deactivate.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deactivate.isPending ? "Desativando..." : "Desativar"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TurmaRow({
  turma,
  canManage,
  deactivatingId,
  setDeactivatingId,
}: {
  turma: ClassGroupView;
  canManage: boolean;
  deactivatingId: string | null;
  setDeactivatingId: (id: string | null) => void;
}) {
  const reactivate = useReactivateClassGroup();
  const isActive = turma.status === "active";
  const full = turma.vagasRestantes <= 0;

  const handleReactivate = async () => {
    try {
      await reactivate.mutateAsync(turma.id);
      toast.success(`Turma "${turma.name}" reativada.`);
    } catch {
      toast.error("Não foi possível reativar a turma.");
    }
  };

  const content = (
    <div className="group flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5 transition-colors duration-150 hover:bg-muted/40 cursor-pointer">
      <Link href={`/classes/${turma.id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
            {turma.name}
          </p>
          {turma.modalityName ? (
            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {turma.modalityName}
            </span>
          ) : null}
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none shrink-0",
              full
                ? "border-amber-500/20 bg-amber-500/10 text-amber-500 dark:text-amber-400"
                : "border-border/60 bg-muted/50 text-muted-foreground",
            )}
          >
            {turma.enrolledCount}/{turma.capacity} vagas
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none shrink-0",
              statusPillClass(isActive),
            )}
          >
            {recordStatusLabel(turma.status)}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
          {turma.instructorName ? (
            <span className="inline-flex items-center gap-1.5">
              <User className="size-3 text-muted-foreground/60" />
              <span>{turma.instructorName}</span>
            </span>
          ) : null}
          {turma.meetingSlots.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3 text-muted-foreground/60" />
              <span>{slotsSummary(turma.meetingSlots)}</span>
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex items-center gap-1 shrink-0">
        {canManage ? (
          <TurmaActionsMenu
            turma={turma}
            openConfirm={deactivatingId === turma.id}
            setOpenConfirm={(open) => setDeactivatingId(open ? turma.id : null)}
          />
        ) : null}
      </div>
    </div>
  );

  if (!canManage) return content;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{content}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem asChild>
          <Link href={`/classes/${turma.id}`}>Editar</Link>
        </ContextMenuItem>
        {isActive ? (
          <ContextMenuItem
            onClick={() => setDeactivatingId(turma.id)}
            className="text-destructive"
          >
            Desativar
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={handleReactivate}>
            Reativar
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function SkeletonRows({ showAction }: { showAction: boolean }) {
  return Array.from({ length: 4 }).map((_, i) => (
    <div
      key={i}
      className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
    >
      <div className="space-y-1.5 min-w-0 flex-1">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-3 w-64" />
      </div>
      {showAction ? <Skeleton className="size-8 rounded-md shrink-0" /> : null}
    </div>
  ));
}

export function TurmasView() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RecordStatus>("all");
  const { data: turmas, isLoading } = useClassGroups({
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  });
  const can = useCan();
  const canManage = can("classes:manage");
  const [createOpen, setCreateOpen] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const hasSearch = Boolean(search.trim());
  const hasFilters = status !== "all";

  const clearAll = () => {
    setSearch("");
    setStatus("all");
  };

  return (
    <>
      <PageHeader
        title="Turmas"
        description="Turmas, matrículas e frequência dos alunos."
      >
        <Button asChild variant="outline">
          <Link href="/classes/calendar">
            <CalendarRange className="size-4" />
            Calendário
          </Link>
        </Button>
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Nova turma
          </Button>
        ) : null}
      </PageHeader>

      <TurmaFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      <div className="space-y-4">
        {/* Barra de Filtros */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar turma..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8"
              autoComplete="off"
              aria-label="Buscar turma"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <Select
            value={status}
            onValueChange={(val) => setStatus(val as "all" | RecordStatus)}
          >
            <SelectTrigger className="sm:w-36" aria-label="Filtrar por status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="inactive">Inativas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Contador / Resumo */}
        {!isLoading && (turmas ?? []).length > 0 ? (
          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>
              {(turmas ?? []).length === 1
                ? "1 turma cadastrada"
                : `${(turmas ?? []).length} turmas cadastradas`}
            </span>
            {hasSearch || hasFilters ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-primary hover:underline"
              >
                Limpar filtros
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Container Unificado da Lista */}
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur-xs shadow-xs">
          {isLoading ? (
            <SkeletonRows showAction={canManage} />
          ) : (turmas ?? []).length === 0 ? (
            hasSearch || hasFilters ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Search className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhum resultado para os filtros aplicados.
                </p>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Limpar filtros
                </Button>
              </div>
            ) : (
              <div className="py-6">
                <ModuleEmptyGuide
                  icon={<GraduationCap className="size-8" />}
                  title="Nenhuma turma cadastrada ainda."
                  description="Cadastre turmas para organizar horários, matrículas e frequência dos alunos."
                  actionLabel={canManage ? "Nova turma" : undefined}
                  onAction={canManage ? () => setCreateOpen(true) : undefined}
                />
              </div>
            )
          ) : (
            <div className="divide-y divide-border/40">
              {(turmas ?? []).map((t) => (
                <TurmaRow
                  key={t.id}
                  turma={t}
                  canManage={canManage}
                  deactivatingId={deactivatingId}
                  setDeactivatingId={setDeactivatingId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
