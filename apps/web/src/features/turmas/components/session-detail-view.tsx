"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  MessageSquarePlus,
  NotebookPen,
  RotateCcw,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { BeltBadge } from "@/components/shared/belt-badge";
import {
  ListItemActionsMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { BirthdayBadge } from "@/components/shared/birthday-badge";
import { LevelChangeBadge } from "@/components/shared/level-change-badge";
import { Combobox } from "@/components/shared/combobox";
import { resolveModalityTrack, resolveTrackStyle } from "@/lib/progression-tracks";
import { cn } from "@/lib/utils";
import { useSegmentVocabulary } from "@/features/settings";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatCents } from "@gestarahub/core/format";
import {
  isApiError,
  type AttendanceStatus,
  type ClassSessionDetail,
  type Client,
  type ReservationKind,
} from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import { useCategories } from "@/features/categories";
import {
  ClassRecordsDialog,
  StudentGraduationDialog,
  StudentRecordsDialog,
  nextClassReminder,
  useClients,
} from "@/features/clients";
import {
  useCancelReservation,
  useClassGroup,
  useClassSession,
  useMarkAttendance,
  useReserveSession,
  useRestorePrimaryInstructor,
} from "../hooks/use-turmas";
import { SubstituteInstructorDialog } from "./substitute-instructor-dialog";
import { calendarHrefFor } from "../calendar-filters";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";

/**
 * Botoes de presenca so com icone e cor (mesmas cores do resumo: verde
 * presentes, vermelho faltas, ambar justificadas). O nome fica no title e no
 * aria-label. Marcado = preenchido; desmarcado = contorno com o icone colorido.
 */
const STATUSES: {
  value: AttendanceStatus;
  label: string;
  icon: typeof Check;
  idle: string;
  active: string;
}[] = [
  {
    value: "present",
    label: "Presente",
    icon: Check,
    idle: "text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 dark:text-emerald-400 dark:hover:bg-emerald-950/40",
    active: "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500",
  },
  {
    value: "absent",
    label: "Faltou",
    icon: X,
    idle: "text-red-600 hover:bg-red-50 hover:border-red-300 dark:text-red-400 dark:hover:bg-red-950/40",
    active: "border-red-600 bg-red-600 text-white dark:border-red-500 dark:bg-red-500",
  },
  {
    value: "justified",
    label: "Justificada",
    icon: FileText,
    idle: "text-amber-600 hover:bg-amber-50 hover:border-amber-300 dark:text-amber-400 dark:hover:bg-amber-950/40",
    active: "border-amber-500 bg-amber-500 text-white dark:border-amber-500 dark:bg-amber-500",
  },
];

