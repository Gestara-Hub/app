"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCheck, ChevronLeft, ChevronRight, RotateCcw, User, UserCheck, UserPlus, Users, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InitialsAvatar, ListContainer, ListRow } from "@/components/shared/list";
import { Combobox } from "@/components/shared/combobox";
import { cn } from "@/lib/utils";
import { formatCents } from "@gestarahub/core/format";
import type {
  AttendanceStatus,
  ClassSessionDetail,
  ReservationKind,
} from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import { useClients } from "@/features/clients";
import {
  useCancelReservation,
  useClassSession,
  useMarkAttendance,
  useReserveSession,
  useRestorePrimaryInstructor,
} from "../hooks/use-turmas";
import { SubstituteInstructorDialog } from "./substitute-instructor-dialog";
import { calendarHrefFor } from "../calendar-filters";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";

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
  const cancelReservationMut = useCancelReservation();
  const restoreMut = useRestorePrimaryInstructor();
  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();
  const can = useCan();
  const canMark = can("attendance:mark");
  const canEnroll = can("enrollment:manage");
  const canManage = can("classes:manage");

  const [addOpen, setAddOpen] = useState(false);
  const [substituteOpen, setSubstituteOpen] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);

  if (isLoading || !session) {
    return <Skeleton className="h-40 w-full rounded-md" />;
  }

  const rosterIds = new Set(session.roster.map((r) => r.studentId));
  // Presenca so faz sentido para aula que ja aconteceu (ou acontece hoje).
  const isFutureSession = session.date > format(new Date(), "yyyy-MM-dd");
  const availableClients = (clients ?? []).filter((c) => !rosterIds.has(c.id));

  const today = format(new Date(), "yyyy-MM-dd");
  const isToday = session.date === today;
  const sessionDate = parseISO(session.date);
  const dateLabel = format(sessionDate, "EEEE, d 'de' MMMM", { locale: ptBR });
  const shortDate = format(sessionDate, "dd/MM");

  // Resumo da chamada (so para aula de hoje ou passada).
  const counts = {
    present: session.roster.filter((r) => r.attendance === "present").length,
    absent: session.roster.filter((r) => r.attendance === "absent").length,
    justified: session.roster.filter((r) => r.attendance === "justified").length,
    pending: session.roster.filter((r) => !r.attendance).length,
  };

  const markAllPresent = async () => {
    setBulkPending(true);
    try {
      for (const r of session.roster.filter((entry) => !entry.attendance)) {
        await markMut.mutateAsync({ sessionId, studentId: r.studentId, status: "present" });
      }
      toast.success("Presença marcada para todos os alunos pendentes.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível marcar a presença.");
    } finally {
      setBulkPending(false);
    }
  };

  const spotsLabel =
    session.availableSpots === 1
      ? "1 vaga disponível"
      : `${session.availableSpots} vagas disponíveis`;
  const canAddStudent = canEnroll && (session.allowDropin || session.availableSpots > 0);
  const addDisabledReason =
    availableClients.length === 0 ? "Todos os alunos ativos já estão nesta aula." : null;

  const handleAddStudent = (input: {
    studentId: string;
    kind: ReservationKind;
    amountCents: number;
  }) => {
    reserveMut.mutate(
      {
        classGroupId: session.classGroupId,
        sessionId,
        studentId: input.studentId,
        kind: input.kind,
        amountCents: input.amountCents,
      },
      {
        onSuccess: () => {
          toast.success(
            input.kind === "trial"
              ? "Aluno inscrito como experimental."
              : "Aluno avulso adicionado com cobrança gerada.",
          );
          setAddOpen(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erro ao adicionar aluno.");
        },
      },
    );
  };

  return (
    <>
      {confirmDialog}
      <nav aria-label="Navegação" className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
        <Link
          href={calendarHrefFor(session.date)}
          className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Calendário
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <Link
          href={`/classes/${session.classGroupId}`}
          className="truncate rounded-md px-1 py-0.5 hover:text-foreground"
        >
          {session.className}
        </Link>
      </nav>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">{session.className}</h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span
              className={cn(
                "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium",
                isToday
                  ? "bg-primary text-primary-foreground"
                  : isFutureSession
                    ? "bg-muted text-muted-foreground"
                    : "border text-muted-foreground",
              )}
            >
              {isToday ? "Hoje" : isFutureSession ? "Próxima aula" : "Realizada"}
            </span>
            <span className="font-medium text-foreground first-letter:uppercase">{dateLabel}</span>
            <span className="text-muted-foreground">·</span>
            <span className="tabular-nums text-foreground">
              {session.start}–{session.end}
            </span>
            {session.modalityName && session.modalityName !== session.className ? (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{session.modalityName}</span>
              </>
            ) : null}
          </div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <User className="size-3.5" />
            {session.isSubstitute ? "Substituto" : "Instrutor"}:{" "}
            <span className="text-foreground">{session.instructorName}</span>
          </p>
        </div>
        {canManage ? (
          <Button variant="outline" size="sm" onClick={() => setSubstituteOpen(true)}>
            <UserCheck className="size-4" />
            {session.isSubstitute ? "Alterar substituto" : "Trocar instrutor"}
          </Button>
        ) : null}
      </div>

      {/* Banner de Instrutor Substituto */}
      {session.isSubstitute && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-700 dark:text-amber-300">
              !
            </span>
            <div>
              <p className="font-semibold text-foreground">
                Instrutor substituto nesta aula: {session.instructorName}
              </p>
              <p className="text-muted-foreground">
                Titular da turma: {session.primaryInstructorName}
                {session.substitutionReason
                  ? ` · Motivo: "${session.substitutionReason}"`
                  : ""}
              </p>
            </div>
          </div>
          {canManage && (
            <Button
              variant="outline"
              size="xs"
              onClick={async () => {
                try {
                  await restoreMut.mutateAsync(session.id);
                  toast.success("Instrutor titular restaurado com sucesso.");
                } catch {
                  toast.error("Erro ao restaurar titular.");
                }
              }}
              disabled={restoreMut.isPending}
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Restaurar titular
            </Button>
          )}
        </div>
      )}

      {/* Cabeçalho da Lista de Chamada e Ação de Adicionar */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Lista de chamada</h2>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {session.roster.length}/{session.capacity} vagas ocupadas
            </span>
            <span>·</span>
            <span
              className={cn(
                "font-medium",
                session.availableSpots > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400",
              )}
            >
              {session.availableSpots > 0 ? spotsLabel : "Turma lotada"}
            </span>
          </div>
        </div>

        {canAddStudent ? (
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddOpen(true)}
              disabled={addDisabledReason !== null}
            >
              <UserPlus className="size-4" />
              Adicionar aluno nesta aula
            </Button>
            {addDisabledReason ? (
              <p className="text-xs text-muted-foreground">{addDisabledReason}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Resumo da chamada + marcar todos */}
      {session.roster.length > 0 && !isFutureSession ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">{counts.present}</span>{" "}
              <span className="text-muted-foreground">{counts.present === 1 ? "presente" : "presentes"}</span>
            </span>
            <span>
              <span className="font-semibold text-red-700 dark:text-red-400">{counts.absent}</span>{" "}
              <span className="text-muted-foreground">{counts.absent === 1 ? "falta" : "faltas"}</span>
            </span>
            <span>
              <span className="font-semibold text-amber-700 dark:text-amber-400">{counts.justified}</span>{" "}
              <span className="text-muted-foreground">
                {counts.justified === 1 ? "justificada" : "justificadas"}
              </span>
            </span>
            <span>
              <span className="font-semibold text-foreground">{counts.pending}</span>{" "}
              <span className="text-muted-foreground">a marcar</span>
            </span>
          </div>
          {canMark && counts.pending > 0 ? (
            <Button
              size="sm"
              onClick={markAllPresent}
              disabled={bulkPending || markMut.isPending}
            >
              <CheckCheck className="size-4" />
              {bulkPending ? "Marcando..." : "Marcar todos como presentes"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Roster de Alunos */}
      {session.roster.length === 0 ? (
        <ListContainer
          emptyState={
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Users className="size-8 stroke-[1.5]" />
              <p className="text-sm font-medium">Nenhum aluno nesta aula.</p>
              <p className="text-xs">
                Adicione alunos avulsos ou matricule alunos na turma.
              </p>
            </div>
          }
        >
          {null}
        </ListContainer>
      ) : (
        <ListContainer>
          {session.roster.map((r) => {
            const isEnrolled = r.kind === "enrolled" || !r.kind;
            const isTrial = r.kind === "trial";

            return (
              <ListRow key={r.studentId}>
                <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <InitialsAvatar name={r.studentName} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate text-foreground">
                          {r.studentName}
                        </span>
                        {isEnrolled ? (
                          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Matriculado
                          </span>
                        ) : isTrial ? (
                          <span className="inline-flex items-center rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 text-[10px] font-medium">
                            Experimental
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-medium">
                            Avulso
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isFutureSession ? (
                      <span className="text-xs text-muted-foreground">
                        Chamada abre em {shortDate}
                      </span>
                    ) : null}
                    {isFutureSession ? null : STATUSES.map((s) => {
                      const on = r.attendance === s.value;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          disabled={!canMark || markMut.isPending || bulkPending}
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

                    {!isEnrolled && canEnroll ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Remover da aula"
                        disabled={cancelReservationMut.isPending}
                        onClick={async () => {
                          const ok = await confirmAction({
                            title: "Remover da aula?",
                            description: `${r.studentName} sai desta aula. Se houver cobrança avulsa em aberto, ela é cancelada.`,
                            confirmLabel: "Remover",
                            variant: "destructive",
                          });
                          if (!ok) return;
                          cancelReservationMut.mutate(
                            { sessionId, studentId: r.studentId },
                            {
                              onSuccess: () =>
                                toast.success("Aluno removido da aula."),
                            },
                          );
                        }}
                      >
                        <X className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </ListRow>
            );
          })}
        </ListContainer>
      )}

      {/* Diálogo para Adicionar Aluno Avulso / Experimental */}
      <AddStudentSessionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        session={session}
        availableClients={availableClients}
        onAdd={handleAddStudent}
        isPending={reserveMut.isPending}
      />

      {/* Diálogo para Trocar Instrutor (Substituto) */}
      <SubstituteInstructorDialog
        open={substituteOpen}
        onOpenChange={setSubstituteOpen}
        session={session}
      />
    </>
  );
}

function AddStudentSessionDialog({
  open,
  onOpenChange,
  session,
  availableClients,
  onAdd,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ClassSessionDetail;
  availableClients: { id: string; name: string }[];
  onAdd: (input: {
    studentId: string;
    kind: ReservationKind;
    amountCents: number;
  }) => void;
  isPending: boolean;
}) {
  const [studentId, setStudentId] = useState("");
  const [kind, setKind] = useState<ReservationKind>("dropin");
  const defaultPrice = session.sessionPriceCents ?? 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      toast.error("Selecione um aluno.");
      return;
    }
    onAdd({
      studentId,
      kind,
      amountCents: kind === "trial" ? 0 : defaultPrice,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
        expandable
        storageKey="session-add-student"
      >
        <DialogHeader className="pr-14">
          <DialogTitle>Adicionar aluno nesta aula</DialogTitle>
          <DialogDescription>
            Inscreva um aluno como aula avulsa ou experimental para o dia{" "}
            {format(parseISO(session.date), "dd/MM/yyyy")}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Aluno *</label>
            <Combobox
              value={studentId}
              onChange={setStudentId}
              options={availableClients.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Selecione o aluno"
              searchPlaceholder="Buscar aluno..."
              emptyMessage="Nenhum aluno encontrado."
              ariaLabel="Aluno"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tipo de inscrição *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setKind("dropin")}
                className={cn(
                  "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                  kind === "dropin"
                    ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                    : "border-border/60 hover:bg-muted/50 text-muted-foreground",
                )}
              >
                <span className="text-sm font-medium">Aula Avulsa</span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  Gera cobrança avulsa
                </span>
              </button>

              <button
                type="button"
                onClick={() => setKind("trial")}
                className={cn(
                  "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                  kind === "trial"
                    ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                    : "border-border/60 hover:bg-muted/50 text-muted-foreground",
                )}
              >
                <span className="text-sm font-medium">Experimental</span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  Cortesia (R$ 0,00)
                </span>
              </button>
            </div>
          </div>

          {kind === "dropin" ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Valor da cobrança</label>
              <Input
                type="text"
                value={formatCents(defaultPrice)}
                readOnly
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
              <p className="text-[11px] text-muted-foreground">
                Valor configurado para aulas avulsas desta turma.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending || !studentId}>
              {isPending ? "Adicionando..." : "Confirmar inscrição"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
