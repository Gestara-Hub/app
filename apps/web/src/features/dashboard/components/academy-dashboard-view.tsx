"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  CheckCheck,
  ClipboardCheck,
  GraduationCap,
  Plus,
  RotateCw,
  Smartphone,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { ScrollCueArea } from "@/components/shared/scroll-cue-area";
import { useIsClient } from "@/lib/use-is-client";
import { cn } from "@/lib/utils";
import { monthlyRevenueSummary } from "../revenue-summary";
import { formatCents, plural } from "@gestarahub/core/format";
import { todayISO, dateInSpace } from "@gestarahub/core/date";
import {
  useAttendanceSummary,
  useCharges,
  useClassGroups,
  useClassSessions,
} from "@/features/turmas";
import { Onboarding } from "@/features/onboarding";
import { useCan, useCurrentUser } from "@/features/auth";
import { useSubscription } from "@/features/settings";
import { useWhatsAppConnection } from "@/features/communication";
import { UpcomingEventsCard } from "@/features/events";
import { BirthdaysCard } from "./birthdays-card";
import { DashboardTodo } from "./dashboard-todo";
import { useBellAlerts } from "./reminders-bell";

function Kpi({
  icon,
  iconColor = "bg-primary/10 text-primary",
  label,
  value,
  hint,
  badge,
  href,
}: {
  icon: ReactNode;
  iconColor?: string;
  label: string;
  value: string;
  hint?: ReactNode;
  badge?: ReactNode;
  href?: string;
}) {
  const content = (
    <div className="flex flex-col gap-2 p-3.5 sm:px-4 sm:py-3.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {badge}
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            iconColor,
          )}
        >
          {icon}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold tracking-tight text-foreground tabular-nums sm:text-2xl">
          {value}
        </p>
        {hint ? (
          <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {hint}
          </div>
        ) : null}
      </div>
    </div>
  );

  const cardClasses = cn(
    "rounded-xl border bg-card text-card-foreground shadow-xs transition-all",
    href && "hover:border-foreground/25 hover:shadow-xs cursor-pointer",
  );

  if (href) {
    return (
      <div data-slot="card" className={cardClasses}>
        <Link href={href} className="block">
          {content}
        </Link>
      </div>
    );
  }

  return (
    <div data-slot="card" className={cardClasses}>
      {content}
    </div>
  );
}

