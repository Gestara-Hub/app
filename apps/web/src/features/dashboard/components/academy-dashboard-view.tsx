"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  CheckCheck,
  ClipboardCheck,
  GraduationCap,
  Plus,
  RotateCw,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { useIsClient } from "@/lib/use-is-client";
import { cn } from "@/lib/utils";
import { formatCents, plural, pluralWord } from "@gestarahub/core/format";
import { todayISO } from "@gestarahub/core/date";
import {
  useAttendanceSummary,
  useCharges,
  useClassGroups,
  useClassSessions,
} from "@/features/turmas";
import { Onboarding } from "@/features/onboarding";
import { useCurrentUser } from "@/features/auth";

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
    <div className="flex items-center justify-between gap-3 p-3.5 sm:px-4 sm:py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          {badge}
        </div>
        <p className="text-xl font-bold tracking-tight text-foreground tabular-nums sm:text-2xl mt-0.5">
          {value}
        </p>
        {hint ? (
          <div className="text-xs text-muted-foreground leading-snug mt-0.5 truncate">
            {hint}
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          iconColor,
        )}
      >
        {icon}
      </div>
    </div>
  );

  const cardClasses = cn(
    "rounded-xl border bg-card text-card-foreground shadow-xs transition-all",
    href && "hover:border-foreground/25 hover:shadow-xs cursor-pointer",
  );

  if (href) {
    return (
      <div className={cardClasses}>
        <Link href={href} className="block">
          {content}
        </Link>
      </div>
    );
  }

  return <div className={cardClasses}>{content}</div>;
}