export function SessionDetailView({ sessionId }: { sessionId: string }) {
  const vocabulary = useSegmentVocabulary();
  const { data: session, isLoading, isError, error, refetch } = useClassSession(sessionId);
  const { data: turma } = useClassGroup(session?.classGroupId ?? "");
  const { data: categories } = useCategories();
  const { data: clients } = useClients({ status: "active" });
  const markMut = useMarkAttendance();
  const reserveMut = useReserveSession();
  const cancelReservationMut = useCancelReservation();
  const restoreMut = useRestorePrimaryInstructor();
  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();

  // Avulso/experimental sai da aula (cobranca avulsa em aberto e cancelada).
  async function removeFromSession(studentId: string, studentName: string) {
    const ok = await confirmAction({
      title: "Remover da aula?",
      description: `${studentName} sai desta aula. Se houver cobrança avulsa em aberto, ela é cancelada.`,
      confirmLabel: "Remover",
      variant: "destructive",
    });
    if (!ok) return;
    cancelReservationMut.mutate(
      { sessionId, studentId },
      {
        onSuccess: () => toast.success("Aluno removido da aula."),
        onError: (err) =>
          toast.error(getErrorMessage(err, "Não foi possível remover o aluno da aula.")),
      },
    );
  }

  const can = useCan();
  const canMark = can("attendance:mark");
  const canEnroll = can("enrollment:manage");
  const canManage = can("classes:manage");

  const [addOpen, setAddOpen] = useState(false);
  const [substituteOpen, setSubstituteOpen] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  // Dois modais por aluno (Graduação e Registros de aula) e o registro da turma inteira.
  const [graduationClient, setGraduationClient] = useState<Client | null>(null);
  const [recordsClient, setRecordsClient] = useState<Client | null>(null);
  const [classRecordsOpen, setClassRecordsOpen] = useState(false);

  const clientById = useMemo(
    () => new Map((clients ?? []).map((c) => [c.id, c])),
    [clients],
  );
  const modalityTrack = useMemo(() => {
    const cat = turma
      ? (categories ?? []).find((c) => c.id === turma.modalityId)
      : (categories ?? []).find((c) => c.name === session?.modalityName);
    if (!cat && !session?.modalityName) return null;
    const track = resolveModalityTrack(
      cat ?? { name: session?.modalityName ?? "" },
    );
    return track.enabled && track.levels.length > 0
      ? { track, modalityId: cat?.id ?? turma?.modalityId ?? "" }
      : null;
  }, [turma, categories, session?.modalityName]);

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-md" />;
  }

  if (!session) {
    const notFound = !isError || (isApiError(error) && error.code === "NOT_FOUND");
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border px-4 py-10 text-center">
        <AlertCircle className="size-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {notFound ? "Aula não encontrada" : "Não foi possível carregar a aula"}
          </p>
          <p className="text-sm text-muted-foreground">
            {notFound
              ? "A aula pode não existir mais ou o link está incorreto."
              : getErrorMessage(error, "Tente novamente em instantes.")}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {notFound ? null : (
            <Button size="sm" onClick={() => void refetch()}>
              <RotateCcw className="size-4" />
              Tentar novamente
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/classes/calendar">
              <ChevronLeft className="size-4" />
              Calendário
            </Link>
          </Button>
        </div>
      </div>
    );
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

  // Registro de aula: so com trilha na modalidade (os registros ficam nela).
  const recordSession = modalityTrack?.modalityId
    ? {
        sessionId: session.id,
        date: session.date,
        classGroupId: session.classGroupId,
        classGroupName: session.className,
        modalityId: modalityTrack.modalityId,
      }
    : null;
  const presentStudents = session.roster
    .filter((r) => r.attendance === "present")
    .map((r) => clientById.get(r.studentId))
    .filter((c): c is Client => Boolean(c));

  const markAllPresent = async () => {
    setBulkPending(true);
    try {
      for (const r of session.roster.filter((entry) => !entry.attendance)) {
        await markMut.mutateAsync({ sessionId, studentId: r.studentId, status: "present" });
      }
      toast.success("Presença marcada para todos os alunos pendentes.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível marcar a presença."));
    } finally {
      setBulkPending(false);
    }
  };

  const spotsLabel =
    session.availableSpots === 1
      ? "1 vaga disponível"
      : `${session.availableSpots} vagas disponíveis`;
  // Avulso e experimental podem entrar mesmo com a aula lotada (o professor aceita);
  // sem avulso na turma, o dialogo so oferece experimental.
  const canAddStudent = canEnroll;
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
        onSuccess: (reservation) => {
          toast.success(
            input.kind === "trial"
              ? "Aluno inscrito como experimental."
              : reservation.chargeId
                ? "Aluno avulso adicionado com cobrança gerada."
                : "Aluno avulso adicionado.",
          );
          setAddOpen(false);
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, "Erro ao adicionar aluno."));
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
                } catch (err) {
                  toast.error(getErrorMessage(err, "Erro ao restaurar titular."));
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
          <div className="flex flex-wrap items-center gap-2">
            {canMark && recordSession && presentStudents.length > 0 ? (
              <Button size="sm" variant="outline" onClick={() => setClassRecordsOpen(true)}>
                <MessageSquarePlus className="size-4" />
                Registrar a aula
              </Button>
            ) : null}
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
        // Dica com o nome de cada acao (icones sem texto); atraso curto para nao piscar.
        <TooltipProvider delayDuration={200}>
          <ListContainer>
            {session.roster.map((r) => {
              const isEnrolled = r.kind === "enrolled" || !r.kind;
              const isTrial = r.kind === "trial";
              const student = clientById.get(r.studentId);
              const prog =
                modalityTrack && student
                  ? student.progressions?.[modalityTrack.modalityId]
                  : undefined;
              const currentLvl = modalityTrack
                ? (modalityTrack.track.levels.find(
                    (l) =>
                      l.id === prog?.levelId || l.name === prog?.levelName,
                  ) ?? modalityTrack.track.levels[0])
                : null;
              const currentSub = prog?.subLevel ?? 0;
              // "Para a próxima aula" do registro anterior vira o lembrete de hoje.
              const reminder = modalityTrack ? nextClassReminder(prog, session.date) : undefined;
              const rowActions: ListItemAction[] = [
                ...(student
                  ? [
                      ...(recordSession
                        ? [
                            {
                              key: "records",
                              label: "Registros de aula",
                              icon: <MessageSquarePlus className="size-4" />,
                              onSelect: () => setRecordsClient(student),
                            },
                          ]
                        : []),
                      {
                        key: "graduation",
                        label: vocabulary.levelsTitle,
                        icon: <GraduationCap className="size-4" />,
                        onSelect: () => setGraduationClient(student),
                      },
                    ]
                  : []),
                ...(!isEnrolled && canEnroll
                  ? [
                      {
                        key: "remove",
                        label: "Remover da aula",
                        icon: <X className="size-4" />,
                        destructive: true,
                        disabled: cancelReservationMut.isPending,
                        onSelect: () => void removeFromSession(r.studentId, r.studentName),
                      },
                    ]
                  : []),
              ];

              return (
                <ListRow key={r.studentId}>
                  <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <InitialsAvatar name={r.studentName} />
                      <div className="min-w-0 space-y-1">
                        {/* Linha 1: nome e so o que pede atencao (matriculado e o padrao) */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium truncate text-foreground">
                            {r.studentName}
                          </span>
                          {isEnrolled ? null : isTrial ? (
                            <span className="inline-flex items-center rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 text-[10px] font-medium">
                              Experimental
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-medium">
                              Avulso
                            </span>
                          )}
                          <BirthdayBadge
                            birthDate={student?.birthDate}
                            date={session.date}
                            showUpcoming
                            compact
                          />
                          <LevelChangeBadge
                            level={currentLvl}
                            birthDate={student?.birthDate}
                            levelWord={vocabulary.level}
                          />
                        </div>
                        {/* Linha 2: faixa/nivel sempre no mesmo lugar */}
                        {currentLvl && student ? (
                          <button
                            type="button"
                            className="block"
                            onClick={() => setGraduationClient(student)}
                            title={`Abrir ${vocabulary.levelsTitle.toLowerCase()}`}
                          >
                            <BeltBadge
                              name={currentLvl.name}
                              color={currentLvl.color}
                              variant={resolveTrackStyle(modalityTrack?.track)}
                              subLevel={currentSub}
                              maxSubLevels={currentLvl.maxSubLevels}
                              size="xs"
                            />
                          </button>
                        ) : null}
                        {reminder ? (
                          <p className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                            <NotebookPen className="size-3 shrink-0" aria-hidden />
                            Para hoje: {reminder}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {student && recordSession ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Registrar aula de ${r.studentName}`}
                              onClick={() => setRecordsClient(student)}
                            >
                              <MessageSquarePlus className="size-4 text-muted-foreground hover:text-primary" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent sideOffset={4}>Registrar aula</TooltipContent>
                        </Tooltip>
                      ) : null}

                      {isFutureSession ? (
                        <span className="text-xs text-muted-foreground">
                          Chamada abre em {shortDate}
                        </span>
                      ) : null}
                      {isFutureSession ? null : STATUSES.map((s) => {
                        const on = r.attendance === s.value;
                        const Icon = s.icon;
                        return (
                          <Tooltip key={s.value}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-pressed={on}
                                aria-label={`${s.label}: ${r.studentName}`}
                                disabled={!canMark || markMut.isPending || bulkPending}
                                onClick={() =>
                                  markMut.mutate(
                                    {
                                      sessionId,
                                      studentId: r.studentId,
                                      status: s.value,
                                    },
                                    {
                                      onError: (err) =>
                                        toast.error(
                                          getErrorMessage(err, "Não foi possível marcar a presença."),
                                        ),
                                    },
                                  )
                                }
                                className={cn(
                                  "inline-flex size-9 items-center justify-center rounded-md border transition-colors disabled:opacity-50 sm:size-8",
                                  on ? s.active : cn("border-input bg-background", s.idle),
                                )}
                              >
                                <Icon className="size-4" strokeWidth={on ? 2.75 : 2.25} aria-hidden />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={4}>{s.label}</TooltipContent>
                          </Tooltip>
                        );
                      })}

                      {/* Menu sempre no fim da linha (ou o espaco dele): os botoes de presenca ficam alinhados */}
                      {rowActions.length > 0 ? (
                        <ListItemActionsMenu
                          title="Mais opções"
                          ariaLabel={`Ações de ${r.studentName}`}
                          variant="ghost"
                          actions={rowActions}
                        />
                      ) : (
                        <span aria-hidden className="size-8 shrink-0" />
                      )}
                    </div>
                  </div>
                </ListRow>
              );
            })}
          </ListContainer>
        </TooltipProvider>
      )}

      <StudentGraduationDialog
        client={graduationClient}
        open={Boolean(graduationClient)}
        onOpenChange={(open) => {
          if (!open) setGraduationClient(null);
        }}
        initialModalityId={modalityTrack?.modalityId}
      />
      <StudentRecordsDialog
        client={recordsClient}
        open={Boolean(recordsClient)}
        onOpenChange={(open) => {
          if (!open) setRecordsClient(null);
        }}
        context={recordSession ?? undefined}
      />
      <ClassRecordsDialog
        open={classRecordsOpen}
        onOpenChange={setClassRecordsOpen}
        session={recordSession}
        students={presentStudents}
      />

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
  const [chosenKind, setKind] = useState<ReservationKind>("dropin");
  // Turma sem avulso: so experimental.
  const kind: ReservationKind = session.allowDropin ? chosenKind : "trial";
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
            {session.allowDropin
              ? "Inscreva um aluno como aula avulsa ou experimental para o dia "
              : "Esta turma não aceita aula avulsa. Inscreva um aluno como experimental para o dia "}
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
            <div className={cn("grid gap-3", session.allowDropin ? "grid-cols-2" : "grid-cols-1")}>
              {session.allowDropin ? (
                <button
                  type="button"
                  aria-pressed={kind === "dropin"}
                  onClick={() => setKind("dropin")}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                    kind === "dropin"
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                      : "border-border/60 hover:bg-muted/50 text-muted-foreground",
                  )}
                >
                  <span className="text-sm font-medium">Aula avulsa</span>
                  <span className="text-xs text-muted-foreground mt-0.5">
                    {defaultPrice > 0 ? "Gera cobrança avulsa" : "Sem valor configurado"}
                  </span>
                </button>
              ) : null}

              <button
                type="button"
                aria-pressed={kind === "trial"}
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