/** Dados do dashboard da academia (consultas + derivados), usados pelos blocos. */
function useAcademyDashboard() {
  // A data de "hoje" vem do relogio do usuario: so no client (sem erro de hidratacao).
  const isClient = useIsClient();
  const todayDate = todayISO();
  const currentCompetence = dateInSpace(todayDate).slice(0, 7);

  const sessionsQuery = useClassSessions({
    dateFrom: todayDate,
    dateTo: todayDate,
  });
  const groupsQuery = useClassGroups();
  // So mensalidades: aula avulsa nao entra em "Mensalidades recebidas".
  const chargesQuery = useCharges({ competence: currentCompetence, kind: "membership" });
  const attendanceQuery = useAttendanceSummary(todayDate);

  const sessions = sessionsQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const charges = chargesQuery.data ?? [];
  const attendance = attendanceQuery.data ?? {
    present: 0,
    absent: 0,
    justified: 0,
    total: 0,
  };

  const activeGroups = groups.filter((g) => g.status === "active");
  const totalCapacity = activeGroups.reduce((sum, g) => sum + g.capacity, 0);
  const totalEnrolled = activeGroups.reduce((sum, g) => sum + g.enrolledCount, 0);
  const overallOccupancyPct =
    totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

  // Status das aulas de hoje
  const completedSessions = sessions.filter((s) => s.status === "done").length;
  const scheduledSessions = sessions.filter((s) => s.status === "scheduled").length;
  const canceledSessions = sessions.filter((s) => s.status === "canceled").length;
  const sessionsHint = [
    completedSessions > 0 ? plural(completedSessions, "concluída", "concluídas") : null,
    scheduledSessions > 0 ? plural(scheduledSessions, "agendada", "agendadas") : null,
    canceledSessions > 0 ? plural(canceledSessions, "cancelada", "canceladas") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const upcomingSessions = [...sessions].sort((a, b) => a.start.localeCompare(b.start));

  // Financeiro do mês: selo, valor e texto do mesmo recorte (achado 2).
  const { paidRevenue, overdueRevenue, overdueCount, revenueHint } = monthlyRevenueSummary(charges);

  const isPending =
    sessionsQuery.isPending ||
    groupsQuery.isPending ||
    chargesQuery.isPending ||
    attendanceQuery.isPending;
  const isError = sessionsQuery.isError || groupsQuery.isError || chargesQuery.isError;
  const refetch = () => {
    sessionsQuery.refetch();
    groupsQuery.refetch();
    chargesQuery.refetch();
  };

  return {
    isClient,
    todayDate,
    sessions,
    groups,
    attendance,
    activeGroups,
    totalCapacity,
    totalEnrolled,
    overallOccupancyPct,
    sessionsHint,
    upcomingSessions,
    overdueCount,
    paidRevenue,
    overdueRevenue,
    revenueHint,
    isPending,
    isError,
    refetch,
    hasOperatingData: groups.length > 0,
  };
}

type DashboardData = ReturnType<typeof useAcademyDashboard>;

function DashboardKpis({ d }: { d: DashboardData }) {
  const can = useCan();
  const canViewFinance = can("finance:view");

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Kpi
        icon={<GraduationCap className="size-5" />}
        iconColor="bg-primary/10 text-primary"
        label="Aulas hoje"
        value={String(d.sessions.length)}
        hint={d.sessions.length === 0 ? "Nenhuma aula programada" : d.sessionsHint}
        href="/classes/calendar"
      />
      <Kpi
        icon={<CheckCheck className="size-5" />}
        iconColor="bg-sky-500/10 text-sky-700 dark:text-sky-400"
        label="Presenças hoje"
        value={
          d.attendance.total > 0
            ? `${d.attendance.present}`
            : d.sessions.length > 0
              ? "Aguardando"
              : "Sem aulas"
        }
        hint={
          d.attendance.total > 0
            ? `${plural(d.attendance.absent, "falta", "faltas")} · ${plural(d.attendance.justified, "justificada", "justificadas")}`
            : d.sessions.length > 0
              ? "Chamada aberta para hoje"
              : "Grade livre hoje"
        }
        href="/classes"
      />
      {canViewFinance ? (
        <Kpi
          icon={<Wallet className="size-5" />}
          iconColor="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          label="Mensalidades recebidas"
          value={formatCents(d.paidRevenue)}
          href="/classes/billing"
          badge={
            d.overdueCount > 0 ? (
              <Badge variant="destructive" className="h-4.5 px-1.5 text-[10px] font-semibold">
                {d.overdueCount} em atraso
              </Badge>
            ) : null
          }
          hint={d.revenueHint}
        />
      ) : (
        <Kpi
          icon={<Wallet className="size-5" />}
          iconColor={
            d.overdueCount > 0
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          }
          label="Cobranças em atraso"
          value={d.overdueCount > 0 ? String(d.overdueCount) : "Nenhuma"}
          href="/classes/billing"
          badge={
            d.overdueCount > 0 ? (
              <Badge variant="destructive" className="h-4.5 px-1.5 text-[10px] font-semibold">
                Pendente
              </Badge>
            ) : (
              <Badge variant="outline" className="h-4.5 px-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Em dia
              </Badge>
            )
          }
          hint={
            d.overdueCount > 0
              ? `${plural(d.overdueCount, "cobrança precisando", "cobranças precisando")} de atenção`
              : "Todas as mensalidades do mês em dia"
          }
        />
      )}
    </div>
  );
}

