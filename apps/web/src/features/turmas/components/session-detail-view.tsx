"use client";

import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, UserPlus, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { ListItemCard } from "@/components/shared/list-item-card";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import { useClients } from "@/features/clients";
import {
  useCancelReserva,
  useClassSession,
  useMarkAttendance,
  useReserveSession,
} from "../hooks/use-turmas";

const STATUSES: { value: AttendanceStatus; label: string; active: string }[] = [
  {
    value: "present",
    label: "Presente",
    active:
      "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  {
    value: "absent",
    label: "Faltou",
    active:
      "border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
  },
  {
    value: "justified",
    label: "Justificada",
    active:
      "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  },
];

export function SessionDetailView({ sessionId }: { sessionId: string }) {
  const { data: session, isLoading } = useClassSession(sessionId);
  const { data: clients } = useClients({ status: "active" });
  const markMut = useMarkAttendance();
  const reserveMut = useReserveSession();
  const cancelReservaMut = useCancelReserva();
  const can = useCan();
  const canMark = can("attendance:mark");
  const canEnroll = can("enrollment:manage");

  if (isLoading || !session) {
    return <Skeleton className="h-40 w-full rounded-md" />;
  }

  const isDropin = session.enrollmentType === "dropin";
  const rosterIds = new Set(session.roster.map((r) => r.studentId));
  const available = isDropin
    ? (clients ?? []).filter((c) => !rosterIds.has(c.id))
    : [];

  const meta = [
    session.modalityName,
    `${format(parseISO(session.date), "dd/MM/yyyy")} · ${session.start}–${session.end}`,
    `Instrutor: ${session.instructorName}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/classes/calendar">
          <ChevronLeft className="size-4" />
          Calendário
        </Link>
      </Button>

      <PageHeader title={session.className} description={meta} />

      <h2 className="mb-2 text-sm font-semibold">
        {isDropin ? "Reservas e presença" : "Presença"} (
        {session.roster.length} {isDropin ? "reservados" : "alunos"})
      </h2>
      {session.roster.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isDropin
            ? "Nenhuma reserva nesta aula."
            : "Nenhum aluno matriculado na turma."}
        </p>
      ) : (
        <div className="space-y-2">
          {session.roster.map((r) => (
            <ListItemCard key={r.studentId} disableHover>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{r.studentName}</span>
                <div className="flex items-center gap-1.5">
                  {STATUSES.map((s) => {
                    const on = r.attendance === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        disabled={!canMark || markMut.isPending}
                        onClick={() =>
                          markMut.mutate({
                            sessionId,
                            studentId: r.studentId,
                            status: s.value,
                          })
                        }
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                          on
                            ? s.active
                            : "border-input bg-background text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                  {isDropin && canEnroll ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Cancelar reserva"
                      onClick={() =>
                        cancelReservaMut.mutate({
                          sessionId,
                          studentId: r.studentId,
                        })
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </ListItemCard>
          ))}
        </div>
      )}

      {isDropin && canEnroll ? (
        <section className="mt-6 space-y-2">
          <h2 className="text-sm font-semibold">Reservar aluno</h2>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todos os alunos ativos já reservaram esta aula.
            </p>
          ) : (
            available.map((c) => (
              <ListItemCard key={c.id} disableHover>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">{c.name}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reserveMut.isPending}
                    onClick={() =>
                      reserveMut.mutate(
                        {
                          classGroupId: session.classGroupId,
                          sessionId,
                          studentId: c.id,
                        },
                        { onSuccess: () => toast.success("Reserva feita.") },
                      )
                    }
                  >
                    <UserPlus className="size-4" />
                    Reservar
                  </Button>
                </div>
              </ListItemCard>
            ))
          )}
        </section>
      ) : null}
    </>
  );
}
