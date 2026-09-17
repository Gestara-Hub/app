"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  ChevronLeft,
  Clock,
  GraduationCap,
  Pencil,
  Search,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { ListItemCard } from "@/components/shared/list-item-card";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import {
  ListItemActionsMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { cn } from "@/lib/utils";
import { normalizeText } from "@/lib/text";
import { userInitials } from "@/lib/session";
import { formatPhone } from "@gestarahub/core/format";
import type { EnrollmentView, Id } from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import { useClients } from "@/features/clients";
import {
  useCancelEnrollment,
  useClassGroup,
  useConcludeMakeup,
  useEnrollments,
  useMakeups,
  usePromoteWaitlist,
  useRemoveFromWaitlist,
  useWaitlist,
} from "../hooks/use-turmas";
import { slotsSummary } from "./turmas-view";
import { EnrollStudentsDialog } from "./enroll-students-dialog";
import { TurmaFormDialog } from "./turma-form-dialog";

type Tab = "enrolled" | "waitlist" | "makeups";

/** Badge de frequencia do aluno (informativo; destaque quando < 75%). */
function FreqBadge({
  rate,
  present,
  absent,
}: {
  rate: number | null;
  present: number;
  absent: number;
}) {
  if (rate === null) {
    return <span className="text-xs text-muted-foreground">sem presença</span>;
  }
  const pct = Math.round(rate * 100);
  const low = rate < 0.75;
  return (
    <span
      title={`${present} presença(s) · ${absent} falta(s)`}
      className={
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums " +
        (low
          ? "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
          : "border-border bg-muted/40 text-muted-foreground")
      }
    >
      {pct}%
    </span>
  );
}

/** Ocupacao da turma: barra + contagem. Ambar quando lotada/acima. */
function CapacityBar({
  enrolled,
  capacity,
}: {
  enrolled: number;
  capacity: number;
}) {
  const pct =
    capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;
  const full = enrolled >= capacity;
  const free = Math.max(capacity - enrolled, 0);
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            full ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="shrink-0 text-sm text-muted-foreground">
        {enrolled} de {capacity} vagas ·{" "}
        <span className="font-medium text-foreground">
          {full ? "turma lotada" : `${free} ${free === 1 ? "livre" : "livres"}`}
        </span>
      </p>
    </div>
  );
}

function TabButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span className="text-xs tabular-nums opacity-70">{count}</span>
    </button>
  );
}

