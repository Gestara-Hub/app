"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Pencil,
  Power,
  PowerOff,
  Receipt,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { BackLink } from "@/components/shared/back-link";
import { InitialsAvatar, RecordStatusBadge } from "@/components/shared/list";
import { PausedTag } from "./paused-tag";
import type { ListItemAction } from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { PageActionsMenu } from "@/components/shared/page-actions-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { whatsappNumber } from "@/lib/whatsapp";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { nowTime, todayISO } from "@gestarahub/core/date";
import { formatCents, formatDateTime, formatPhone, plural } from "@gestarahub/core/format";
import {
  isApiError,
  type ClassSessionView,
  type Id,
  type StudentSummary,
  type StudentSummaryEnrollment,
} from "@gestarahub/contracts";
import { useCan, useModel } from "@/features/auth";
import { useCategories } from "@/features/categories";
import { SendMessageDialog, StudentMessagesPanel } from "@/features/communication";
import { StudentGradesDialog } from "@/features/grades";
import { useOrganization } from "@/features/settings";
import {
  NewExtraChargeDialog,
  SellPackageDialog,
  StudentChargesPanel,
  displayPackage,
  pickNextSession,
  useClassSessions,
} from "@/features/turmas";
import { useStudentSummary, useUpdateClient } from "../hooks/use-clients";
import { ClientFormDrawer } from "./client-form-drawer";
import { InactivateClientDialog } from "./inactivate-client-dialog";
import { StudentGraduationDialog } from "./student-graduation-dialog";
import { StudentRecordsDialog } from "./student-records-dialog";
import { StudentDataTab } from "./student-data-tab";
import { StudentPlanPanel } from "./student-plan-panel";
import { StudentEnrollmentsTab } from "./student-enrollments-tab";
import { StudentEvolutionTab } from "./student-evolution-tab";
import { StudentProfileAlerts } from "./student-profile-alerts";
import { brDate, PERIOD_SHORT } from "./student-profile-parts";
import { levelWithSubLevel } from "@/lib/progression-tracks";
import { ageLabel } from "@/lib/birthdays";
import { minorConsentUrl } from "@/lib/minor-consent-link";

type ProfileSectionId = "classes" | "plan" | "charges" | "evolution" | "messages" | "data";

const SECTION_IDS: ProfileSectionId[] = ["classes", "plan", "charges", "evolution", "messages", "data"];

/** `?tab=packages` (link antigo) abre "Plano e pacotes", que juntou os pacotes e o plano. */
const LEGACY_SECTION: Record<string, ProfileSectionId> = { packages: "plan" };

function isApiNotFound(error: unknown): boolean {
  return isApiError(error) && error.code === "NOT_FOUND";
}

