"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpRight, Cake, MessageCircle } from "lucide-react";
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
import { useMessageLogs, useWhatsAppSend } from "@/features/communication";

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
  return { birthdays: ordered, isPending };
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
  const { birthdays, isPending } = useMonthBirthdays(today);
  // Parabens pelo WhatsApp do proprio espaco; verde quando ja foi mandado hoje.
  const whatsapp = useWhatsAppSend();
  const { data: greetings } = useMessageLogs({ trigger: "birthday_greeting" });
  const greetedToday = new Set(
    (greetings ?? []).filter((l) => format(parseISO(l.sentAt), "yyyy-MM-dd") === today).map((l) => l.clientId),
  );

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
    // Sem aviso de "hoje tem aniversariante": o bloco "Para fazer hoje" ja avisa.
    <div className="space-y-3">
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
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-pink-500/30 bg-pink-500/10 px-2 py-0.5 text-[11px] font-medium text-pink-700 dark:text-pink-300">
                    <Cake className="size-3" aria-hidden />
                    Hoje
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={!whatsapp.ready}
                    title={greetedToday.has(item.id) ? "Parabéns já mandado hoje" : "Mandar parabéns no WhatsApp"}
                    aria-label={`Mandar parabéns para ${item.name} no WhatsApp`}
                    className={cn(greetedToday.has(item.id) && "text-emerald-600 dark:text-emerald-400")}
                    onClick={() =>
                      whatsapp.send({
                        trigger: "birthday_greeting",
                        recipient: { name: item.name, phone: item.phone, clientId: item.id },
                      })
                    }
                  >
                    <MessageCircle className="size-4" />
                  </Button>
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
        <Button variant="ghost" asChild>
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
