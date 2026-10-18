"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarCheck,
  ChevronLeft,
  GraduationCap,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Power,
  PowerOff,
  Receipt,
  Ticket,
  TrendingUp,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { BeltBadge } from "@/components/shared/belt-badge";
import { BirthdayBadge } from "@/components/shared/birthday-badge";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { InitialsAvatar, RecordStatusBadge } from "@/components/shared/list";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { todayISO } from "@gestarahub/core/date";
import { formatCents, formatPhone, plural } from "@gestarahub/core/format";
import { isApiError, type Id, type StudentSummary } from "@gestarahub/contracts";
import { useCan, useModel } from "@/features/auth";
import { useCategories } from "@/features/categories";
import { StudentMessagesPanel } from "@/features/communication";
import { StudentGradesDialog } from "@/features/grades";
import {
  NewExtraChargeDialog,
  SellPackageDialog,
  StudentChargesPanel,
  StudentPackageBadge,
  StudentPackagesPanel,
  displayPackage,
} from "@/features/turmas";
import { useStudentSummary, useUpdateClient } from "../hooks/use-clients";
import { ClientFormDialog } from "./client-form-dialog";
import { InactivateClientDialog } from "./inactivate-client-dialog";
import { StudentGraduationDialog } from "./student-graduation-dialog";
import { StudentRecordsDialog } from "./student-records-dialog";
import { StudentDataTab } from "./student-data-tab";
import { StudentEnrollmentsTab } from "./student-enrollments-tab";
import { StudentEvolutionTab } from "./student-evolution-tab";
import { brDate, KpiCard, MembershipChip } from "./student-profile-parts";

type ProfileTab = "classes" | "charges" | "packages" | "evolution" | "messages" | "data";

const TABS: { value: ProfileTab; label: string; icon: LucideIcon }[] = [
  { value: "classes", label: "Turmas e cursos", icon: GraduationCap },
  { value: "charges", label: "Cobranças", icon: Receipt },
  { value: "packages", label: "Pacotes", icon: Ticket },
  { value: "evolution", label: "Evolução", icon: TrendingUp },
  { value: "messages", label: "Mensagens", icon: MessageCircle },
  { value: "data", label: "Dados", icon: UserRound },
];

/** Aba na URL (`?tab=`); a primeira visivel fica fora dela. */
function useProfileTab(visible: ProfileTab[]): [ProfileTab, (tab: ProfileTab) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const param = searchParams.get("tab");
  const fallback = visible[0] ?? "data";
  const tab = visible.find((t) => t === param) ?? fallback;
  const setTab = (next: ProfileTab) => {
    const params = new URLSearchParams(window.location.search);
    if (next === fallback) params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  return [tab, setTab];
}

function isApiNotFound(error: unknown): boolean {
  return isApiError(error) && error.code === "NOT_FOUND";
}

/** "(11) 97777-0000 · 15 anos · Aluno desde 01/09/2026". */
function headerFacts(summary: StudentSummary, isClasses: boolean): string {
  const { student } = summary;
  return [
    student.phone ? formatPhone(student.phone) : null,
    summary.age !== null ? `${summary.age} anos` : null,
    `${isClasses ? "Aluno" : "Cliente"} desde ${brDate(summary.studentSince)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function StudentKpis({ summary, showMoney }: { summary: StudentSummary; showMoney: boolean }) {
  const { openBalance, attendance30d } = summary;
  const level = summary.levels[0];
  const pkg = displayPackage(summary.packages);
  const rate = attendance30d.rate === null ? null : Math.round(attendance30d.rate * 100);
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {showMoney ? (
        <KpiCard
          label="Em aberto"
          icon={<Wallet className="size-4" />}
          tone={openBalance.overdueCount > 0 ? "danger" : "default"}
          sub={
            openBalance.overdueCount > 0
              ? `${formatCents(openBalance.overdueCents)} em atraso`
              : openBalance.count > 0
                ? plural(openBalance.count, "cobrança", "cobranças")
                : "Nada em aberto"
          }
        >
          <div
            className={cn(
              "text-xl font-bold tabular-nums sm:text-2xl",
              openBalance.overdueCount > 0 ? "text-red-600 dark:text-red-400" : "text-foreground",
            )}
          >
            {formatCents(openBalance.totalCents)}
          </div>
        </KpiCard>
      ) : null}
      <KpiCard
        label="Frequência 30 dias"
        icon={<CalendarCheck className="size-4" />}
        sub={
          rate === null
            ? "Sem chamada no período"
            : `${plural(attendance30d.present, "presença", "presenças")} · ${plural(attendance30d.absent, "falta", "faltas")}`
        }
      >
        <div className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">
          {rate === null ? "—" : `${rate}%`}
        </div>
      </KpiCard>
      {level ? (
        <KpiCard
          label={`${level.words.level} atual`}
          icon={<TrendingUp className="size-4" />}
          sub={summary.levels.length > 1 ? `${level.modalityName} · +${summary.levels.length - 1}` : level.modalityName}
        >
          <BeltBadge
            name={level.levelName}
            color={level.levelColor}
            variant={level.trackStyle}
            subLevel={level.subLevel}
            maxSubLevels={level.maxSubLevels}
            size="md"
          />
        </KpiCard>
      ) : null}
      {pkg ? (
        <KpiCard
          label="Pacote"
          icon={<Ticket className="size-4" />}
          sub={[
            pkg.name,
            pkg.expiresAt ? `${pkg.isExpired ? "venceu" : "vale até"} ${brDate(pkg.expiresAt)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          <div className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">
            {plural(pkg.remaining, "aula", "aulas")}
          </div>
        </KpiCard>
      ) : null}
    </div>
  );
}