export function AcademyDashboardView() {
  // A data de "hoje" vem do relogio do usuario: so no client (sem erro de hidratacao).
  const isClient = useIsClient();
  const todayDate = todayISO();
  const currentCompetence = format(parseISO(todayDate), "yyyy-MM");
  const todayLabel = (() => {
    const l = format(parseISO(todayDate), "EEEE, d 'de' MMMM 'de' yyyy", {
      locale: ptBR,
    });
    return l.charAt(0).toUpperCase() + l.slice(1);
  })();

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
  const scheduledSessions = sessions.filter(
    (s) => s.status === "scheduled",
  ).length;
  const canceledSessions = sessions.filter((s) => s.status === "canceled").length;
  const sessionsHint = [
    completedSessions > 0 ? plural(completedSessions, "concluída", "concluídas") : null,
    scheduledSessions > 0 ? plural(scheduledSessions, "agendada", "agendadas") : null,
    canceledSessions > 0 ? plural(canceledSessions, "cancelada", "canceladas") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const upcomingSessions = [...sessions].sort((a, b) =>
    a.start.localeCompare(b.start),
  );

  // Financeiro do mês
  const paidCharges = charges.filter((c) => c.status === "paid");
  const pendingCharges = charges.filter((c) => c.status === "pending");
  const overdueCharges = charges.filter((c) => c.status === "overdue");

  const paidRevenue = paidCharges.reduce((sum, c) => sum + c.amountCents, 0);
  const pendingRevenue = pendingCharges.reduce(
    (sum, c) => sum + c.amountCents,
    0,
  );
  const overdueRevenue = overdueCharges.reduce(
    (sum, c) => sum + c.amountCents,
    0,
  );
  // "Quitadas" so quando ha mensalidade no mes e nenhuma em aberto.
  const billedCharges = charges.filter((c) => c.status !== "canceled");
  const revenueHint =
    pendingRevenue > 0
      ? `${formatCents(pendingRevenue)} pendente`
      : billedCharges.length === 0
        ? "Nenhuma mensalidade gerada no mês"
        : "Todas as mensalidades quitadas";

  const isPending =
    sessionsQuery.isPending ||
    groupsQuery.isPending ||
    chargesQuery.isPending ||
    attendanceQuery.isPending;
  const isError =
    sessionsQuery.isError || groupsQuery.isError || chargesQuery.isError;

  const user = useCurrentUser();
  const hasOperatingData = groups.length > 0;

  return (
    <>
      {hasOperatingData ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <PageHeader
            title="Dashboard"
            description={
              isClient
                ? `Visão geral das turmas · ${todayLabel}`
                : "Visão geral das turmas"
            }
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/classes/calendar">
                <CalendarCheck className="size-4" />
                Ver calendário
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/classes">
                <Plus className="size-4" />
                Nova turma
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      <Onboarding />

      {!hasOperatingData ? (
        user.profile !== "owner" ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
            <GraduationCap className="size-10 text-muted-foreground/60 mb-2" />
            <h3 className="text-base font-semibold text-foreground">
              Nenhuma turma cadastrada ainda
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              A unidade está em fase de configuração inicial. Assim que as primeiras turmas forem criadas, a rotina de aulas e chamadas aparecerá aqui.
            </p>
          </div>
        ) : null
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-16 text-center">
          <AlertTriangle className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar as informações do dashboard. Tente
            novamente.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              sessionsQuery.refetch();
              groupsQuery.refetch();
              chargesQuery.refetch();
            }}
          >
            <RotateCw className="size-4" />
            Tentar novamente
          </Button>
        </div>
      ) : isPending ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top 3 KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi
              icon={<GraduationCap className="size-5" />}
              iconColor="bg-primary/10 text-primary"
              label="Aulas hoje"
              value={String(sessions.length)}
              hint={
                sessions.length === 0
                  ? "Nenhuma aula programada"
                  : sessionsHint
              }
              href="/classes/calendar"
            />
            <Kpi
              icon={<CheckCheck className="size-5" />}
              iconColor="bg-sky-500/10 text-sky-600 dark:text-sky-400"
              label="Presenças hoje"
              value={
                attendance.total > 0
                  ? `${attendance.present}`
                  : sessions.length > 0
                    ? "Aguardando"
                    : "Sem aulas"
              }
              hint={
                attendance.total > 0
                  ? `${plural(attendance.absent, "falta", "faltas")} · ${plural(attendance.justified, "justificada", "justificadas")}`
                  : sessions.length > 0
                    ? "Chamada aberta para hoje"
                    : "Grade livre hoje"
              }
              href="/classes"
            />
            <Kpi
              icon={<Wallet className="size-5" />}
              iconColor="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              label="Mensalidades recebidas"
              value={formatCents(paidRevenue)}
              href="/classes/billing"
              badge={
                overdueCharges.length > 0 ? (
                  <Badge
                    variant="destructive"
                    className="h-4.5 px-1.5 text-[10px] font-semibold"
                  >
                    {overdueCharges.length} em atraso
                  </Badge>
                ) : null
              }
              hint={revenueHint}
            />
          </div>

          {/* Alerta de Inadimplência / Mensalidades em Atraso */}
          {overdueCharges.length > 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 sm:px-4 sm:py-3 text-destructive">
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                  <AlertCircle className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Atenção:{" "}
                    <span className="text-destructive font-bold">
                      {overdueCharges.length}{" "}
                      {pluralWord(overdueCharges.length, "mensalidade", "mensalidades")}{" "}
                      em atraso
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total de{" "}
                    <strong className="text-foreground">
                      {formatCents(overdueRevenue)}
                    </strong>{" "}
                    aguardando regularização nesta competência.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0 self-end sm:self-auto"
                asChild
              >
                <Link href="/classes/billing">
                  Ver cobranças
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          ) : null}

          {/* Grid Principal: Aulas do dia + Ocupação das turmas */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Coluna 1: Aulas de Hoje (Grade do dia) */}
            <Card className="lg:col-span-2 flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="space-y-0.5">
                  <CardTitle className="text-base font-semibold">
                    Aulas de hoje
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Grade e lista de presença das turmas com encontro hoje
                  </p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/classes/calendar">
                    Ver grade completa
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center">
                {upcomingSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2.5 py-12 text-center">
                    <CalendarDays className="size-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium">
                      Nenhuma aula programada para hoje
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Confira a grade semanal no calendário ou adicione novos
                      horários às suas turmas.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      asChild
                    >
                      <Link href="/classes/calendar">Ir para o calendário</Link>
                    </Button>
                  </div>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {upcomingSessions.map((s) => {
                      const classGroup = groups.find(
                        (g) => g.id === s.classGroupId,
                      );
                      const isDone = s.status === "done";
                      const isCanceled = s.status === "canceled";
                      return (
                        <li
                          key={s.id}
                          className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className="rounded-md border bg-muted/40 px-2.5 py-1.5 text-center shrink-0">
                              <span className="text-xs font-semibold tabular-nums block">
                                {s.start}
                              </span>
                              <span className="text-[10px] text-muted-foreground block">
                                {s.end}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <p className="min-w-0 break-words text-sm font-semibold">
                                  {s.className}
                                </p>
                                {s.modalityName ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[11px] font-normal py-0 h-4"
                                  >
                                    {s.modalityName}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                Prof. {s.instructorName}
                                {classGroup ? (
                                  <span>
                                    {" "}
                                    · {classGroup.enrolledCount}/
                                    {classGroup.capacity} alunos (
                                    {classGroup.availableSpots > 0
                                      ? plural(classGroup.availableSpots, "vaga", "vagas")
                                      : "lotada"}
                                    )
                                  </span>
                                ) : null}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {isDone ? (
                              <Badge
                                variant="secondary"
                                className="text-xs font-normal"
                              >
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
                            <Button variant="outline" size="sm" asChild>
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

            {/* Coluna 2: Ocupação das turmas */}
            <Card className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base font-semibold">
                  Ocupação das turmas
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/classes">
                    Ver turmas
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                {activeGroups.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center py-6 text-center text-xs text-muted-foreground">
                    Nenhuma turma cadastrada.
                  </div>
                ) : (
                  <ul className="space-y-3.5">
                    {activeGroups.slice(0, 6).map((g) => {
                      // O numero mostra a ocupacao real (pode passar de 100%);
                      // so a barra e limitada ao trilho.
                      const pct = Math.round(
                        (g.enrolledCount / Math.max(1, g.capacity)) * 100,
                      );
                      const isOverCapacity = pct > 100;
                      const isAlmostFull = pct >= 85;
                      return (
                        <li key={g.id} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium truncate max-w-[170px]">
                              {g.name}
                            </span>
                            <span
                              className={cn(
                                "tabular-nums",
                                isOverCapacity
                                  ? "font-medium text-red-600 dark:text-red-400"
                                  : "text-muted-foreground",
                              )}
                            >
                              {g.enrolledCount}/{g.capacity} ({pct}%)
                              {isOverCapacity ? " · acima da capacidade" : ""}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                isOverCapacity
                                  ? "bg-red-500"
                                  : isAlmostFull
                                    ? "bg-amber-500"
                                    : "bg-primary",
                              )}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {activeGroups.length > 0 ? (
                  <div className="mt-4 pt-3.5 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Ocupação geral da unidade</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {totalEnrolled}/{totalCapacity} vagas ({overallOccupancyPct}%)
                    </span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
