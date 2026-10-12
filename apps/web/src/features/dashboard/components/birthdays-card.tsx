"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpRight, Cake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InitialsAvatar } from "@/components/shared/list";
import { ScrollCueArea } from "@/components/shared/scroll-cue-area";
import {
  UPCOMING_BIRTHDAY_DAYS,
  birthdaysOfMonth,
  upcomingBirthdaysNextMonths,
} from "@/lib/birthdays";
import { cn } from "@/lib/utils";
import { formatPhone } from "@gestarahub/core/format";
import { useClients } from "@/features/clients";

/**
 * Aniversariantes do mes de `today` (alunos ativos) mais os proximos dias que
 * caem no mes seguinte. Ordem: hoje, proximos (mais perto primeiro), resto do
 * mes e, por ultimo, os que ja passaram.
 */
export function useMonthBirthdays(today: string) {
  const { data: clients, isPending } = useClients({ status: "active" });
  const month = birthdaysOfMonth(clients ?? [], today);
  const nextMonths = upcomingBirthdaysNextMonths(clients ?? [], today);
  const rank = (b: { daysUntil: number }) => (b.daysUntil >= 0 ? b.daysUntil : 1000 - b.daysUntil);
  const ordered = [...month, ...nextMonths].sort((a, b) => rank(a) - rank(b));
  return { birthdays: ordered, todayCount: month.filter((b) => b.isToday).length, isPending };
}

/** "Amanhã" ou "Em 3 dias" para aniversarios proximos. */
function upcomingLabel(daysUntil: number): string {
  return daysUntil === 1 ? "Amanhã" : `Em ${daysUntil} dias`;
}

/**
 * Lista dos aniversariantes (sem o Card), para usar no card proprio ou dentro
 * de uma aba. `scrollClassName` limita a altura com rolagem interna.
 */
export function BirthdaysList({
  today,
  scrollClassName,
}: {
  today: string;
  scrollClassName?: string;
}) {
  const { birthdays, todayCount, isPending } = useMonthBirthdays(today);

  if (isPending) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-md" />
        ))}
      </div>
    );
  }
  if (birthdays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-xs text-muted-foreground">
        <Cake className="size-6 text-muted-foreground/60" />
        Nenhum aniversariante neste mês.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {todayCount > 0 ? (
        <p className="rounded-lg border border-pink-500/25 bg-pink-500/[0.07] px-3 py-2 text-xs text-pink-700 dark:text-pink-300">
          {todayCount === 1
            ? "Hoje tem aniversariante. Mande os parabéns!"
            : `Hoje são ${todayCount} aniversariantes. Mande os parabéns!`}
        </p>
      ) : null}
      <ScrollCueArea className={scrollClassName} cueLabel="Mais aniversariantes">
        <ul className="space-y-2.5">
          {birthdays.map(({ item, day, isToday, isPast, ageTurning, daysUntil }) => (
            <li
              key={item.id}
              className={cn("flex items-center gap-3", isPast && !isToday && "opacity-60")}
            >
              <InitialsAvatar name={item.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {ageTurning > 0 ? `Faz ${ageTurning} anos` : "Aniversário"}
                  {item.phone ? ` · ${formatPhone(item.phone)}` : ""}
                </p>
              </div>
              {isToday ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-pink-500/30 bg-pink-500/10 px-2 py-0.5 text-[11px] font-medium text-pink-700 dark:text-pink-300">
                  <Cake className="size-3" aria-hidden />
                  Hoje
                </span>
              ) : daysUntil > 0 && daysUntil <= UPCOMING_BIRTHDAY_DAYS ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  <Cake className="size-3" aria-hidden />
                  {upcomingLabel(daysUntil)}
                </span>
              ) : (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  dia {day}
                </span>
              )}
            </li>
          ))}
        </ul>
      </ScrollCueArea>
    </div>
  );
}

/** Card "Aniversariantes de <mes>". A lista rola por dentro (altura limitada). */
export function BirthdaysCard({
  today,
  className,
  scrollClassName = "max-h-64",
}: {
  today: string;
  className?: string;
  scrollClassName?: string;
}) {
  const monthLabel = format(parseISO(today), "MMMM", { locale: ptBR });
  const { birthdays } = useMonthBirthdays(today);
  return (
    // gap-0: o card padrao tem 24px entre cabecalho e conteudo; aqui so o pb-3.
    <Card className={cn("flex flex-col gap-0", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">
          Aniversariantes de {monthLabel}
          {birthdays.length > 0 ? (
            <span className="ml-1.5 text-sm font-normal text-muted-foreground tabular-nums">
              ({birthdays.length})
            </span>
          ) : null}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/reports">
            Relatório
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <BirthdaysList today={today} scrollClassName={scrollClassName} />
      </CardContent>
    </Card>
  );
}