/** Aulas de hoje: lista alinhada ao topo (so o vazio fica centralizado). */
function TodaySessionsCard({ d, className }: { d: DashboardData; className?: string }) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1 pb-3">
        <div className="min-w-0 space-y-0.5">
          <CardTitle className="text-base font-semibold">Aulas de hoje</CardTitle>
          <p className="text-xs text-muted-foreground">Turmas com encontro hoje</p>
        </div>
        <Button variant="ghost" asChild className="max-sm:-ml-3">
          <Link href="/classes/calendar">
            Ver calendário
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1">
        {d.upcomingSessions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2.5 py-12 text-center">
            <CalendarDays className="size-8 text-muted-foreground/60" />
            <p className="text-sm font-medium">Nenhuma aula programada para hoje</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Confira a grade semanal no calendário ou adicione novos horários às suas turmas.
            </p>
            <Button variant="outline" className="mt-2" asChild>
              <Link href="/classes/calendar">Ir para o calendário</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {d.upcomingSessions.map((s) => {
              const classGroup = d.groups.find((g) => g.id === s.classGroupId);
              const isDone = s.status === "done";
              const isCanceled = s.status === "canceled";
              return (
                <li
                  key={s.id}
                  className="flex flex-col gap-3 py-3.5 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="rounded-md border bg-muted/40 px-2.5 py-1.5 text-center shrink-0">
                      <span className="text-xs font-semibold tabular-nums block">{s.start}</span>
                      <span className="text-[10px] text-muted-foreground block">{s.end}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="min-w-0 break-words text-sm font-semibold">{s.className}</p>
                        {s.modalityName ? (
                          <Badge variant="outline" className="text-[11px] font-normal py-0">
                            {s.modalityName}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="min-w-0 text-xs text-muted-foreground mt-0.5 break-words">
                        Prof. {s.instructorName}
                        {classGroup ? (
                          <span>
                            {" "}
                            · {classGroup.availableSpots > 0
                              ? `${classGroup.enrolledCount} de ${classGroup.capacity} alunos`
                              : "Turma lotada"}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0">
                    {isDone ? (
                      <Badge variant="secondary" className="text-xs font-normal">
                        Concluída
                      </Badge>
                    ) : isCanceled ? (
                      <Badge
                        variant="outline"
                        className="text-xs font-normal text-muted-foreground line-through"
                      >
                        Cancelada
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs font-normal border-primary/40 text-primary bg-primary/5"
                      >
                        Agendada
                      </Badge>
                    )}
                    <Button variant="outline" asChild>
                      <Link href={`/classes/sessions/${s.id}`}>
                        <ClipboardCheck className="size-3.5" />
                        Lista de chamada
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Lista de ocupacao (sem o Card). `scrollClassName` limita a altura com rolagem. */
function OccupancyList({ d, scrollClassName }: { d: DashboardData; scrollClassName?: string }) {
  if (d.activeGroups.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-center text-xs text-muted-foreground">
        Nenhuma turma cadastrada.
      </div>
    );
  }
  return (
    <div>
      <ScrollCueArea className={scrollClassName} cueLabel="Mais turmas">
        <ul className="space-y-3.5">
          {d.activeGroups.map((g) => {
            // O numero mostra a ocupacao real (pode passar de 100%); so a barra e limitada ao trilho.
            const pct = Math.round((g.enrolledCount / Math.max(1, g.capacity)) * 100);
            const isOverCapacity = pct > 100;
            const isAlmostFull = pct >= 85;
            return (
              <li key={g.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 font-medium break-words">{g.name}</span>
                  <span
                    className={cn(
                      "shrink-0 tabular-nums",
                      isOverCapacity
                        ? "font-medium text-red-600 dark:text-red-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {g.enrolledCount} de {g.capacity} ({pct}%)
                    {isOverCapacity ? " · acima da capacidade" : ""}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isOverCapacity ? "bg-red-500" : isAlmostFull ? "bg-amber-500" : "bg-primary",
                    )}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </ScrollCueArea>
      <div className="mt-4 pt-3.5 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
        <span>Ocupação geral da unidade</span>
        <span className="font-semibold text-foreground tabular-nums">
          {d.totalEnrolled}/{d.totalCapacity} vagas ({d.overallOccupancyPct}%)
        </span>
      </div>
    </div>
  );
}

function OccupancyCard({
  d,
  className,
  scrollClassName = "max-h-56",
}: {
  d: DashboardData;
  className?: string;
  scrollClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col gap-0", className)}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1 pb-3">
        <CardTitle className="text-base font-semibold">Ocupação das turmas</CardTitle>
        <Button variant="ghost" asChild>
          <Link href="/classes">
            Ver turmas
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <OccupancyList d={d} scrollClassName={scrollClassName} />
      </CardContent>
    </Card>
  );
}

/**
 * Blocos abaixo dos KPIs: aulas de hoje na largura toda; ocupacao e
 * aniversariantes lado a lado, com a mesma altura e rolagem propria.
 */
function DashboardMainGrid({ d }: { d: DashboardData }) {
  // Aniversariantes dependem do relogio do usuario: so no client.
  const today = d.isClient ? d.todayDate : null;
  return (
    <div className="space-y-4">
      <TodaySessionsCard d={d} />
      {/* Proximos eventos (doc product/29): so aparece quando ha evento a vista. */}
      <UpcomingEventsCard />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OccupancyCard d={d} scrollClassName="max-h-48" />
        {/* Altura maxima com rolagem: a 4a linha aparece cortada, sinalizando que ha mais */}
        {today ? <BirthdaysCard today={today} scrollClassName="max-h-48" /> : null}
      </div>
    </div>
  );
}

/** Banner de boas-vindas ao Pro quando o WhatsApp oficial ainda não foi conectado. */
function ProActivationBanner() {
  const { data: subscription } = useSubscription();
  const { data: connection } = useWhatsAppConnection();
  const can = useCan();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (!can("communication:manage")) return null;
  if (subscription?.tier !== "pro" && subscription?.tier !== "scale") return null;
  if (subscription?.status !== "active") return null;
  if (connection?.officialStatus === "connected") return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-r from-primary/10 via-primary/5 to-transparent p-5 shadow-xs">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                Plano Profissional ativo
              </span>
              <h3 className="text-sm font-bold text-foreground">
                Próximo passo: ative o envio automático pelo WhatsApp oficial
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              Para que lembretes de aula, cobranças e mensagens de boas-vindas sejam disparados sozinhos sem precisar do botão manual no aparelho, conecte o número do seu espaço à API oficial da Meta.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <Button asChild size="sm" className="gap-1.5 font-bold text-xs shadow-xs">
            <Link href="/communication?tab=connection">
              <Smartphone className="size-3.5" />
              Conectar agora
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            className="size-8 text-muted-foreground hover:text-foreground"
            title="Fechar aviso"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Corpo do dashboard (estados + KPIs + blocos). */
function AcademyDashboardBody() {
  const d = useAcademyDashboard();
  const user = useCurrentUser();
  const alerts = useBellAlerts(d.todayDate);

  if (!d.hasOperatingData) {
    return user.profile !== "owner" && !d.isPending ? (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <GraduationCap className="size-10 text-muted-foreground/60 mb-2" />
        <h3 className="text-base font-semibold text-foreground">Nenhuma turma cadastrada ainda</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-1">
          A unidade está em fase de configuração inicial. Assim que as primeiras turmas forem
          criadas, a rotina de aulas e chamadas aparecerá aqui.
        </p>
      </div>
    ) : null;
  }
  if (d.isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border py-16 text-center">
        <AlertTriangle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar as informações do dashboard. Tente novamente.
        </p>
        <Button variant="outline" onClick={d.refetch}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }
  if (d.isPending) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <DashboardKpis d={d} />
      {/* Pendencias do dia no topo, sem precisar rolar (some quando nao ha nada) */}
      {d.isClient ? (
        <DashboardTodo today={d.todayDate} alerts={alerts} />
      ) : null}
      <DashboardMainGrid d={d} />
    </div>
  );
}

export function AcademyDashboardView() {
  const isClient = useIsClient();
  const { data: groups } = useClassGroups();
  const hasOperatingData = (groups ?? []).length > 0;
  const todayLabel = (() => {
    const l = format(parseISO(todayISO()), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
    return l.charAt(0).toUpperCase() + l.slice(1);
  })();

  return (
    <div className="space-y-6">
      {hasOperatingData ? (
        <PageHeader
          title="Painel"
          description={isClient ? `Visão geral das turmas · ${todayLabel}` : "Visão geral das turmas"}
        >
          <Button variant="outline" asChild>
            <Link href="/classes/calendar">
              <CalendarCheck className="size-4" />
              Ver calendário
            </Link>
          </Button>
          <Button asChild>
            <Link href="/classes">
              <Plus className="size-4" />
              Nova turma
            </Link>
          </Button>
        </PageHeader>
      ) : null}

      <ProActivationBanner />

      <Onboarding />

      <AcademyDashboardBody />
    </div>
  );
}
