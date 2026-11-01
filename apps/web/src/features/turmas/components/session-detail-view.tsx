"use client";

import { useTeamWords } from "@/features/settings";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import {
  AlertCircle,
  Check,
  CheckCheck,
  ChevronLeft,
  FileText,
  ClipboardList,
  GraduationCap,
  MessageSquarePlus,
  NotebookPen,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DialogFormFooter } from "@/components/form";
import { DialogBody } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { ListContainer, ListRow } from "@/components/shared/list";
import { BeltBadge } from "@/components/shared/belt-badge";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { BirthdayBadge } from "@/components/shared/birthday-badge";
import { MinorConsentBadge, isMinorConsentPending } from "@/components/shared/minor-consent-badge";
import { PageActionsMenu } from "@/components/shared/page-actions-menu";
import { BackLink } from "@/components/shared/back-link";
import { LevelChangeBadge } from "@/components/shared/level-change-badge";
import { Combobox } from "@/components/shared/combobox";
import { ageAt, currentLevelOf, resolveModalityTrack, resolveTrackStyle } from "@/lib/progression-tracks";
import { cn } from "@/lib/utils";
import { useModalityVocabulary } from "@/features/settings";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatCents, plural } from "@gestarahub/core/format";
import {
  isApiError,
  type AttendanceStatus,
  type ClassSessionDetail,
  type Client,
  type ReservationKind,
  type SessionRosterEntry,
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
import { StudentGradesDialog } from "@/features/grades";
import {
  useCancelReservation,
  useClearAttendance,
  useClassGroup,
  useClassSession,
  useMarkAttendance,
  useMarkManyAttendance,
  useRefreshAfterAttendance,
  useReserveSession,
  useRestorePrimaryInstructor,
} from "../hooks/use-turmas";
import { SubstituteInstructorDialog } from "./substitute-instructor-dialog";
import { calendarHrefFor } from "../calendar-filters";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { minorConsentUrl } from "@/lib/minor-consent-link";
import { dateInSpace } from "@gestarahub/core/date";

/**
 * Saldo do pacote de quem paga a aula com pacote: "7 de 10 aulas", "Última
 * aula" ou "Sem pacote" (ambar: nao ha pacote valido com saldo para esta aula).
 */
function PackageBalance({ entry }: { entry: SessionRosterEntry }) {
  if (entry.noPackage) {
    return <span className="font-medium text-amber-700 dark:text-amber-400">Sem pacote</span>;
  }
  if (entry.packageTotal === undefined) return null;
  if (entry.packageLastLesson) {
    return <span className="font-medium text-amber-700 dark:text-amber-400">Última aula do pacote</span>;
  }
  return (
    <span title="Aulas restantes no pacote" className="tabular-nums">
      {entry.packageRemaining} de {entry.packageTotal} aulas
    </span>
  );
}

const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: "Presente",
  absent: "Faltou",
  justified: "Justificada",
};

