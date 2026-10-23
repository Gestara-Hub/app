"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  Award,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  ListChecks,
  Lock,
  MessageSquarePlus,
  Package,
  Pencil,
  Power,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  Wallet,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ListItemCard } from "@/components/shared/list-item-card";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { ListContainer, ListRow, RecordStatusBadge, SearchInput } from "@/components/shared/list";
import { PageActionsMenu } from "@/components/shared/page-actions-menu";
import { BackLink } from "@/components/shared/back-link";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { BeltBadge } from "@/components/shared/belt-badge";
import { BirthdayBadge } from "@/components/shared/birthday-badge";
import { MinorConsentBadge, isMinorConsentPending } from "@/components/shared/minor-consent-badge";
import { LevelChangeBadge } from "@/components/shared/level-change-badge";
import { ageAt, currentLevelOf, resolveModalityTrack, resolveTrackStyle } from "@/lib/progression-tracks";
import { cn } from "@/lib/utils";
import { useModalityVocabulary } from "@/features/settings";
import { normalizeText } from "@/lib/text";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { nowTime, todayISO } from "@gestarahub/core/date";
import { plural, pluralWord } from "@gestarahub/core/format";
import { classBillingMode } from "@gestarahub/core/billing";
import { packageState, usablePackagesFor } from "@gestarahub/core/packages";
import {
  isApiError,
  type ChargeView,
  type Client,
  type EnrollmentView,
  type Id,
  type StudentPackageView,
  type WaitlistEntryView,
} from "@gestarahub/contracts";
import { useCan, useHasFeature } from "@/features/auth";
import { useCategories } from "@/features/categories";
import { StudentGraduationDialog, StudentRecordsDialog, useClients } from "@/features/clients";
import { ClassAssessmentsTab, StudentGradesDialog, useClassAssessments } from "@/features/grades";
import {
  useCancelEnrollment,
  useClassGroup,
  useEnrollments,
  usePromoteWaitlist,
  useRemoveFromWaitlist,
  useSetEnrollmentPayment,
  useClassSessions,
  useReactivateClassGroup,
  useWaitlist,
} from "../hooks/use-turmas";
import { useCharges } from "../hooks/use-billing";
import { pickNextSession } from "../next-session";
import { useStudentPackages } from "../hooks/use-packages";
import { slotsSummary } from "./turmas-view";
import { EnrollStudentsDialog } from "./enroll-students-dialog";
import { SetupCompleteDialog } from "./setup-complete-dialog";
import { TurmaFormDrawer } from "./turma-form-drawer";
import { PromoteToCourseDialog } from "./promote-to-course-dialog";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { minorConsentUrl } from "@/lib/minor-consent-link";

type Tab = "enrolled" | "waitlist" | "assessments";

/** Busca so a partir de 9 alunos; abaixo disso ela so ocupa espaco. */
const SEARCH_MIN_STUDENTS = 8;
/** Abaixo de 75% de presenca a linha avisa "Presença baixa". */
const LOW_ATTENDANCE = 0.75;

const ddmm = (iso: string) => format(parseISO(iso), "dd/MM");

