"use client";

import Link from "next/link";
import { ArrowUpRight, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useEvents } from "../hooks/use-events";
import { datesLabel, instructorsShortLabel, occupancyLabel } from "../event-copy";
import { EventStatusBadge } from "./event-badges";

const MAX = 3;

/**
 * Card do Painel (doc product/29): os proximos eventos (em breve ou em
 * andamento), com datas e inscritos. Sem evento a vista, nao aparece.
 */
export function UpcomingEventsCard({ className }: { className?: string }) {
  const { data, isPending } = useEvents({ status: "active" });
  const upcoming = (data ?? []).filter((e) => e.stage !== "finished").slice(0, MAX);
  if (!isPending && upcoming.length === 0) return null;
  return (
    <Card className={cn("flex flex-col gap-0", className)}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1 pb-3">
        <CardTitle className="text-base font-semibold">Próximos eventos</CardTitle>
        <Button variant="ghost" asChild>
          <Link href="/events">
            Ver eventos
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        {isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="flex items-center gap-3 rounded-md border border-violet-500/30 bg-violet-500/5 px-3 py-2 transition-colors hover:border-violet-500/50 hover:bg-violet-500/10"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300">
                    <Ticket className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="min-w-0 break-words text-sm font-medium text-foreground">{event.name}</span>
                      <EventStatusBadge event={event} />
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {datesLabel(event)} · {instructorsShortLabel(event.instructors)} · {occupancyLabel(event)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