export function SessionDetailView({ sessionId }: { sessionId: string }) {
  const team = useTeamWords();
  const { data: session, isLoading, isError, error, refetch } = useClassSession(sessionId);
  const { data: turma } = useClassGroup(session?.classGroupId ?? "");
  const { data: categories } = useCategories();
  const { data: clients } = useClients({ status: "active" });
  const markMut = useMarkAttendance();
  const markManyMut = useMarkManyAttendance();
  const clearMut = useClearAttendance();
  const reserveMut = useReserveSession();
  const cancelReservationMut = useCancelReservation();
  const restoreMut = useRestorePrimaryInstructor();
  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();
  const router = useRouter();

  // Avulso/experimental sai da aula (cobranca avulsa em aberto e cancelada);
  // quem entrou pelo pacote recebe a aula de volta.
  async function removeFromSession(studentId: string, studentName: string, byPackage: boolean) {
    const ok = await confirmAction({
      title: "Remover da aula?",
      description: byPackage
        ? `${studentName} sai desta aula. Se a aula já foi gasta do pacote, ela volta.`
        : `${studentName} sai desta aula. Se houver cobrança avulsa em aberto, ela é cancelada.`,
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
  // Ficha do aluno: `clients:view`, ou so a dos alunos dele (professor): sem elas, o nome fica sem link.
  const canOpenProfile = can("clients:view") || can("clients:view_own");
  const canMark = can("attendance:mark");
  const canEnroll = can("enrollment:manage");
  const canManage = can("classes:manage");
  // Graduar e registrar a evolucao (a atendente nao; o professor so nas aulas dele).
  const canProgress = can("progression:manage");

  const [addOpen, setAddOpen] = useState(false);
  // Cada abertura comeca do zero (aluno e tipo da inscricao anterior nao ficam).
  const [addKey, setAddKey] = useState(0);
  const [substituteOpen, setSubstituteOpen] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  // Chamada otimista: o toque aparece na hora e as gravacoes de cada aluno
  // seguem em fila, na ordem dos toques (toque rapido nunca se perde).
  const [optimistic, setOptimistic] = useState<ReadonlyMap<string, AttendanceStatus | null>>(new Map());
  // Filas por aluno: objeto estavel e mutavel, fora do que a tela desenha.
  const [writeQueues] = useState(() => new Map<string, { chain: Promise<void>; size: number }>());
  const refreshAfterAttendance = useRefreshAfterAttendance();
  // Toques ainda gravando (a lista fica `aria-busy` ate o ultimo chegar ao servidor).
  const [pendingWrites, setPendingWrites] = useState(0);
  // Sair da página com toque ainda gravando perderia a marcação: o navegador pergunta antes.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (writeQueues.size === 0) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [writeQueues]);
  // Dois modais por aluno (Graduação e Registros de aula) e o registro da turma inteira.
  const [graduationClient, setGraduationClient] = useState<Client | null>(null);
  const [recordsClient, setRecordsClient] = useState<Client | null>(null);
  const [gradesClient, setGradesClient] = useState<Client | null>(null);
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
  // Palavras da modalidade da aula (Faixa ou Nivel), nao da area.
  const vocabulary = useModalityVocabulary(modalityTrack?.track);
  // "Notas" so quando a modalidade da turma tem avaliacoes.
  const hasAssessments = Boolean(
    turma && (categories ?? []).find((c) => c.id === turma.modalityId)?.assessments?.enabled,
  );

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
            <Button onClick={() => void refetch()}>
              <RotateCcw className="size-4" />
              Tentar novamente
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/classes/calendar">
              <ChevronLeft className="size-4" />
              Calendário
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Lista com os toques ainda gravando por cima do que veio do servidor.
  const roster = session.roster.map((r) =>
    optimistic.has(r.studentId) ? { ...r, attendance: optimistic.get(r.studentId) ?? undefined } : r,
  );
  const rosterIds = new Set(roster.map((r) => r.studentId));
  // Presenca so faz sentido para aula que ja aconteceu (ou acontece hoje).
  const isFutureSession = session.date > dateInSpace();
  const availableClients = (clients ?? []).filter((c) => !rosterIds.has(c.id));

  const today = dateInSpace();
  const isToday = session.date === today;
  const sessionDate = parseISO(session.date);
  const dateLabel = format(sessionDate, "EEEE, d 'de' MMMM", { locale: ptBR });
  const shortDate = format(sessionDate, "dd/MM");

  // Resumo da chamada (so para aula de hoje ou passada).
  const counts = {
    present: roster.filter((r) => r.attendance === "present").length,
    absent: roster.filter((r) => r.attendance === "absent").length,
    justified: roster.filter((r) => r.attendance === "justified").length,
    pending: roster.filter((r) => !r.attendance).length,
  };

  // Registro de aula: so com trilha na modalidade (os registros ficam nela).
  // Aula futura nao tem registro (so no dia ou depois).
  const recordSession =
    modalityTrack?.modalityId && !isFutureSession
      ? {
          sessionId: session.id,
          date: session.date,
          classGroupId: session.classGroupId,
          classGroupName: session.className,
          modalityId: modalityTrack.modalityId,
          weekdays: turma?.meetingSlots.map((slot) => slot.weekday),
        }
      : null;
  const presentStudents = roster
    .filter((r) => r.attendance === "present")
    .map((r) => clientById.get(r.studentId))
    .filter((c): c is Client => Boolean(c));

  // Chamada so para aula de hoje ou passada, com permissao.
  const marking = canMark && !isFutureSession;
  const attendanceBusy = bulkPending;
  const onMarkError = (err: unknown) => {
    toast.error(getErrorMessage(err, "Não foi possível marcar a presença."));
  };
  // Grava na fila do aluno; quando a fila dele esvazia, rele a aula e o que
  // veio do servidor passa a valer (erro tambem volta ao estado real).
  const writeAttendance = (studentId: string, status: AttendanceStatus | null) => {
    setOptimistic((prev) => new Map(prev).set(studentId, status));
    setPendingWrites((n) => n + 1);
    const queue = writeQueues.get(studentId) ?? { chain: Promise.resolve(), size: 0 };
    queue.size += 1;
    queue.chain = queue.chain
      .then(() =>
        status
          ? markMut.mutateAsync({ sessionId, studentId, status, deferRefresh: true })
          : // Desmarcar devolve a aula do pacote, se gastou.
            clearMut.mutateAsync({ sessionId, studentId, deferRefresh: true }),
      )
      .then(() => undefined, onMarkError)
      .then(async () => {
        setPendingWrites((n) => n - 1);
        queue.size -= 1;
        if (queue.size > 0) return;
        writeQueues.delete(studentId);
        // Ultima gravacao da chamada: frequencia, pacotes e resumos relidos uma vez.
        if (writeQueues.size === 0) refreshAfterAttendance();
        await refetch();
        if (writeQueues.has(studentId)) return;
        setOptimistic((prev) => {
          const next = new Map(prev);
          next.delete(studentId);
          return next;
        });
      });
    writeQueues.set(studentId, queue);
  };
  const setAttendance = (r: SessionRosterEntry, status?: AttendanceStatus) =>
    writeAttendance(r.studentId, status ?? null);
  // Toque na linha = veio. Com a chamada aberta, tocar de novo desmarca; com
  // ela concluida (ninguem a marcar), vira falta. Falta e justificada voltam a presente.
  const tapRow = (r: SessionRosterEntry) => {
    if (attendanceBusy) return;
    if (r.attendance === "present") {
      setAttendance(r, counts.pending === 0 ? "absent" : undefined);
      return;
    }
    setAttendance(r, "present");
  };

  const markPending = async (status: AttendanceStatus) => {
    setBulkPending(true);
    try {
      // Os toques ainda gravando entram antes (a lista ja mostra o que foi tocado).
      await Promise.all([...writeQueues.values()].map((q) => q.chain));
      const pending = roster.filter((entry) => !entry.attendance);
      if (pending.length > 0) {
        // Uma gravacao para todos (a mutacao rele turmas, pacotes e resumos no fim).
        await markManyMut.mutateAsync({ sessionId, studentIds: pending.map((r) => r.studentId), status });
      }
      return pending.length;
    } finally {
      setBulkPending(false);
    }
  };

  const markAllPresent = async () => {
    try {
      await markPending("present");
      toast.success("Presença marcada para todos os alunos pendentes.");
    } catch (err) {
      onMarkError(err);
    }
  };

  // Concluir: quem nao foi marcado vira falta. Sem nenhum presente, confirma
  // antes (falta gasta pacote e entra no "Sentimos sua falta").
  const concludeAttendance = async () => {
    if (counts.present === 0) {
      const ok = await confirmAction({
        title: "Ninguém veio?",
        description: `Os ${plural(counts.pending, "aluno fica", "alunos ficam")} com falta.`,
        confirmLabel: "Marcar falta em todos",
        variant: "default",
      });
      if (!ok) return;
    }
    try {
      const absences = await markPending("absent");
      toast.success(
        absences > 0
          ? `Chamada concluída. ${plural(absences, "falta marcada", "faltas marcadas")}.`
          : "Chamada concluída.",
      );
    } catch (err) {
      onMarkError(err);
    }
  };

  const restorePrimary = async () => {
    try {
      await restoreMut.mutateAsync(session.id);
      toast.success(`${team.title} titular restaurado com sucesso.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao restaurar titular."));
    }
  };

  const whenLabel = `${isToday ? "Hoje" : dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}, ${session.start}`;
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
              : input.kind === "package"
                ? "Aluno inscrito pelo pacote."
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

  const summary = [
    `${counts.present} ${counts.present === 1 ? "presente" : "presentes"}`,
    counts.absent ? `${counts.absent} ${counts.absent === 1 ? "falta" : "faltas"}` : null,
    counts.justified ? `${counts.justified} ${counts.justified === 1 ? "justificada" : "justificadas"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const rollCallHint = isFutureSession
    ? `A chamada abre em ${shortDate}`
    : counts.pending === 0
      ? summary
      : marking
        ? "Toque em quem veio"
        : `${summary} · ${counts.pending} a marcar`;
  const total = roster.length;

  const pageActions: ListItemAction[] = [
    ...(canAddStudent
      ? [
          {
            key: "add-student",
            label: "Adicionar aluno nesta aula",
            icon: <UserPlus className="size-4" />,
            onSelect: () => {
              if (addDisabledReason) {
                toast.info(addDisabledReason);
                return;
              }
              setAddKey((k) => k + 1);
              setAddOpen(true);
            },
          },
        ]
      : []),
    ...(canManage
      ? [
          {
            key: "substitute",
            label: session.isSubstitute ? "Alterar substituto" : `Trocar ${team.lower}`,
            icon: <UserCheck className="size-4" />,
            onSelect: () => setSubstituteOpen(true),
          },
        ]
      : []),
    ...(canManage && session.isSubstitute
      ? [
          {
            key: "restore",
            label: "Restaurar titular",
            icon: <RotateCcw className="size-4" />,
            disabled: restoreMut.isPending,
            onSelect: () => void restorePrimary(),
          },
        ]
      : []),
    {
      key: "class",
      label: "Abrir a turma",
      icon: <Users className="size-4" />,
      onSelect: () => router.push(`/classes/${session.classGroupId}`),
    },
  ];

  return (
    <>
      {confirmDialog}
      <BackLink fallbackHref={calendarHrefFor(session.date)} />

      {/* Cabecalho: quando e quem numa linha; acoes raras no menu */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{session.className}</h1>
          {/* Pedacos curtos nao quebram no meio ("Carlos / Silva"). */}
          <p className="text-sm text-muted-foreground">
            <span className="whitespace-nowrap">{whenLabel}</span> ·{" "}
            <span className={session.instructorName.length <= 24 ? "whitespace-nowrap" : undefined}>
              {session.instructorName}
            </span>
          </p>
          {session.isSubstitute ? (
            <p className="text-xs text-muted-foreground">
              Substitui {session.primaryInstructorName}
              {session.substitutionReason ? ` · ${session.substitutionReason}` : ""}
            </p>
          ) : null}
        </div>
        <PageActionsMenu label="Mais ações da aula" actions={pageActions} />
      </div>

      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-base font-semibold text-foreground">Chamada</h2>
        {total > 0 ? <p className="text-xs text-muted-foreground sm:text-right">{rollCallHint}</p> : null}
      </div>

      {total === 0 ? (
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
        <ListContainer busy={pendingWrites > 0}>
          {roster.map((r) => {
            const isEnrolled = r.kind === "enrolled" || !r.kind;
            const isTrial = r.kind === "trial";
            const isPackage = r.kind === "package";
            const student = clientById.get(r.studentId);
            const prog =
              modalityTrack && student
                ? student.progressions?.[modalityTrack.modalityId]
                : undefined;
            const currentLvl = modalityTrack
              ? (currentLevelOf(modalityTrack.track, prog, ageAt(student?.birthDate, session.date)) ?? null)
              : null;
            const currentSub = prog?.subLevel ?? 0;
            const isBelt = resolveTrackStyle(modalityTrack?.track) === "belt";
            // "Para a próxima aula" do registro anterior vira o lembrete de hoje.
            const reminder = modalityTrack
              ? nextClassReminder(prog, session.date, {
                  classGroupId: session.classGroupId,
                  weekdays: turma?.meetingSlots.map((slot) => slot.weekday),
                })
              : undefined;
            const markActions: ListItemAction[] = marking
              ? [
                  ...(r.attendance !== "absent"
                    ? [
                        {
                          key: "absent",
                          label: "Marcar falta",
                          icon: <X className="size-4" />,
                          disabled: attendanceBusy,
                          onSelect: () => setAttendance(r, "absent"),
                        },
                      ]
                    : []),
                  ...(r.attendance !== "justified"
                    ? [
                        {
                          key: "justified",
                          label: "Justificar falta",
                          icon: <FileText className="size-4" />,
                          disabled: attendanceBusy,
                          onSelect: () => setAttendance(r, "justified"),
                        },
                      ]
                    : []),
                  ...(r.attendance
                    ? [
                        {
                          key: "clear",
                          label: "Desmarcar",
                          icon: <RotateCcw className="size-4" />,
                          disabled: attendanceBusy,
                          onSelect: () => setAttendance(r, undefined),
                        },
                      ]
                    : []),
                ]
              : [];
            const rowActions: ListItemAction[] = [
              ...markActions,
              ...(student
                ? [
                    ...(recordSession && canProgress
                      ? [
                          {
                            key: "records",
                            label: "Registrar aula",
                            icon: <MessageSquarePlus className="size-4" />,
                            onSelect: () => setRecordsClient(student),
                          },
                        ]
                      : []),
                    ...(canProgress
                      ? [
                          {
                            key: "graduation",
                            label: vocabulary.levelsTitle,
                            icon: <GraduationCap className="size-4" />,
                            onSelect: () => setGraduationClient(student),
                          },
                        ]
                      : []),
                    ...(hasAssessments
                      ? [
                          {
                            key: "grades",
                            label: "Notas",
                            icon: <ClipboardList className="size-4" />,
                            onSelect: () => setGradesClient(student),
                          },
                        ]
                      : []),
                    ...(isMinorConsentPending(student)
                      ? [
                          {
                            key: "minor-consent",
                            label: "Enviar autorização (WhatsApp)",
                            icon: <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />,
                            onSelect: () => {
                              const url = minorConsentUrl(student.id);
                              const guardian =
                                student.guardians?.find((g) => Boolean(g.phone)) || student.guardians?.[0];
                              const targetPhone = guardian?.phone || student.phone;
                              const greeting = guardian?.name ? `, ${guardian.name}` : "";
                              const msg = `Olá${greeting}! Segue o link de autorização de matrícula e LGPD do aluno(a) ${student.name}:\n\n${url}\n\nPor favor, acesse o link para conferir e confirmar pelo celular. Obrigado!`;

                              if (targetPhone) {
                                const cleanPhone = targetPhone.replace(/\D/g, "");
                                const phoneWithCountry = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
                                window.open(
                                  `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`,
                                  "_blank"
                                );
                              } else {
                                if (navigator.clipboard) {
                                  navigator.clipboard.writeText(url);
                                  toast.info(
                                    "Nenhum telefone de contato encontrado. Link copiado para a área de transferência."
                                  );
                                }
                              }
                            },
                          },
                        ]
                      : []),
                  ]
                : []),
              ...(canOpenProfile
                ? [
                    {
                      key: "profile",
                      label: "Abrir ficha",
                      icon: <UserRound className="size-4" />,
                      onSelect: () => router.push(`/clients/${r.studentId}`),
                    },
                  ]
                : []),
              ...(!isEnrolled && canEnroll
                ? [
                    {
                      key: "remove",
                      label: "Remover da aula",
                      icon: <UserMinus className="size-4" />,
                      destructive: true,
                      disabled: cancelReservationMut.isPending,
                      onSelect: () => void removeFromSession(r.studentId, r.studentName, isPackage),
                    },
                  ]
                : []),
            ];
            const absentLike = r.attendance === "absent" || r.attendance === "justified";

            const row = (
              <ListRow
                key={r.studentId}
                onClick={marking ? () => tapRow(r) : undefined}
                aria-label={marking ? `${r.studentName}: ${r.attendance ? ATTENDANCE_LABEL[r.attendance] : "sem marcação"}` : undefined}
                actions={
                  absentLike || rowActions.length > 0 ? (
                    <>
                      {absentLike ? (
                        <span
                          className={cn(
                            "text-xs font-medium",
                            r.attendance === "absent"
                              ? "text-red-600 dark:text-red-400"
                              : "text-amber-700 dark:text-amber-400",
                          )}
                        >
                          {ATTENDANCE_LABEL[r.attendance as AttendanceStatus]}
                        </span>
                      ) : null}
                      {rowActions.length > 0 ? (
                        <ListItemActionsMenu
                          title="Mais opções"
                          ariaLabel={`Ações de ${r.studentName}`}
                          variant="ghost"
                          actions={rowActions}
                        />
                      ) : null}
                    </>
                  ) : undefined
                }
              >
                <div className="flex items-center gap-3">
                  {/* Circulo de presenca: vazio = sem marcar; verde = veio */}
                  {isFutureSession ? null : (
                    <span
                      aria-hidden
                      className={cn(
                        "inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        r.attendance === "present"
                          ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
                          : "border-border text-transparent",
                      )}
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  )}
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{r.studentName}</p>
                    {/* Nivel em texto (faixa mantem a cor) e so o que foge do padrao */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {currentLvl ? (
                        isBelt ? (
                          <BeltBadge
                            name={currentLvl.name}
                            color={currentLvl.color}
                            variant="belt"
                            subLevel={currentSub}
                            maxSubLevels={currentLvl.maxSubLevels}
                            size="xs"
                          />
                        ) : (
                          <span>
                            {currentLvl.name}
                            {currentSub > 0 ? ` · ${currentSub}ª etapa` : ""}
                          </span>
                        )
                      ) : null}
                      {isTrial ? (
                        <span className="font-medium text-purple-600 dark:text-purple-400">Experimental</span>
                      ) : isPackage ? (
                        <span>Pacote</span>
                      ) : !isEnrolled ? (
                        <span className="font-medium text-amber-700 dark:text-amber-400">Avulso</span>
                      ) : null}
                      <PackageBalance entry={r} />
                      <BirthdayBadge birthDate={student?.birthDate} date={session.date} showUpcoming compact />
                      <MinorConsentBadge client={student} compact />
                      <LevelChangeBadge level={currentLvl} birthDate={student?.birthDate} levelWord={vocabulary.level} />
                    </div>
                    {reminder ? (
                      <p className="flex items-start gap-1 pt-0.5 text-xs text-amber-800 dark:text-amber-300">
                        <NotebookPen className="mt-0.5 size-3 shrink-0" aria-hidden />
                        Para hoje: {reminder}
                      </p>
                    ) : null}
                  </div>
                </div>
              </ListRow>
            );
            if (rowActions.length === 0) return row;
            return (
              <ListItemContextMenu key={r.studentId} actions={rowActions}>
                {row}
              </ListItemContextMenu>
            );
          })}
        </ListContainer>
      )}

      {/* Uma acao por vez embaixo: concluir a chamada, depois registrar a aula */}
      {total > 0 && marking ? (
        <div className="sticky bottom-4 z-10 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 shadow-md">
          {counts.pending === 0 ? (
            <>
              <p className="text-sm text-foreground">Chamada concluída.</p>
              {recordSession && canProgress && presentStudents.length > 0 ? (
                <Button variant="outline" onClick={() => setClassRecordsOpen(true)}>
                  <MessageSquarePlus className="size-4" />
                  {presentStudents.some((c) =>
                    c.progressions?.[recordSession.modalityId]?.evaluations.some((e) => e.sessionId === session.id),
                  )
                    ? "Editar registro da aula"
                    : "Registrar a aula"}
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {counts.present} de {total} {total === 1 ? "presente" : "presentes"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {counts.present === 0 ? (
                  <Button variant="outline" onClick={() => void markAllPresent()} disabled={attendanceBusy}>
                    <CheckCheck className="size-4" />
                    Todos vieram
                  </Button>
                ) : null}
                <Button onClick={() => void concludeAttendance()} disabled={attendanceBusy}>
                  {bulkPending ? "Marcando..." : "Concluir chamada"}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
      <StudentGraduationDialog
        client={graduationClient}
        open={Boolean(graduationClient)}
        onOpenChange={(open) => {
          if (!open) setGraduationClient(null);
        }}
        initialModalityId={modalityTrack?.modalityId}
      />
      <StudentGradesDialog
        client={gradesClient}
        open={Boolean(gradesClient)}
        onOpenChange={(open) => {
          if (!open) setGradesClient(null);
        }}
        initialModalityId={turma?.modalityId}
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
        key={addKey}
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

/** Opcao do tipo de inscricao na aula (avulsa, pacote ou experimental). */
function KindOption({
  selected,
  onSelect,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  // Uma opcao por linha (o drawer e estreito): marcador a esquerda, titulo e a linha de explicacao.
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/70 bg-background hover:border-border hover:bg-muted/40",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary" : "border-border",
        )}
      >
        {selected ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
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
  // Erro junto do campo, nao num aviso que some (achado 40).
  const [studentError, setStudentError] = useState<string | null>(null);
  const candidates = session.packageCandidates;
  const hasPackages = candidates.length > 0;
  const [chosenKind, setKind] = useState<ReservationKind>(
    session.allowDropin ? "dropin" : hasPackages ? "package" : "trial",
  );
  // Turma sem avulso nao oferece avulsa; sem aluno com pacote, nao oferece pacote.
  const kind: ReservationKind =
    (chosenKind === "dropin" && !session.allowDropin) || (chosenKind === "package" && !hasPackages)
      ? "trial"
      : chosenKind;
  const defaultPrice = session.sessionPriceCents ?? 0;
  const isCandidate = (id: string) => candidates.some((c) => c.studentId === id);
  const options =
    kind === "package"
      ? candidates.map((c) => ({
          value: c.studentId,
          label: `${c.studentName} · ${c.remaining === 1 ? "1 aula" : `${c.remaining} aulas`} no pacote`,
        }))
      : availableClients.map((c) => ({ value: c.id, label: c.name }));

  // Aluno com pacote para esta aula entra pelo pacote (sem cobranca avulsa).
  const chooseStudent = (id: string) => {
    setStudentId(id);
    setStudentError(null);
    if (id && isCandidate(id) && kind === "dropin") setKind("package");
  };
  const chooseKind = (next: ReservationKind) => {
    setKind(next);
    if (next === "package" && studentId && !isCandidate(studentId)) setStudentId("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setStudentError("Selecione o aluno.");
      return;
    }
    onAdd({
      studentId,
      kind,
      amountCents: kind === "dropin" ? defaultPrice : 0,
    });
  };

  const kinds = [
    session.allowDropin ? "aula avulsa" : null,
    hasPackages ? "pelo pacote" : null,
    "experimental",
  ].filter(Boolean) as string[];
  const kindsText = kinds.length === 1 ? kinds[0] : `${kinds.slice(0, -1).join(", ")} ou ${kinds[kinds.length - 1]}`;

  // Drawer a direita, como os outros formularios (doc 07 §2.7; pedido de 31/10/2026).
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">Adicionar aluno nesta aula</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Aula de {format(parseISO(session.date), "EEEE, dd/MM", { locale: ptBR })}. Entra como {kindsText}.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="session-add-student">
                Aluno<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Combobox
                id="session-add-student"
                value={studentId}
                onChange={chooseStudent}
                options={options}
                placeholder="Selecione o aluno"
                searchPlaceholder="Buscar aluno..."
                emptyMessage="Nenhum aluno encontrado."
                ariaLabel="Aluno"
              />
              {studentError ? (
                <p role="alert" className="text-sm text-destructive">
                  {studentError}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>
                Tipo de inscrição<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <div className="space-y-2">
                {session.allowDropin ? (
                  <KindOption
                    selected={kind === "dropin"}
                    onSelect={() => chooseKind("dropin")}
                    title="Aula avulsa"
                    description={defaultPrice > 0 ? `Gera cobrança de ${formatCents(defaultPrice)}` : "Sem valor configurado na turma"}
                  />
                ) : null}
                {hasPackages ? (
                  <KindOption
                    selected={kind === "package"}
                    onSelect={() => chooseKind("package")}
                    title="Pacote"
                    description="Usa 1 aula do pacote do aluno"
                  />
                ) : null}
                <KindOption
                  selected={kind === "trial"}
                  onSelect={() => chooseKind("trial")}
                  title="Experimental"
                  description="Cortesia, sem cobrança"
                />
              </div>
            </div>

            {kind === "dropin" ? (
              // So leitura: o valor vem da turma (muda em Turmas, editar).
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Valor da cobrança</p>
                  <p className="text-xs text-muted-foreground">Configurado na turma, para aulas avulsas.</p>
                </div>
                <p className="shrink-0 text-base font-semibold tabular-nums">{formatCents(defaultPrice)}</p>
              </div>
            ) : null}
          </DialogBody>
          <DialogFormFooter isPending={isPending} className="shrink-0 border-t border-border/40 bg-background p-6 pt-4" />
        </form>
      </SheetContent>
    </Sheet>
  );
}