/** Texto do cancelamento da matricula: no curso, explica o que acontece com as parcelas (decisao 1). */
function cancelEnrollmentText(e: EnrollmentView): string {
  if (!e.course) {
    return `${e.studentName} sai da turma e deixa de aparecer na lista de chamada. As cobranças do aluno não mudam.`;
  }
  if (e.isCompleted) {
    return `${e.studentName} sai da turma. O curso já terminou: as parcelas continuam como estão.`;
  }
  const future = e.courseInstallments?.future ?? 0;
  const due = e.courseInstallments?.due ?? 0;
  return [
    `${e.studentName} sai do curso.`,
    "As parcelas pagas ficam.",
    future === 0
      ? "Não há parcelas futuras para cancelar."
      : future === 1
        ? "A parcela futura será cancelada."
        : `As ${future} parcelas futuras serão canceladas.`,
    // "Vencida" errava para a que vence hoje.
    due > 0
      ? due === 1
        ? "A parcela que vence até hoje continua para receber."
        : `As ${due} parcelas que vencem até hoje continuam para receber.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function isApiNotFound(error: unknown): boolean {
  return isApiError(error) && error.code === "NOT_FOUND";
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

/** Atalho para a aula de hoje (ou a proxima): o caminho mais usado a partir da turma. */
function NextSessionLink({ classGroupId, canMark }: { classGroupId: Id; canMark: boolean }) {
  const today = todayISO();
  const { data: sessions } = useClassSessions({
    classGroupId,
    dateFrom: today,
    dateTo: format(addDays(parseISO(today), 13), "yyyy-MM-dd"),
  });
  const next = pickNextSession(sessions ?? [], today, nowTime());
  if (!next) return null;
  const isToday = next.date === today;
  const day = format(parseISO(next.date), "EEE, dd/MM", { locale: ptBR }).replace(".", "");
  return (
    <Link
      href={`/classes/sessions/${encodeURIComponent(next.id)}`}
      className="flex w-full items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
    >
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {isToday ? (
          <span className="rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">Hoje</span>
        ) : (
          <span className="text-muted-foreground">Próxima aula</span>
        )}
        <span className="tabular-nums text-foreground">
          {isToday ? next.start : `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${next.start}`}
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-foreground">
        {isToday && canMark ? "Fazer chamada" : "Ver aula"}
        <ChevronRight className="size-4" />
      </span>
    </Link>
  );
}

export function TurmaDetailView({
  id,
  enrollCompletesSetup = false,
}: {
  id: string;
  /** A 1a matricula conclui a configuracao inicial (area de curso): comemora. */
  enrollCompletesSetup?: boolean;
}) {
  const [celebrateEnroll, setCelebrateEnroll] = useState(false);
  const { data: turma, isLoading, isError, error, refetch } = useClassGroup(id);
  const { data: enrollments, isPending: enrollmentsPending } = useEnrollments(id);
  const { data: clients } = useClients({ status: "active" });
  const { data: categories } = useCategories();
  const { data: waitlist } = useWaitlist(id);
  const cancelMut = useCancelEnrollment();
  const paymentMut = useSetEnrollmentPayment();
  const promoteMut = usePromoteWaitlist();
  const removeWaitMut = useRemoveFromWaitlist();
  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();
  const reactivateMut = useReactivateClassGroup();
  const can = useCan();
  // Ficha do aluno pede `clients:view` (o professor nao tem): sem ela, o nome fica sem link.
  const canOpenProfile = can("clients:view");
  const canManage = can("enrollment:manage");
  // Certificado de conclusao: Plano Profissional; no gratis o item abre o upsell.
  const hasCertificates = useHasFeature()("certificates");
  const canEditTurma = can("classes:manage");
  const canMark = can("attendance:mark");
  // "Pagamento atrasado" na linha so para quem ve cobrancas.
  const { data: overdueCharges } = useCharges({ status: "overdue" }, can("billing:view"));
  // So o atraso do que esta turma cobra (antes "Pagamento atrasado" aparecia
  // em turma sem cobranca por causa de outra cobranca). TUR-26.
  const overdueStudentIds = useMemo(() => {
    if (!turma) return new Set<string>();
    const mode = classBillingMode(turma);
    const counts = (c: ChargeView) =>
      mode === "course"
        ? c.kind === "course" && c.classGroupId === turma.id
        : mode === "package"
          ? c.kind === "package"
          : mode === "membership"
            ? c.kind === "membership"
            : false;
    return new Set((overdueCharges ?? []).filter(counts).map((c) => c.studentId));
  }, [overdueCharges, turma]);

  const searchParams = useSearchParams();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const enrollParam = searchParams?.get("enroll") === "true";
  const [enrollOpen, setEnrollOpen] = useState(enrollParam);
  // Ja na turma, o "Fazer agora" do Proximo passo (?enroll=true) abre de novo.
  const [seenEnrollParam, setSeenEnrollParam] = useState(enrollParam);
  if (enrollParam !== seenEnrollParam) {
    setSeenEnrollParam(enrollParam);
    if (enrollParam) setEnrollOpen(true);
  }
  const [graduationClient, setGraduationClient] = useState<Client | null>(null);
  const [recordsClient, setRecordsClient] = useState<Client | null>(null);
  const [gradesClient, setGradesClient] = useState<Client | null>(null);
  const [tab, setTab] = useState<Tab>("enrolled");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<Id>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [promoteCourseEntry, setPromoteCourseEntry] = useState<WaitlistEntryView | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  // Selecao em lote: so quando pedida em "Selecionar alunos" (menu do cabecalho).
  const [selecting, setSelecting] = useState(false);

  const handleEnrollOpenChange = (open: boolean) => {
    setEnrollOpen(open);
    if (!open && typeof window !== "undefined" && window.location.search.includes("enroll=")) {
      window.history.replaceState(null, "", `/classes/${id}`);
    }
  };

  const rows = useMemo(() => {
    const term = normalizeText(search);
    const list = enrollments ?? [];
    // Sem a busca na tela (turma pequena), um texto antigo nao pode seguir filtrando.
    if (!term || list.length <= SEARCH_MIN_STUDENTS) return list;
    return list.filter((e) => normalizeText(e.studentName).includes(term));
  }, [enrollments, search]);

  const clientById = useMemo(
    () => new Map((clients ?? []).map((c) => [c.id, c])),
    [clients],
  );

  const modalityTrack = useMemo(() => {
    if (!turma) return null;
    const cat = (categories ?? []).find((c) => c.id === turma.modalityId);
    const track = resolveModalityTrack(
      cat ?? { name: turma.modalityName },
    );
    return track.enabled && track.levels.length > 0 ? track : null;
  }, [turma, categories]);
  // Palavras da modalidade da turma (Faixa ou Nivel), nao da area.
  const vocabulary = useModalityVocabulary(modalityTrack);
  // Notas: aba "Avaliações" e item "Notas" so quando a modalidade tem avaliacoes.
  const hasAssessments = Boolean(
    turma && (categories ?? []).find((c) => c.id === turma.modalityId)?.assessments?.enabled,
  );
  const { data: assessmentsView } = useClassAssessments(id, hasAssessments);

  // Turma de mensalidade: alunos com pacote da modalidade podem pagar com ele.
  // Turma de pacote (ou quem paga com ele): avisos de ultima aula e sem pacote.
  const isMembership = turma ? classBillingMode(turma) === "membership" : false;
  const isPackageClass = turma ? classBillingMode(turma) === "package" : false;
  const { data: activePackages, isPending: packagesPending } = useStudentPackages(
    { status: "active" },
    (isMembership || isPackageClass) && canManage,
  );
  // Aulas que restam hoje nesta turma, somando os pacotes validos de cada aluno.
  const packageLessonsByStudent = useMemo(() => {
    const owned = new Map<Id, StudentPackageView[]>();
    for (const p of activePackages ?? []) {
      owned.set(p.studentId, [...(owned.get(p.studentId) ?? []), p]);
    }
    const today = todayISO();
    const left = new Map<Id, number>();
    for (const [studentId, list] of owned) {
      const usable = usablePackagesFor(list, { classGroupId: turma?.id, modalityId: turma?.modalityId, date: today });
      if (usable.length > 0) {
        left.set(studentId, usable.reduce((sum, p) => sum + packageState(p, today).remaining, 0));
      }
    }
    return left;
  }, [activePackages, turma?.id, turma?.modalityId]);

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-md" />;
  }

  if (!turma) {
    const notFound = isApiNotFound(error);
    return (
      <div className="rounded-lg border">
        <ModuleEmptyGuide
          icon={<AlertCircle className="size-8" />}
          title={notFound || !isError ? "Turma não encontrada" : "Não foi possível carregar a turma"}
          description={
            notFound || !isError
              ? "Ela pode ter sido removida ou o link está incorreto."
              : getErrorMessage(error, "Tente novamente em instantes.")
          }
          actionLabel={notFound || !isError ? undefined : "Tentar novamente"}
          onAction={notFound || !isError ? undefined : () => void refetch()}
        />
        <div className="flex justify-center pb-6">
          <Button asChild variant="outline">
            <Link href="/classes">
              <ChevronLeft className="size-4" />
              Turmas
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const enrolledIds = new Set((enrollments ?? []).map((e) => e.studentId));
  const waitlistedIds = new Set((waitlist ?? []).map((w) => w.studentId));
  // O lote e o que esta selecionado, com ou sem busca (a busca so filtra a lista).
  const selectedRows = (enrollments ?? []).filter((e) => selected.has(e.id));
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
    // Mexe so nas linhas visiveis; a selecao fora da busca e preservada.
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of rows) {
        if (allShownSelected) next.delete(e.id);
        else next.add(e.id);
      }
      return next;
    });
  };

  const changePayment = async (enrollment: EnrollmentView, paysWithPackage: boolean) => {
    const ok = await confirmAction({
      title: paysWithPackage ? "Pagar com pacote?" : "Pagar com mensalidade?",
      description: paysWithPackage
        ? `Cada presença de ${enrollment.studentName} nesta turma passa a gastar uma aula do pacote. Aulas já dadas não mudam.`
        : `As presenças de ${enrollment.studentName} nesta turma deixam de gastar o pacote. A cobrança segue o plano do aluno.`,
      confirmLabel: paysWithPackage ? "Pagar com pacote" : "Pagar com mensalidade",
      variant: "default",
    });
    if (!ok) return;
    paymentMut.mutate(
      { id: enrollment.id, paysWithPackage },
      {
        onSuccess: () =>
          toast.success(paysWithPackage ? "Agora paga com pacote." : "Agora paga com mensalidade."),
        onError: (err) =>
          toast.error(getErrorMessage(err, "Não foi possível trocar a forma de pagamento.")),
      },
    );
  };

  const cancelOne = async (enrollment: EnrollmentView) => {
    const ok = await confirmAction({
      title: "Cancelar matrícula?",
      description: cancelEnrollmentText(enrollment),
      confirmLabel: "Cancelar matrícula",
      variant: "destructive",
    });
    if (!ok) return;
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
        onError: (err) =>
          toast.error(getErrorMessage(err, "Não foi possível cancelar a matrícula.")),
      },
    );
  };

  const cancelSelected = async () => {
    const batch = selectedRows;
    const done = new Set<Id>();
    let lastError: unknown;
    setBulkPending(true);
    for (const row of batch) {
      try {
        await cancelMut.mutateAsync({ id: row.id });
        done.add(row.id);
      } catch (err) {
        // erro individual nao interrompe o lote; o resumo conta o que passou.
        lastError = err;
      }
    }
    setBulkPending(false);
    setConfirmBulk(false);
    // Tira da selecao so o que foi processado; falhas seguem marcadas.
    setSelected((prev) => {
      const next = new Set(prev);
      for (const rowId of done) next.delete(rowId);
      return next;
    });
    if (done.size > 0) {
      toast.success(
        `${plural(done.size, "matrícula cancelada", "matrículas canceladas")}.`,
      );
    }
    const failed = batch.length - done.size;
    if (failed === 0) setSelecting(false);
    if (failed > 0) {
      toast.error(
        `${plural(failed, "matrícula não foi cancelada", "matrículas não foram canceladas")}. ${getErrorMessage(lastError, "Tente novamente.")}`,
      );
    }
  };

  const isCourse = classBillingMode(turma) === "course";
  const isInactive = turma.status !== "active";
  // Turma desativada e curso terminado nao recebem matricula nova (o servico tambem recusa).
  const canEnroll = canManage && !isInactive && !(isCourse && turma.isEnded);
  const selectedHasCourse = selectedRows.some((e) => e.course && !e.isCompleted);

  // Uma linha de informacao; preco e regras do curso ficam em "Editar turma".
  const billingShort = (() => {
    const mode = classBillingMode(turma);
    if (mode === "course") {
      if (!turma.endDate) return "Curso";
      return `${turma.isEnded ? "Curso encerrado em" : "Curso até"} ${ddmm(turma.endDate)}`;
    }
    if (mode === "package") return "Pacote de aulas";
    if (mode === "free") return "Sem cobrança";
    return turma.planName ? `Plano ${turma.planName}` : null;
  })();
  const isFull = turma.enrolledCount >= turma.capacity;
  const modalityInName = normalizeText(turma.name).includes(normalizeText(turma.modalityName ?? ""));
  const meta = [
    modalityInName ? null : turma.modalityName,
    // Sem encontros diz "Sem horário"; antes de comecar, quando comeca (TUR-28).
    slotsSummary(turma.meetingSlots) || "Sem horário",
    turma.startDate > todayISO() ? `Começa em ${ddmm(turma.startDate)}` : null,
    turma.instructorName,
    billingShort,
    isFull ? "Turma lotada" : `${turma.enrolledCount} de ${turma.capacity} alunos`,
  ].filter((part): part is string => Boolean(part));

  const enrolledCount = (enrollments ?? []).length;
  const waitlistCount = (waitlist ?? []).length;
  // Sem abas quando so ha a lista de alunos: espera e avaliacoes aparecem quando tem algo.
  const showTabs = waitlistCount > 0 || hasAssessments;
  const activeTab: Tab = !showTabs || (tab === "waitlist" && waitlistCount === 0) ? "enrolled" : tab;
  const showSearch = enrolledCount > SEARCH_MIN_STUDENTS;

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const reactivateTurma = async () => {
    const ok = await confirmAction({
      title: "Reativar turma?",
      description: `“${turma.name}” volta a gerar aulas e a aceitar matrícula.`,
      confirmLabel: "Reativar",
    });
    if (!ok) return;
    try {
      await reactivateMut.mutateAsync(turma.id);
      toast.success("Turma reativada.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível reativar a turma."));
    }
  };

  const pageActions: ListItemAction[] = [
    ...(canEditTurma && isInactive
      ? [{ key: "reactivate", label: "Reativar turma", icon: <Power className="size-4" />, onSelect: () => void reactivateTurma() }]
      : []),
    ...(canEditTurma
      ? [{ key: "edit", label: "Editar turma", icon: <Pencil className="size-4" />, onSelect: () => setEditOpen(true) }]
      : []),
    ...(canManage && enrolledCount > 0
      ? [
          {
            key: "select",
            label: "Selecionar alunos",
            icon: <ListChecks className="size-4" />,
            onSelect: () => {
              setTab("enrolled");
              setSelecting(true);
            },
          },
        ]
      : []),
    {
      key: "calendar",
      label: "Ver aulas no calendário",
      icon: <CalendarDays className="size-4" />,
      onSelect: () => router.push(`/classes/calendar?class=${encodeURIComponent(turma.id)}`),
    },
  ];

  // Alerta de pacote de quem paga a aula com ele (turma de pacote ou mensalidade com pacote).
  const packageAlertOf = (e: EnrollmentView): string | null => {
    if (!(isPackageClass || (isMembership && e.paysWithPackage))) return null;
    // Sem os pacotes carregados ainda nao da para dizer "Sem pacote" (piscava).
    if (packagesPending) return null;
    const left = packageLessonsByStudent.get(e.studentId);
    if (left === undefined) return "Sem pacote";
    return left === 1 ? "Última aula do pacote" : null;
  };

  return (
    <>
      {confirmDialog}
      <BackLink fallbackHref="/classes" />

      {/* Cabecalho: nome e uma linha de informacao; o resto no menu */}
      <div className="mb-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{turma.name}</h1>
              {isInactive ? <RecordStatusBadge status={turma.status} /> : null}
            </div>
            {/* Pedacos curtos nao quebram no meio ("3 / de 10 alunos"). */}
            <p className="text-sm text-muted-foreground" data-testid="class-billing-summary">
              {meta.map((part, i) => (
                <Fragment key={`${i}-${part}`}>
                  {i > 0 ? " · " : null}
                  <span className={part.length <= 24 ? "whitespace-nowrap" : undefined}>{part}</span>
                </Fragment>
              ))}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PageActionsMenu label="Mais ações da turma" actions={pageActions} />
            {canEnroll ? (
              <Button className="hidden sm:inline-flex" onClick={() => setEnrollOpen(true)} data-onboarding-cta="enroll">
                <UserPlus className="size-4" />
                Matricular alunos
              </Button>
            ) : null}
          </div>
        </div>
        {canEnroll ? (
          <Button className="w-full sm:hidden" onClick={() => setEnrollOpen(true)} data-onboarding-cta="enroll">
            <UserPlus className="size-4" />
            Matricular alunos
          </Button>
        ) : null}
        {isInactive ? null : <NextSessionLink classGroupId={turma.id} canMark={canMark} />}
      </div>

      <TurmaFormDrawer open={editOpen} onOpenChange={setEditOpen} turma={turma} />
      <PromoteToCourseDialog
        turma={turma}
        entry={promoteCourseEntry}
        onOpenChange={(open) => {
          if (!open) setPromoteCourseEntry(null);
        }}
      />
      <EnrollStudentsDialog
        open={enrollOpen}
        onOpenChange={handleEnrollOpenChange}
        turma={turma}
        enrolledIds={enrolledIds}
        waitlistedIds={waitlistedIds}
        onEnrolled={() => {
          if (enrollCompletesSetup) setCelebrateEnroll(true);
        }}
      />
      <SetupCompleteDialog
        variant="enrolled"
        groupName={turma.name}
        open={celebrateEnroll}
        onOpenChange={setCelebrateEnroll}
        onPrimary={() => {
          setCelebrateEnroll(false);
          router.push("/classes/billing");
        }}
      />

      {showTabs ? (
        <div
          role="tablist"
          aria-label="Seções da turma"
          className="mb-4 inline-flex gap-1 rounded-lg border bg-muted/40 p-1"
        >
          <TabButton
            active={activeTab === "enrolled"}
            count={enrolledCount}
            label="Alunos"
            onClick={() => setTab("enrolled")}
          />
          {waitlistCount > 0 ? (
            <TabButton
              active={activeTab === "waitlist"}
              count={waitlistCount}
              label="Lista de espera"
              onClick={() => {
                stopSelecting();
                setTab("waitlist");
              }}
            />
          ) : null}
          {hasAssessments ? (
            <TabButton
              active={activeTab === "assessments"}
              count={(assessmentsView?.assessments ?? []).length}
              label="Avaliações"
              onClick={() => {
                stopSelecting();
                setTab("assessments");
              }}
            />
          ) : null}
        </div>
      ) : null}

      {activeTab === "enrolled" ? (
        <section role={showTabs ? "tabpanel" : undefined} className="space-y-3">
          {enrollmentsPending ? (
            // A turma chega antes das matriculas: sem isto, "Nenhum aluno" piscava
            // (com um segundo "Matricular alunos") numa turma cheia.
            <div className="space-y-2 rounded-lg border p-4" aria-busy="true">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-5 w-2/5" />
            </div>
          ) : enrolledCount === 0 ? (
            <div className="rounded-lg border">
              <ModuleEmptyGuide
                icon={<GraduationCap className="size-8" />}
                title="Nenhum aluno matriculado ainda."
                description={
                  // A cobranca so aparece quando a turma cobra mensalidade.
                  classBillingMode(turma) === "membership"
                    ? "Matricule os alunos para acompanhar frequência e mensalidades."
                    : "Matricule os alunos para acompanhar a frequência."
                }
                actionLabel={canEnroll ? "Matricular alunos" : undefined}
                onAction={canEnroll ? () => setEnrollOpen(true) : undefined}
              />
            </div>
          ) : (
            <>
              {/* Busca so com turma grande: com poucos alunos ela so ocupa espaco */}
              {showSearch ? (
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  onClear={() => setSearch("")}
                  placeholder="Buscar aluno..."
                  aria-label="Buscar aluno matriculado"
                />
              ) : null}

              {rows.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  Nenhum aluno encontrado para &quot;{search}&quot;.
                </p>
              ) : (
                <ListContainer>
                  {rows.map((e) => {
                    const student = clientById.get(e.studentId);
                    const prog =
                      turma.modalityId && student
                        ? student.progressions?.[turma.modalityId]
                        : undefined;
                    const currentLvl = modalityTrack
                      ? (currentLevelOf(modalityTrack, prog, ageAt(student?.birthDate, todayISO())) ?? null)
                      : null;
                    const currentSub = prog?.subLevel ?? 0;
                    const isBelt = resolveTrackStyle(modalityTrack ?? undefined) === "belt";

                    const certificate: ListItemAction[] = e.isCompleted
                      ? [
                          {
                            key: "certificate",
                            label: hasCertificates ? "Certificado" : "Certificado (Plano Profissional)",
                            icon: hasCertificates ? <Award className="size-4" /> : <Lock className="size-4" />,
                            onSelect: () => router.push(`/classes/${turma.id}/certificate/${e.id}`),
                          },
                        ]
                      : [];
                    const grades: ListItemAction[] =
                      hasAssessments && student
                        ? [
                            {
                              key: "grades",
                              label: "Notas",
                              icon: <ClipboardList className="size-4" />,
                              onSelect: () => setGradesClient(student),
                            },
                          ]
                        : [];
                    // So turma de mensalidade: voltar para a mensalidade sempre;
                    // pagar com pacote so quem tem pacote valido da modalidade.
                    const payment: ListItemAction[] = !isMembership
                      ? []
                      : e.paysWithPackage
                        ? [
                            {
                              key: "pay-membership",
                              label: "Pagar com mensalidade",
                              icon: <Wallet className="size-4" />,
                              onSelect: () => changePayment(e, false),
                            },
                          ]
                        : packageLessonsByStudent.has(e.studentId)
                          ? [
                              {
                                key: "pay-package",
                                label: "Pagar com pacote",
                                icon: <Package className="size-4" />,
                                onSelect: () => changePayment(e, true),
                              },
                            ]
                          : [];
                    const minorConsentAct: ListItemAction[] =
                      student && isMinorConsentPending(student)
                        ? [
                            {
                              key: "minor-consent",
                              label: "Enviar autorização (WhatsApp)",
                              icon: <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />,
                              onSelect: () => {
                                const url = minorConsentUrl(student.id);
                                const guardian = student.guardians?.find((g) => Boolean(g.phone)) || student.guardians?.[0];
                                const targetPhone = guardian?.phone || student.phone;
                                const greeting = guardian?.name ? `, ${guardian.name}` : "";
                                const msg = `Olá${greeting}! Segue o link de autorização de matrícula e LGPD do aluno(a) ${student.name}:\n\n${url}\n\nPor favor, acesse o link para conferir e confirmar pelo celular. Obrigado!`;

                                if (targetPhone) {
                                  const cleanPhone = targetPhone.replace(/\D/g, "");
                                  const phoneWithCountry = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
                                  window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`, "_blank");
                                } else {
                                  if (navigator.clipboard) {
                                    navigator.clipboard.writeText(url);
                                    toast.info("Nenhum telefone de contato encontrado. Link copiado para a área de transferência.");
                                  }
                                }
                              },
                            },
                          ]
                        : [];

                    const actions: ListItemAction[] = canManage
                      ? [
                          ...certificate,
                          ...payment,
                          ...minorConsentAct,
                          ...(student && can("progression:manage")
                            ? [
                                {
                                  key: "records",
                                  label: "Registros de aula",
                                  icon: <MessageSquarePlus className="size-4" />,
                                  onSelect: () => setRecordsClient(student),
                                },
                                {
                                  key: "graduation",
                                  label: vocabulary.levelsTitle,
                                  icon: <GraduationCap className="size-4" />,
                                  onSelect: () => setGraduationClient(student),
                                },
                              ]
                            : []),
                          ...grades,
                          {
                            key: "cancel",
                            label: "Cancelar matrícula",
                            icon: <UserX className="size-4" />,
                            onSelect: () => cancelOne(e),
                            destructive: true,
                          },
                        ]
                      : [...certificate, ...grades];

                    // So o que pede atencao aparece na linha.
                    const alerts = [
                      // Curso encerrado nao pede acao pela presenca.
                      e.attendanceRate !== null && e.attendanceRate < LOW_ATTENDANCE && !(isCourse && turma.isEnded)
                        ? { label: "Presença baixa", warn: false }
                        : null,
                      overdueStudentIds.has(e.studentId) ? { label: "Pagamento atrasado", warn: false } : null,
                      ((label) => (label ? { label, warn: true } : null))(packageAlertOf(e)),
                    ].filter((a): a is { label: string; warn: boolean } => a !== null);

                    const row = (
                      <ListRow
                        key={e.id}
                        onClick={
                          selecting
                            ? () => toggleRow(e.id)
                            : canOpenProfile
                              ? () => router.push(`/clients/${e.studentId}`)
                              : undefined
                        }
                        aria-label={
                          selecting
                            ? `Selecionar ${e.studentName}`
                            : canOpenProfile
                              ? `Abrir ficha de ${e.studentName}`
                              : undefined
                        }
                        actions={
                          selecting || actions.length === 0 ? undefined : (
                            <ListItemActionsMenu
                              title="Mais opções"
                              ariaLabel={`Ações de ${e.studentName}`}
                              variant="ghost"
                              actions={actions}
                            />
                          )
                        }
                      >
                        <div className="flex items-center gap-3">
                          {selecting ? (
                            <Checkbox
                              checked={selected.has(e.id)}
                              onCheckedChange={() => toggleRow(e.id)}
                              onClick={(event) => event.stopPropagation()}
                              aria-label={`Selecionar ${e.studentName}`}
                            />
                          ) : null}
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-sm font-medium text-foreground">{e.studentName}</p>
                            {/* Nivel em texto (faixa mantem a cor) e o que foge do padrao */}
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
                              {isMembership && e.paysWithPackage ? (
                                <span title="Cada presença gasta uma aula do pacote">Pacote</span>
                              ) : null}
                              {e.isCompleted ? (
                                <span className="font-medium text-emerald-700 dark:text-emerald-400">Concluído</span>
                              ) : null}
                              <BirthdayBadge birthDate={student?.birthDate} showUpcoming compact />
                              <MinorConsentBadge client={student} compact />
                              <LevelChangeBadge
                                level={currentLvl}
                                birthDate={student?.birthDate}
                                levelWord={vocabulary.level}
                              />
                            </div>
                            {alerts.length > 0 ? (
                              <p className="flex flex-wrap gap-x-2 pt-0.5 text-xs font-medium">
                                {alerts.map((a) => (
                                  <span
                                    key={a.label}
                                    className={
                                      a.warn ? "text-amber-700 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                                    }
                                  >
                                    {a.label}
                                  </span>
                                ))}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </ListRow>
                    );
                    if (selecting || actions.length === 0) return row;
                    return (
                      <ListItemContextMenu key={e.id} actions={actions}>
                        {row}
                      </ListItemContextMenu>
                    );
                  })}
                </ListContainer>
              )}

              {/* Selecao em lote so quando pedida no menu */}
              {selecting ? (
                <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedRows.length === 0
                        ? "Toque nos alunos"
                        : plural(selectedRows.length, "selecionado", "selecionados")}
                    </span>
                    <Button variant="ghost" onClick={toggleAll}>
                      {allShownSelected ? "Limpar" : "Todos"}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* "Cancelar" ao lado de "Cancelar matrícula" confundia. */}
                    <Button variant="ghost" onClick={stopSelecting}>
                      Sair da seleção
                    </Button>
                    <Button
                      variant="outline"
                      disabled={selectedRows.length === 0}
                      onClick={() => setConfirmBulk(true)}
                    >
                      <UserX className="size-4" />
                      Cancelar matrícula
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {activeTab === "waitlist" ? (
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
                        disabled={promoteMut.isPending}
                        onClick={async () => {
                          if (promoteMut.isPending) return;
                          // Curso: o dialogo pede o pagamento antes de matricular.
                          if (isCourse) {
                            setPromoteCourseEntry(w);
                            return;
                          }
                          const ok = await confirmAction({
                            title: "Promover da lista de espera?",
                            description: `${w.studentName} será matriculado na turma, mesmo que ela esteja lotada.`,
                            confirmLabel: "Matricular",
                          });
                          if (!ok) return;
                          promoteMut.mutate({ id: w.id }, {
                            onSuccess: () =>
                              toast.success("Aluno promovido para matrícula."),
                            onError: (err) =>
                              toast.error(getErrorMessage(err, "Não foi possível promover o aluno.")),
                          });
                        }}
                      >
                        <UserCheck className="size-4" />
                        Promover
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={`Remover ${w.studentName} da lista`}
                        aria-label={`Remover ${w.studentName} da lista`}
                        disabled={removeWaitMut.isPending}
                        onClick={async () => {
                          const ok = await confirmAction({
                            title: "Remover da lista de espera?",
                            description: `${w.studentName} perde a posição ${w.position} na fila.`,
                            confirmLabel: "Remover",
                            variant: "destructive",
                          });
                          if (!ok) return;
                          removeWaitMut.mutate(w.id, {
                            onSuccess: () => toast.success("Aluno removido da lista de espera."),
                            onError: (err) =>
                              toast.error(getErrorMessage(err, "Não foi possível remover da lista de espera.")),
                          });
                        }}
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

      {activeTab === "assessments" && hasAssessments ? (
        <ClassAssessmentsTab turma={turma} track={modalityTrack} />
      ) : null}

      <StudentGradesDialog
        client={gradesClient}
        open={Boolean(gradesClient)}
        onOpenChange={(open) => {
          if (!open) setGradesClient(null);
        }}
        initialModalityId={turma.modalityId}
      />
      <StudentGraduationDialog
        client={graduationClient}
        open={Boolean(graduationClient)}
        onOpenChange={(open) => {
          if (!open) setGraduationClient(null);
        }}
        initialModalityId={turma?.modalityId}
      />
      <StudentRecordsDialog
        client={recordsClient}
        open={Boolean(recordsClient)}
        onOpenChange={(open) => {
          if (!open) setRecordsClient(null);
        }}
        context={turma ? { date: todayISO(), modalityId: turma.modalityId } : undefined}
      />

      <AlertDialog
        open={confirmBulk}
        onOpenChange={(open) => {
          if (!bulkPending) setConfirmBulk(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancelar {plural(selectedRows.length, "matrícula", "matrículas")}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os alunos saem da turma e deixam de contar nas vagas. O histórico
              de presença é mantido.
              {selectedHasCourse
                ? " No curso, as parcelas pagas ficam e as futuras são canceladas."
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={bulkPending || selectedRows.length === 0}
              onClick={(event) => {
                // Mantem o dialogo aberto ate o lote terminar.
                event.preventDefault();
                void cancelSelected();
              }}
            >
              {bulkPending
                ? "Cancelando..."
                : `Cancelar ${pluralWord(selectedRows.length, "matrícula", "matrículas")}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
