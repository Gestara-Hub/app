"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCheck,
  Clock,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { formatCents } from "@gestarahub/core/format";
import { todayISO } from "@gestarahub/core/date";
import type { AppointmentStatus } from "@gestarahub/contracts";
import { useProfessionals } from "@/features/professionals";
import { AppointmentStatusBadge, useAppointments } from "@/features/appointments";
import { Onboarding } from "@/features/onboarding";

// Receita estimada considera confirmados, em atendimento e concluidos (doc 05).
const REVENUE_STATUSES = new Set<AppointmentStatus>([
  "confirmed",
  "in_service",
  "completed",
]);

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
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const todayDate = todayISO();
  const todayLabel = (() => {
    const l = format(parseISO(todayDate), "EEEE, d 'de' MMMM 'de' yyyy", {
      locale: ptBR,
    });
    return l.charAt(0).toUpperCase() + l.slice(1);
  })();

  const professionalsQuery = useProfessionals({ status: "active" });
  const appointmentsQuery = useAppointments({
    dateFrom: todayDate,
    dateTo: todayDate,
  });

  const professionals = professionalsQuery.data ?? [];
  const today = appointmentsQuery.data ?? [];

  const active = today.filter((a) => a.status !== "canceled");
  const revenue = today
    .filter((a) => REVENUE_STATUSES.has(a.status))
    .reduce((sum, a) => sum + a.totalPriceCents, 0);
  const completed = today.filter((a) => a.status === "completed").length;
  const pending = today.filter((a) => a.status === "pending").length;
  const upcoming = today
    .filter((a) => a.status === "pending" || a.status === "confirmed")
    .sort((a, b) => a.start.localeCompare(b.start));
  const byProfessional = professionals
    .map((p) => ({
      professional: p,
      count: active.filter((a) => a.professionalId === p.id).length,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...byProfessional.map((r) => r.count));

  const isPending = professionalsQuery.isPending || appointmentsQuery.isPending;
  const isError = professionalsQuery.isError || appointmentsQuery.isError;

  return (
    <>
      <PageHeader title="Dashboard" description={`Visão geral · ${todayLabel}`} />

      <Onboarding />

      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-16 text-center">
          <AlertTriangle className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar o dashboard. Tente novamente.
          </p>
          <Button variant="outline" size="sm" onClick={() => appointmentsQuery.refetch()}>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={<CalendarDays className="size-5" />}
              label="Agendamentos hoje"
              value={String(active.length)}
            />
            <Kpi
              icon={<Banknote className="size-5" />}
              label="Receita estimada"
              value={formatCents(revenue)}
              hint="Confirmados, em atendimento e concluídos"
            />
            <Kpi
              icon={<CheckCheck className="size-5" />}
              label="Concluídos hoje"
              value={String(completed)}
            />
            <Kpi
              icon={<Clock className="size-5" />}
              label="A confirmar"
              value={String(pending)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Próximos agendamentos</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/schedule">Ver agenda</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {upcoming.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum agendamento pendente ou confirmado para hoje.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {upcoming.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="w-12 shrink-0 text-sm font-medium tabular-nums">
                            {a.start}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{a.client.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {a.services.map((s) => s.name).join(" + ")} · {a.professional.name}
                            </p>
                          </div>
                        </div>
                        <AppointmentStatusBadge status={a.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por profissional</CardTitle>
              </CardHeader>
              <CardContent>
                {byProfessional.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Sem agendamentos hoje.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {byProfessional.map(({ professional, count }) => (
                      <li key={professional.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate">{professional.name}</span>
                          <span className="tabular-nums text-muted-foreground">{count}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full bg-primary")}
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