export function TurmaDetailView({ id }: { id: string }) {
  const { data: turma, isLoading } = useClassGroup(id);
  const { data: enrollments } = useEnrollments(id);
  const { data: clients } = useClients({ status: "active" });
  const { data: waitlist } = useWaitlist(id);
  const { data: makeups } = useMakeups(id);
  const cancelMut = useCancelEnrollment();
  const promoteMut = usePromoteWaitlist();
  const removeWaitMut = useRemoveFromWaitlist();
  const concludeRepMut = useConcludeMakeup();
  const can = useCan();
  const canManage = can("enrollment:manage");
  const canEditTurma = can("classes:manage");

  const searchParams = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(
    () => searchParams?.get("enroll") === "true",
  );
  const [tab, setTab] = useState<Tab>("enrolled");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<Id>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const handleEnrollOpenChange = (open: boolean) => {
    setEnrollOpen(open);
    if (!open && typeof window !== "undefined" && window.location.search.includes("enroll=")) {
      window.history.replaceState(null, "", `/classes/${id}`);
    }
  };

  const rows = useMemo(() => {
    const term = normalizeText(search);
    const list = enrollments ?? [];
    if (!term) return list;
    return list.filter((e) => normalizeText(e.studentName).includes(term));
  }, [enrollments, search]);

  const phoneOf = useMemo(() => {
    const map = new Map((clients ?? []).map((c) => [c.id, c.phone]));
    return (studentId: Id) => map.get(studentId);
  }, [clients]);

  if (isLoading || !turma) {
    return <Skeleton className="h-40 w-full rounded-md" />;
  }

  const enrolledIds = new Set((enrollments ?? []).map((e) => e.studentId));
  const waitlistedIds = new Set((waitlist ?? []).map((w) => w.studentId));
  const selectedRows = rows.filter((e) => selected.has(e.id));
  const allShownSelected =
    rows.length > 0 && rows.every((e) => selected.has(e.id));

  const toggleRow = (rowId: Id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allShownSelected ? new Set() : new Set(rows.map((e) => e.id)));
  };

  const cancelOne = (enrollment: EnrollmentView) => {
    cancelMut.mutate(
      { id: enrollment.id },
      {
        onSuccess: () => {
          toast.success("Matrícula cancelada.");
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(enrollment.id);
            return next;
          });
        },
      },
    );
  };

  const cancelSelected = async () => {
    let ok = 0;
    for (const row of selectedRows) {
      try {
        await cancelMut.mutateAsync({ id: row.id });
        ok += 1;
      } catch {
        // erro individual nao interrompe o lote; o resumo conta o que passou.
      }
    }
    setConfirmBulk(false);
    setSelected(new Set());
    if (ok > 0) {
      toast.success(
        ok === 1 ? "Matrícula cancelada." : `${ok} matrículas canceladas.`,
      );
    }
  };

  const meta = [
    turma.modalityName,
    `Instrutor: ${turma.instructorName}`,
    turma.planName ? `Plano: ${turma.planName}` : null,
    slotsSummary(turma.meetingSlots),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/classes">
          <ChevronLeft className="size-4" />
          Turmas
        </Link>
      </Button>

      <PageHeader title={turma.name} description={meta}>
        {canEditTurma ? (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Editar
          </Button>
        ) : null}
        {canManage ? (
          <Button size="sm" onClick={() => setEnrollOpen(true)}>
            <UserPlus className="size-4" />
            Matricular alunos
          </Button>
        ) : null}
      </PageHeader>

      <CapacityBar enrolled={turma.enrolledCount} capacity={turma.capacity} />

      <TurmaFormDialog open={editOpen} onOpenChange={setEditOpen} turma={turma} />
      <EnrollStudentsDialog
        open={enrollOpen}
        onOpenChange={handleEnrollOpenChange}
        turma={turma}
        enrolledIds={enrolledIds}
        waitlistedIds={waitlistedIds}
      />

      <div
        role="tablist"
        aria-label="Seções da turma"
        className="mb-4 inline-flex gap-1 rounded-lg border bg-muted/40 p-1"
      >
        <TabButton
          active={tab === "enrolled"}
          count={(enrollments ?? []).length}
          label="Matriculados"
          onClick={() => setTab("enrolled")}
        />
        <TabButton
          active={tab === "waitlist"}
          count={(waitlist ?? []).length}
          label="Lista de espera"
          onClick={() => setTab("waitlist")}
        />
        <TabButton
          active={tab === "makeups"}
          count={(makeups ?? []).length}
          label="Reposições"
          onClick={() => setTab("makeups")}
        />
      </div>

      {tab === "enrolled" ? (
        <section role="tabpanel" className="space-y-3">
          {(enrollments ?? []).length === 0 ? (
            <div className="rounded-lg border">
              <ModuleEmptyGuide
                icon={<GraduationCap className="size-8" />}
                title="Nenhum aluno matriculado ainda."
                description="Matricule os alunos desta turma para acompanhar frequência e mensalidades."
                actionLabel={canManage ? "Matricular alunos" : undefined}
                onAction={canManage ? () => setEnrollOpen(true) : undefined}
              />
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar aluno matriculado..."
                  className="px-8"
                  autoComplete="off"
                  aria-label="Buscar aluno matriculado"
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

              {canManage && selected.size > 0 ? (
                <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground">
                    {selected.size} selecionado(s)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmBulk(true)}
                  >
                    <UserX className="size-4" />
                    Cancelar matrícula
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(new Set())}
                  >
                    Limpar seleção
                  </Button>
                </div>
              ) : null}

              {canManage && rows.length > 0 ? (
                <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                  <Checkbox
                    checked={allShownSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todos"
                  />
                  Selecionar todos ({rows.length})
                </label>
              ) : null}

              {rows.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  Nenhum aluno encontrado para &quot;{search}&quot;.
                </p>
              ) : (
                <div className="space-y-2">
                  {rows.map((e) => {
                    const phone = phoneOf(e.studentId);
                    const actions: ListItemAction[] = canManage
                      ? [
                          {
                            key: "cancel",
                            label: "Cancelar matrícula",
                            icon: <UserX className="size-4" />,
                            onSelect: () => cancelOne(e),
                            destructive: true,
                          },
                        ]
                      : [];
                    return (
                      <ListItemCard key={e.id} disableHover>
                        <div className="flex items-center gap-3">
                          {canManage ? (
                            <Checkbox
                              checked={selected.has(e.id)}
                              onCheckedChange={() => toggleRow(e.id)}
                              aria-label={`Selecionar ${e.studentName}`}
                            />
                          ) : null}
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-secondary text-xs">
                              {userInitials(e.studentName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {e.studentName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {[
                                phone ? formatPhone(phone) : null,
                                `desde ${format(parseISO(e.enrolledAt), "dd/MM/yy")}`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <FreqBadge
                            rate={e.attendanceRate}
                            present={e.presentCount}
                            absent={e.absentCount}
                          />
                          {canManage ? (
                            <ListItemActionsMenu
                              actions={actions}
                              title="Ações da matrícula"
                            />
                          ) : null}
                        </div>
                      </ListItemCard>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      ) : null}

      {tab === "waitlist" ? (
        <section role="tabpanel" className="space-y-2">
          {(waitlist ?? []).length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Ninguém na lista de espera.
            </p>
          ) : (
            (waitlist ?? []).map((w) => (
              <ListItemCard key={w.id} disableHover>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {w.position}. {w.studentName}
                  </span>
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          promoteMut.mutate(w.id, {
                            onSuccess: () =>
                              toast.success("Aluno promovido para matrícula."),
                          })
                        }
                      >
                        <UserCheck className="size-4" />
                        Promover
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Remover da lista"
                        onClick={() => removeWaitMut.mutate(w.id)}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </ListItemCard>
            ))
          )}
        </section>
      ) : null}

      {tab === "makeups" ? (
        <section role="tabpanel" className="space-y-2">
          {(makeups ?? []).length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhuma reposição pendente.
            </p>
          ) : (
            (makeups ?? []).map((r) => (
              <ListItemCard key={r.id} disableHover>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{r.studentName}</p>
                    <p className="text-xs text-muted-foreground">
                      Faltou em {format(parseISO(r.missedDate), "dd/MM")} · repor
                      até {format(parseISO(r.deadline), "dd/MM")}
                    </p>
                  </div>
                  {canManage ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        concludeRepMut.mutate(r.id, {
                          onSuccess: () => toast.success("Reposição concluída."),
                        })
                      }
                    >
                      <Clock className="size-4" />
                      Marcar reposta
                    </Button>
                  ) : null}
                </div>
              </ListItemCard>
            ))
          )}
        </section>
      ) : null}

      <AlertDialog open={confirmBulk} onOpenChange={setConfirmBulk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancelar {selected.size} matrícula(s)?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os alunos saem da turma e deixam de contar nas vagas. O histórico
              de presença é mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={cancelSelected}>
              Cancelar matrículas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
