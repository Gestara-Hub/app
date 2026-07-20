"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, Pencil, UserPlus, X } from "lucide-react";
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
  useCancelEnrollment,
  useClassGroup,
  useEnroll,
  useEnrollments,
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
  const enrollMut = useEnroll();
  const cancelMut = useCancelEnrollment();
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
