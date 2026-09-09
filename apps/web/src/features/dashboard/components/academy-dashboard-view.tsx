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
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { formatCents } from "@gestarahub/core/format";
import { todayISO } from "@gestarahub/core/date";
import {
  useAttendanceSummary,
  useCharges,
  useClassGroups,
  useClassSessions,
  useMakeups,
} from "@/features/turmas";
import { Onboarding } from "@/features/onboarding";

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {hint ? (
            <p className="truncate text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function AcademyDashboardView() {
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
  const chargesQuery = useCharges({ competence: currentCompetence });
  const attendanceQuery = useAttendanceSummary(todayDate);
  const makeupsQuery = useMakeups();

  const sessions = sessionsQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const charges = chargesQuery.data ?? [];
  const attendance = attendanceQuery.data ?? {
    present: 0,
    absent: 0,
    justified: 0,
    total: 0,
  };
  const makeups = makeupsQuery.data ?? [];

  const activeGroups = groups.filter((g) => g.status === "active");
  const totalEnrolled = activeGroups.reduce(
    (sum, g) => sum + g.enrolledCount,
    0,
  );

  // Status das aulas de hoje
  const completedSessions = sessions.filter((s) => s.status === "done").length;
  const scheduledSessions = sessions.filter(
    (s) => s.status === "scheduled",
  ).length;
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

  // Reposições pendentes
  const pendingMakeups = makeups.filter((m) => m.status === "pending");

  const isPending =
    sessionsQuery.isPending ||
    groupsQuery.isPending ||
    chargesQuery.isPending ||
    attendanceQuery.isPending;
  const isError =
    sessionsQuery.isError || groupsQuery.isError || chargesQuery.isError;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Dashboard"
          description={`Visão geral da academia · ${todayLabel}`}
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

      <Onboarding />

      {isError ? (
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={<GraduationCap className="size-5" />}
              label="Aulas hoje"
              value={String(sessions.length)}
              hint={
                sessions.length === 0
                  ? "Nenhuma aula hoje"
                  : `${completedSessions} concluída(s) · ${scheduledSessions} agendada(s)`
              }
            />
            <Kpi
              icon={<Users className="size-5" />}
              label="Alunos matriculados"
              value={String(totalEnrolled)}
              hint={`Em ${activeGroups.length} turma(s) ativa(s)`}
            />
            <Kpi
              icon={<CheckCheck className="size-5" />}
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
                  ? `${attendance.absent} falta(s) · ${attendance.justified} justificada(s)`
                  : sessions.length > 0
                    ? "Chamada aberta para hoje"
                    : "Nenhuma aula programada"
              }
            />
            <Kpi
              icon={<Wallet className="size-5" />}
              label="Mensalidades recebidas"
              value={formatCents(paidRevenue)}
              hint={
                pendingRevenue > 0 || overdueRevenue > 0
                  ? `${formatCents(pendingRevenue)} pendente${overdueRevenue > 0 ? ` · ${formatCents(overdueRevenue)} em atraso` : ""}`
                  : "Todas as cobranças quitadas"
              }
            />
          </div>

          {/* Grid Principal: Aulas do dia + Ocupação & Financeiro */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Coluna 1: Aulas de Hoje (Grade do dia) */}
            <Card className="lg:col-span-2">
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
              <CardContent>
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
                      return (
                        <li
                          key={s.id}
                          className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="rounded-md border bg-muted/40 px-2.5 py-1.5 text-center shrink-0">
                              <span className="text-xs font-semibold tabular-nums block">
                                {s.start}
                              </span>
                              <span className="text-[10px] text-muted-foreground block">
                                {s.end}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold truncate">
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
                                      ? `${classGroup.availableSpots} vagas`
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
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs font-normal border-primary/40 text-primary bg-primary/5"
                              >
                                Programada
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

            {/* Coluna 2: Ocupação das turmas e Resumo financeiro */}
            <div className="space-y-4">
              {/* Card Ocupação */}
              <Card>
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
                <CardContent>
                  {activeGroups.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      Nenhuma turma cadastrada.
                    </p>
                  ) : (
                    <ul className="space-y-3.5">
                      {activeGroups.slice(0, 4).map((g) => {
                        const pct = Math.min(
                          100,
                          Math.round(
                            (g.enrolledCount / Math.max(1, g.capacity)) * 100,
                          ),
                        );
                        const isAlmostFull = pct >= 85;
                        return (
                          <li key={g.id} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium truncate max-w-[170px]">
                                {g.name}
                              </span>
                              <span className="tabular-nums text-muted-foreground">
                                {g.enrolledCount}/{g.capacity} ({pct}%)
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  isAlmostFull ? "bg-amber-500" : "bg-primary",
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* Card Mensalidades & Avisos */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base font-semibold">
                    Mensalidades do mês
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/classes/billing">
                      Cobranças
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border p-2.5 bg-muted/20">
                      <p className="text-muted-foreground">Recebido</p>
                      <p className="text-sm font-semibold tabular-nums mt-0.5 text-emerald-600 dark:text-emerald-400">
                        {formatCents(paidRevenue)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {paidCharges.length} pagamento(s)
                      </p>
                    </div>
                    <div className="rounded-md border p-2.5 bg-muted/20">
                      <p className="text-muted-foreground">Pendente</p>
                      <p className="text-sm font-semibold tabular-nums mt-0.5">
                        {formatCents(pendingRevenue)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {pendingCharges.length} cobrança(s)
                      </p>
                    </div>
                  </div>

                  {overdueCharges.length > 0 ? (
                    <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                      <AlertCircle className="size-4 shrink-0" />
                      <span>
                        <strong>{overdueCharges.length}</strong> mensalidade(s)
                        em atraso ({formatCents(overdueRevenue)}).
                      </span>
                    </div>
                  ) : null}

                  {pendingMakeups.length > 0 ? (
                    <div className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="size-4 shrink-0" />
                        <span>
                          <strong>{pendingMakeups.length}</strong> reposição(ões)
                          pendente(s)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs"
                        asChild
                      >
                        <Link href="/classes">Ver</Link>
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