/** "(11) 97777-0000 · 15 anos · Aluno desde 01/09/2026". */
function headerFacts(summary: StudentSummary, isClasses: boolean): string {
  const { student } = summary;
  return [
    student.phone ? formatPhone(student.phone) : null,
    summary.age !== null ? ageLabel(summary.age) : null,
    `${isClasses ? "Aluno" : "Cliente"} desde ${brDate(summary.studentSince)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "hoje, 19:00" ou "qua, 22/10, 19:00". */
function sessionWhen(session: ClassSessionView, today: string): string {
  if (session.date === today) return `hoje, ${session.start}`;
  return `${format(parseISO(session.date), "EEE, dd/MM", { locale: ptBR }).replace(".", "")}, ${session.start}`;
}

/** Proxima aula do aluno nas turmas em que esta matriculado (proximos 14 dias). */
function useStudentNextSession(enrollments: StudentSummaryEnrollment[]): ClassSessionView | null {
  const today = todayISO();
  const { data: sessions } = useClassSessions({
    dateFrom: today,
    dateTo: format(addDays(parseISO(today), 13), "yyyy-MM-dd"),
  });
  const ids = new Set(enrollments.filter((e) => e.state === "active").map((e) => e.classGroupId));
  if (ids.size === 0) return null;
  return pickNextSession((sessions ?? []).filter((s) => ids.has(s.classGroupId)), today, nowTime());
}

function ClassesSummary({ enrollments }: { enrollments: StudentSummaryEnrollment[] }) {
  const next = useStudentNextSession(enrollments);
  const active = enrollments.filter((e) => e.state === "active").length;
  if (active === 0) return <>{enrollments.length > 0 ? "Nenhuma turma ativa" : "Nenhuma turma"}</>;
  return (
    <>
      {plural(active, "turma", "turmas")}
      {next ? ` · próxima ${sessionWhen(next, todayISO())}` : ""}
    </>
  );
}

/** Atalho para a proxima aula (a mesma barra da tela da turma). */
function NextSessionBar({ enrollments }: { enrollments: StudentSummaryEnrollment[] }) {
  const next = useStudentNextSession(enrollments);
  if (!next) return null;
  const when = sessionWhen(next, todayISO());
  return (
    <Link
      href={`/classes/sessions/${encodeURIComponent(next.id)}`}
      className="flex w-full items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
    >
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-muted-foreground">Próxima aula</span>
        <span className="tabular-nums text-foreground">
          {when.charAt(0).toUpperCase()}
          {when.slice(1)} · {next.className}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0" />
    </Link>
  );
}

/** Uma linha da sanfona: titulo, resumo de uma linha e o conteudo ao abrir. */
function ProfileSection({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  id: ProfileSectionId;
  title: string;
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div id={`student-section-${id}`} className="scroll-mt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`student-panel-${id}`}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">{title}</span>
          <span className="block text-xs text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div id={`student-panel-${id}`} className="min-w-0 px-4 pb-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Ficha do aluno (`/clients/[id]`, doc 22 item 2, doc 07 §1.8): nome no topo,
 * avisos do que pede acao e uma sanfona com turmas, plano e pacotes,
 * cobrancas, evolucao, mensagens e cadastro (cada linha com um resumo; abre ali mesmo).
 * Le o "resumo do aluno" (a mesma leitura que a API vai expor) e reusa os
 * paineis e dialogos de Alunos.
 */
export function StudentProfileView({ id }: { id: Id }) {
  const isClasses = useModel() === "classes";
  const can = useCan();
  const canManage = can("clients:manage");
  const canSeeBilling = isClasses && can("billing:view");
  const canCharge = isClasses && can("billing:manage");
  const canSeeMessages = can("communication:view");
  const { data: summary, isPending, isError, error, refetch } = useStudentSummary(id);

  // `?tab=` (links antigos e de outras telas) abre aquela secao.
  const searchParams = useSearchParams();
  const [openSections, setOpenSections] = useState<Set<ProfileSectionId>>(() => {
    const raw = searchParams.get("tab");
    const param = (raw && LEGACY_SECTION[raw]) ?? raw;
    return new Set(SECTION_IDS.filter((s) => s === param));
  });
  const toggleSection = (section: ProfileSectionId) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  const openSection = (section: ProfileSectionId) => {
    setOpenSections((prev) => new Set(prev).add(section));
    requestAnimationFrame(() =>
      document.getElementById(`student-section-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const [editOpen, setEditOpen] = useState(false);
  const [inactivateOpen, setInactivateOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [sellState, setSellState] = useState<{ open: boolean; packageId?: Id }>({ open: false });
  const [levelsModality, setLevelsModality] = useState<Id | null>(null);
  const [gradesModality, setGradesModality] = useState<Id | null>(null);
  const { data: categories } = useCategories();
  const gradedModalityIds = new Set(
    (categories ?? []).filter((c) => c.assessments?.enabled).map((c) => c.id),
  );
  const [recordsModality, setRecordsModality] = useState<Id | null>(null);
  const { data: organization } = useOrganization();
  const updateMut = useUpdateClient();
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  const listLabel = isClasses ? "Alunos" : "Clientes";

  // Volta para a tela de onde veio (turma, aula, cobranças...); aberta direto, para a lista.
  const backLink = <BackLink fallbackHref="/clients" />;

  if (isPending) {
    return (
      <>
        {backLink}
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-7 w-56 max-w-full" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
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
  const hasWhatsApp = canSeeMessages && Boolean(whatsappNumber(student.phone));

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
  const isMinor =
    (summary.age !== null && summary.age < 18) ||
    student.minorConsentStatus === "pending";

  const handleSendConsentWhatsApp = () => {
    const url = minorConsentUrl(student.id);
    const guardian = student.guardians?.find((g) => Boolean(g.phone)) || student.guardians?.[0];
    const targetPhone = guardian?.phone || student.phone;
    const greeting = guardian?.name ? `, ${guardian.name}` : "";
    const orgName = organization?.name || "nossa escola";
    const msg = `Olá${greeting}! Segue o link de autorização de matrícula e LGPD do aluno(a) ${student.name} na ${orgName}:\n\n${url}\n\nPor favor, acesse o link para conferir e confirmar pelo celular. Obrigado!`;

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
  };

  const pageActions: ListItemAction[] = [
    ...(canManage
      ? [{ key: "edit", label: "Editar cadastro", icon: <Pencil className="size-4" />, onSelect: () => setEditOpen(true) }]
      : []),
    ...(hasWhatsApp
      ? [
          {
            key: "whatsapp",
            label: "Enviar WhatsApp",
            icon: <MessageCircle className="size-4" />,
            onSelect: () => setMessageOpen(true),
          },
        ]
      : []),
    ...(isMinor
      ? [
          {
            key: "minor-consent",
            label: "Enviar autorização (WhatsApp)",
            icon: <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />,
            onSelect: handleSendConsentWhatsApp,
          },
        ]
      : []),
    ...(moneyActions
      ? [
          { key: "charge", label: "Nova cobrança", icon: <Receipt className="size-4" />, onSelect: () => setChargeOpen(true) },
          {
            key: "package",
            label: "Vender pacote",
            icon: <Ticket className="size-4" />,
            onSelect: () => setSellState({ open: true }),
          },
        ]
      : []),
    ...(canManage
      ? [
          isActive
            ? {
                key: "inactivate",
                label: "Inativar",
                icon: <PowerOff className="size-4" />,
                destructive: true,
                onSelect: () => setInactivateOpen(true),
              }
            : {
                key: "reactivate",
                label: "Reativar",
                icon: <Power className="size-4" />,
                onSelect: () => void reactivate(),
              },
        ]
      : []),
  ];

  // Resumos de uma linha de cada secao.
  const { openBalance } = summary;
  const chargesSummary =
    openBalance.count === 0 ? (
      "Nada em aberto"
    ) : (
      <>
        {openBalance.count} em aberto · {formatCents(openBalance.totalCents)}
        {openBalance.overdueCount > 0 ? (
          <span className="font-medium text-red-600 dark:text-red-400">
            {" "}
            · {plural(openBalance.overdueCount, "atrasada", "atrasadas")}
          </span>
        ) : null}
      </>
    );
  const level = summary.levels[0];
  const lastRecordDate = summary.levels
    .flatMap((l) => l.lastRecords.map((r) => r.date))
    .sort()
    .at(-1);
  const evolutionSummary = level
    ? [
        `${levelWithSubLevel(level.levelName, level.subLevel, level.trackStyle)}${summary.levels.length > 1 ? ` · +${summary.levels.length - 1}` : ""}`,
        lastRecordDate ? `último registro ${brDate(lastRecordDate).slice(0, 5)}` : "sem registros",
      ].join(" · ")
    : "Sem trilha de evolução";
  const lastMessage = summary.lastMessages[0];

  // "Plano e pacotes": o plano (ou a bolsa) e o pacote em uso no resumo, em destaque.
  const { membership } = summary;
  const usablePackages = summary.packages.filter((p) => p.status === "active" && !p.isExpired && p.remaining > 0);
  const totalRemaining = usablePackages.reduce((sum, p) => sum + p.remaining, 0);
  const packagesPart =
    usablePackages.length > 1
      ? `${usablePackages.length} pacotes em uso · ${plural(totalRemaining, "aula restante", "aulas restantes")}`
      : pkg
        ? `${pkg.name} · ${plural(pkg.remaining, "aula restante", "aulas restantes")}`
        : null;
  const scholarshipPart = membership.scholarship
    ? membership.scholarship.full
      ? "bolsista integral"
      : `bolsa ${membership.scholarship.percent}%`
    : null;
  const membershipPart =
    membership.planId && membership.planName
      ? [
          membership.planName,
          membership.status === "paused" ? "trancada" : membership.status === "canceled" ? "cancelada" : null,
          scholarshipPart,
          membership.priceCents !== undefined
            ? `${formatCents(membership.priceCents)}/${PERIOD_SHORT[membership.planPeriod ?? "monthly"]}`
            : null,
          membership.dueDay && membership.status === "active" ? `vence dia ${membership.dueDay}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : membership.scholarship?.full
        ? "Bolsista integral"
        : null;
  const planSummary =
    membershipPart && usablePackages.length > 0 ? (
      <span className="text-foreground">
        {membershipPart} · {plural(usablePackages.length, "pacote em uso", "pacotes em uso")}
      </span>
    ) : membershipPart || packagesPart ? (
      <span className="text-foreground">{membershipPart ?? packagesPart}</span>
    ) : (
      "Sem mensalidade"
    );

  const sections: { id: ProfileSectionId; title: string; summary: ReactNode; content: ReactNode }[] = [
    ...(isClasses
      ? [
          {
            id: "classes" as const,
            title: "Turmas",
            summary: <ClassesSummary enrollments={summary.enrollments} />,
            content: (
              <div className="space-y-3">
                <NextSessionBar enrollments={summary.enrollments} />
                <StudentEnrollmentsTab enrollments={summary.enrollments} />
              </div>
            ),
          },
        ]
      : []),
    ...(canSeeBilling
      ? [
          {
            id: "plan" as const,
            title: "Plano e pacotes",
            summary: planSummary,
            content: (
              <StudentPlanPanel
                summary={summary}
                onEditPlan={canManage ? () => setEditOpen(true) : undefined}
                canManagePackages={canCharge}
                onSellPackage={moneyActions ? (packageId) => setSellState({ open: true, packageId }) : undefined}
              />
            ),
          },
          {
            id: "charges" as const,
            title: "Cobranças",
            summary: chargesSummary,
            content: <StudentChargesPanel studentId={student.id} />,
          },
        ]
      : []),
    ...(isClasses
      ? [
          {
            id: "evolution" as const,
            title: "Evolução",
            summary: evolutionSummary,
            content: (
              <StudentEvolutionTab
                levels={summary.levels}
                inAnyClass={summary.enrollments.some((e) => e.state === "active" || e.state === "paused")}
                canManage={can("progression:manage")}
                onOpenRecords={setRecordsModality}
                onOpenLevels={setLevelsModality}
                gradedModalityIds={gradedModalityIds}
                onOpenGrades={setGradesModality}
              />
            ),
          },
        ]
      : []),
    ...(canSeeMessages
      ? [
          {
            id: "messages" as const,
            title: "Mensagens",
            summary: lastMessage ? `Última em ${formatDateTime(lastMessage.sentAt)}` : "Nenhuma mensagem",
            content: (
              <StudentMessagesPanel
                student={{ id: student.id, name: student.name, phone: student.phone }}
                canSend={canSeeMessages}
              />
            ),
          },
        ]
      : []),
    {
      id: "data",
      title: "Cadastro",
      summary: headerFacts(summary, isClasses),
      content: (
        <StudentDataTab
          summary={summary}
          isClasses={isClasses}
          onEdit={canManage ? () => setEditOpen(true) : undefined}
        />
      ),
    },
  ];

  return (
    <>
      {confirmDialog}
      {backLink}

      {/* Topo: so nome e situacao; o plano fica em "Plano e pacotes", contato e idade no Cadastro */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <InitialsAvatar name={student.name} className="size-12 text-sm" />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{student.name}</h1>
            <RecordStatusBadge status={student.status} />
            {student.status === "active" && student.membershipStatus === "paused" ? <PausedTag /> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canManage ? (
            <Button variant="outline" className="hidden sm:inline-flex" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Editar
            </Button>
          ) : null}
          <PageActionsMenu label={`Mais ações ${isClasses ? "do aluno" : "do cliente"}`} actions={pageActions} />
        </div>
      </div>

      <StudentProfileAlerts
        summary={summary}
        isClasses={isClasses}
        canSeeBilling={canSeeBilling}
        canMessage={canSeeMessages}
        onOpenCharges={() => openSection("charges")}
        onSellPackage={moneyActions ? (packageId) => setSellState({ open: true, packageId }) : undefined}
      />

      <div className="divide-y rounded-xl border">
        {sections.map((section) => (
          <ProfileSection
            key={section.id}
            id={section.id}
            title={section.title}
            summary={section.summary}
            open={openSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
          >
            {section.content}
          </ProfileSection>
        ))}
      </div>

      <ClientFormDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        client={student}
      />
      <InactivateClientDialog
        client={inactivateOpen ? student : null}
        onOpenChange={(open) => {
          if (!open) setInactivateOpen(false);
        }}
      />
      <SendMessageDialog
        open={messageOpen}
        onOpenChange={setMessageOpen}
        recipient={{ id: student.id, name: student.name, phone: student.phone }}
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
