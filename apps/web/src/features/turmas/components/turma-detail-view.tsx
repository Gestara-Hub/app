"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  ChevronLeft,
  Clock,
  ListPlus,
  Pencil,
  UserCheck,
  UserPlus,
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { ListItemCard } from "@/components/shared/list-item-card";
import { isApiError } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { useCan } from "@/features/auth";
import { useClients } from "@/features/clients";
import {
  useAddToWaitlist,
  useCancelEnrollment,
  useClassGroup,
  useConcludeReposicao,
  useEnroll,
  useEnrollments,
  usePromoteWaitlist,
  useRemoveFromWaitlist,
  useReposicoes,
  useWaitlist,
} from "../hooks/use-turmas";
import { slotsSummary } from "./turmas-view";
import { TurmaFormDialog } from "./turma-form-dialog";

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

export function TurmaDetailView({ id }: { id: string }) {
  const { data: turma, isLoading } = useClassGroup(id);
  const { data: enrollments } = useEnrollments(id);
  const { data: clients } = useClients({ status: "active" });
  const { data: waitlist } = useWaitlist(id);
  const { data: reposicoes } = useReposicoes(id);
  const enrollMut = useEnroll();
  const cancelMut = useCancelEnrollment();
  const addWaitMut = useAddToWaitlist();
  const promoteMut = usePromoteWaitlist();
  const removeWaitMut = useRemoveFromWaitlist();
  const concludeRepMut = useConcludeReposicao();
  const can = useCan();
  const canManage = can("enrollment:manage");
  const canEditTurma = can("classes:manage");
  const [editOpen, setEditOpen] = useState(false);
  const [confirmFull, setConfirmFull] = useState<{
    studentId: string;
    studentName: string;
  } | null>(null);

  if (isLoading || !turma) {
    return <Skeleton className="h-40 w-full rounded-md" />;
  }

  const enrolledIds = new Set((enrollments ?? []).map((e) => e.studentId));
  const available = (clients ?? []).filter((c) => !enrolledIds.has(c.id));

  const doEnroll = async (studentId: string, allowOverCapacity: boolean) => {
    try {
      await enrollMut.mutateAsync({
        payload: { classGroupId: id, studentId },
        allowOverCapacity,
      });
      toast.success("Aluno matriculado.");
      setConfirmFull(null);
    } catch (error) {
      // Capacidade e regra mole: turma lotada -> confirma e refaz.
      if (isApiError(error) && error.code === "CLASS_FULL" && !allowOverCapacity) {
        const c = (clients ?? []).find((x) => x.id === studentId);
        setConfirmFull({ studentId, studentName: c?.name ?? "o aluno" });
        return;
      }
      toast.error(getErrorMessage(error, "Não foi possível matricular."));
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
        <span className="rounded-full border px-2.5 py-1 text-sm font-medium text-muted-foreground">
          {turma.enrolledCount}/{turma.capacity} vagas
        </span>
      </PageHeader>

      <TurmaFormDialog open={editOpen} onOpenChange={setEditOpen} turma={turma} />


      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            Matriculados ({(enrollments ?? []).length})
          </h2>
          {(enrollments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum aluno matriculado.
            </p>
          ) : (
            (enrollments ?? []).map((e) => (
              <ListItemCard key={e.id} disableHover>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{e.studentName}</span>
                  <div className="flex items-center gap-2">
                    <FreqBadge
                      rate={e.attendanceRate}
                      present={e.presentCount}
                      absent={e.absentCount}
                    />
                    {canManage ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Cancelar matrícula"
                        onClick={() =>
                          cancelMut.mutate(
                            { id: e.id },
                            {
                              onSuccess: () =>
                                toast.success("Matrícula cancelada."),
                            },
                          )
                        }
                      >
                        <X className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </ListItemCard>
            ))
          )}
        </section>

        {canManage ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Matricular aluno</h2>
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todos os alunos ativos já estão matriculados.
              </p>
            ) : (
              available.map((c) => (
                <ListItemCard key={c.id} disableHover>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm">{c.name}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={enrollMut.isPending}
                      onClick={() => doEnroll(c.id, false)}
                    >
                      <UserPlus className="size-4" />
                      Matricular
                    </Button>
                  </div>
                </ListItemCard>
              ))
            )}
          </section>
        ) : null}
      </div>

      {(waitlist ?? []).length > 0 ? (
        <section className="mt-6 space-y-2">
          <h2 className="text-sm font-semibold">
            Lista de espera ({(waitlist ?? []).length})
          </h2>
          {(waitlist ?? []).map((w) => (
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
          ))}
        </section>
      ) : null}

      {(reposicoes ?? []).length > 0 ? (
        <section className="mt-6 space-y-2">
          <h2 className="text-sm font-semibold">
            Reposições pendentes ({(reposicoes ?? []).length})
          </h2>
          {(reposicoes ?? []).map((r) => (
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
          ))}
        </section>
      ) : null}

      <AlertDialog
        open={confirmFull !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmFull(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turma lotada — matricular mesmo assim?</AlertDialogTitle>
            <AlertDialogDescription>
              {turma.name} já atingiu a capacidade ({turma.capacity} vagas).
              Deseja matricular {confirmFull?.studentName} mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                if (confirmFull) {
                  addWaitMut.mutate(
                    { classGroupId: id, studentId: confirmFull.studentId },
                    {
                      onSuccess: () =>
                        toast.success("Adicionado à lista de espera."),
                    },
                  );
                  setConfirmFull(null);
                }
              }}
            >
              <ListPlus className="size-4" />
              Pôr na lista de espera
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (confirmFull) void doEnroll(confirmFull.studentId, true);
              }}
            >
              Matricular mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