/**
 * Ficha do aluno (`/clients/[id]`, doc 22 item 2): resumo no topo e abas com
 * turmas, cobrancas, pacotes, evolucao, mensagens e dados. Le o "resumo do
 * aluno" (a mesma leitura que a API vai expor) e reusa os dialogos de Alunos.
 */
export function StudentProfileView({ id }: { id: Id }) {
  const isClasses = useModel() === "classes";
  const can = useCan();
  const canManage = can("clients:manage");
  const canSeeBilling = isClasses && can("billing:view");
  const canCharge = isClasses && can("billing:manage");
  const canSeeMessages = can("communication:view");
  const { data: summary, isPending, isError, error, refetch } = useStudentSummary(id);

  const visibleTabs = TABS.map((t) => t.value).filter((t) => {
    if (t === "classes" || t === "evolution") return isClasses;
    if (t === "charges" || t === "packages") return canSeeBilling;
    if (t === "messages") return canSeeMessages;
    return true;
  });
  const [tab, setTab] = useProfileTab(visibleTabs);

  const [editOpen, setEditOpen] = useState(false);
  const [inactivateOpen, setInactivateOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [sellState, setSellState] = useState<{ open: boolean; packageId?: Id }>({ open: false });
  const [levelsModality, setLevelsModality] = useState<Id | null>(null);
  const [gradesModality, setGradesModality] = useState<Id | null>(null);
  const { data: categories } = useCategories();
  const gradedModalityIds = new Set(
    (categories ?? []).filter((c) => c.assessments?.enabled).map((c) => c.id),
  );
  const [recordsModality, setRecordsModality] = useState<Id | null>(null);
  const updateMut = useUpdateClient();
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  const listLabel = isClasses ? "Alunos" : "Clientes";

  const backLink = (
    <Button asChild variant="ghost" className="mb-2 -ml-2">
      <Link href="/clients">
        <ChevronLeft className="size-4" />
        {listLabel}
      </Link>
    </Button>
  );

  if (isPending) {
    return (
      <>
        {backLink}
        <div className="mb-6 flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
      </>
    );
  }

  if (!summary) {
    const notFound = isApiNotFound(error) || !isError;
    return (
      <div className="rounded-lg border">
        <ModuleEmptyGuide
          icon={<AlertCircle className="size-8" />}
          title={notFound ? `${isClasses ? "Aluno" : "Cliente"} não encontrado` : "Não foi possível carregar a ficha"}
          description={
            notFound
              ? "O cadastro pode ter sido removido ou o link está incorreto."
              : getErrorMessage(error, "Tente novamente em instantes.")
          }
          actionLabel={notFound ? undefined : "Tentar novamente"}
          onAction={notFound ? undefined : () => void refetch()}
        />
        <div className="flex justify-center pb-6">
          <Button asChild variant="outline">
            <Link href="/clients">
              <ChevronLeft className="size-4" />
              {listLabel}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const { student } = summary;
  const isActive = student.status === "active";
  const pkg = displayPackage(summary.packages);
  const hasActiveCourse = summary.enrollments.some((e) => e.course && e.state === "active");

  async function reactivate() {
    const ok = await confirm({
      title: `Reativar ${isClasses ? "aluno" : "cliente"}?`,
      description: `“${student.name}” volta a aparecer em ${isClasses ? "novas matrículas" : "novos agendamentos"}.`,
      confirmLabel: "Reativar",
    });
    if (!ok) return;
    try {
      await updateMut.mutateAsync({ id: student.id, payload: { status: "active" } });
      toast.success(isClasses ? "Aluno reativado." : "Cliente reativado.");
    } catch (err) {
      toast.error(getErrorMessage(err, isClasses ? "Não foi possível reativar o aluno." : "Não foi possível reativar o cliente."));
    }
  }

  const moneyActions = canCharge && isActive;
  const hasMoreActions = moneyActions || canManage;

  return (
    <>
      {confirmDialog}
      {backLink}

      {/* Topo: quem e o aluno + acoes (Editar e Mais acoes a direita) */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <InitialsAvatar name={student.name} className="size-14 text-base" />
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight break-words">{student.name}</h1>
              <RecordStatusBadge status={student.status} />
              <BirthdayBadge birthDate={student.birthDate} showUpcoming />
            </div>
            <p className="text-sm text-muted-foreground">{headerFacts(summary, isClasses)}</p>
            {isClasses ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <MembershipChip membership={summary.membership} showEmpty={!pkg && !hasActiveCourse} />
                {pkg ? <StudentPackageBadge pkg={pkg} /> : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canManage ? (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Editar
            </Button>
          ) : null}
          {hasMoreActions ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" aria-label="Mais ações">
                  <MoreHorizontal className="size-4" />
                  <span className="hidden sm:inline">Mais ações</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {moneyActions ? (
                  <>
                    <DropdownMenuItem onSelect={() => setChargeOpen(true)}>
                      <Receipt className="size-4" />
                      Nova cobrança
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setSellState({ open: true })}>
                      <Ticket className="size-4" />
                      Vender pacote
                    </DropdownMenuItem>
                  </>
                ) : null}
                {canManage ? (
                  <>
                    {moneyActions ? <DropdownMenuSeparator /> : null}
                    {isActive ? (
                      <DropdownMenuItem variant="destructive" onSelect={() => setInactivateOpen(true)}>
                        <PowerOff className="size-4" />
                        Inativar
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onSelect={() => void reactivate()}>
                        <Power className="size-4" />
                        Reativar
                      </DropdownMenuItem>
                    )}
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {isClasses ? <StudentKpis summary={summary} showMoney={canSeeBilling} /> : null}

      <div
        role="tablist"
        aria-label="Seções da ficha"
        className="mb-4 flex max-w-full gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1 sm:inline-flex"
      >
        {TABS.filter((t) => visibleTabs.includes(t.value)).map((t) => {
          const active = t.value === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              id={`student-tab-${t.value}`}
              aria-selected={active}
              aria-controls={`student-panel-${t.value}`}
              onClick={() => setTab(t.value)}
              className={cn(
                "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                active ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`student-panel-${tab}`} aria-labelledby={`student-tab-${tab}`} className="min-w-0">
        {tab === "classes" ? <StudentEnrollmentsTab enrollments={summary.enrollments} /> : null}
        {tab === "charges" ? <StudentChargesPanel studentId={student.id} /> : null}
        {tab === "packages" ? (
          <StudentPackagesPanel
            studentId={student.id}
            canManage={canCharge}
            onSell={moneyActions ? (packageId) => setSellState({ open: true, packageId }) : undefined}
          />
        ) : null}
        {tab === "evolution" ? (
          <StudentEvolutionTab
            levels={summary.levels}
            canManage={canManage}
            onOpenRecords={setRecordsModality}
            onOpenLevels={setLevelsModality}
            gradedModalityIds={gradedModalityIds}
            onOpenGrades={setGradesModality}
          />
        ) : null}
        {tab === "messages" ? (
          <StudentMessagesPanel
            student={{ id: student.id, name: student.name, phone: student.phone }}
            canSend={canSeeMessages}
          />
        ) : null}
        {tab === "data" ? (
          <StudentDataTab
            summary={summary}
            isClasses={isClasses}
            onEdit={canManage ? () => setEditOpen(true) : undefined}
          />
        ) : null}
      </div>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={student} />
      <InactivateClientDialog
        client={inactivateOpen ? student : null}
        onOpenChange={(open) => {
          if (!open) setInactivateOpen(false);
        }}
      />
      {isClasses ? (
        <>
          <NewExtraChargeDialog open={chargeOpen} onOpenChange={setChargeOpen} student={student} />
          <SellPackageDialog
            open={sellState.open}
            onOpenChange={(open) => {
              if (!open) setSellState((s) => ({ ...s, open: false }));
            }}
            student={student}
            initialPackageId={sellState.packageId}
          />
          <StudentGraduationDialog
            client={student}
            open={Boolean(levelsModality)}
            onOpenChange={(open) => {
              if (!open) setLevelsModality(null);
            }}
            initialModalityId={levelsModality ?? undefined}
          />
          <StudentGradesDialog
            client={student}
            open={Boolean(gradesModality)}
            onOpenChange={(open) => {
              if (!open) setGradesModality(null);
            }}
            initialModalityId={gradesModality ?? undefined}
          />
          <StudentRecordsDialog
            client={student}
            open={Boolean(recordsModality)}
            onOpenChange={(open) => {
              if (!open) setRecordsModality(null);
            }}
            context={{ date: todayISO(), modalityId: recordsModality ?? undefined }}
          />
        </>
      ) : null}
    </>
  );
}
