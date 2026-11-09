"use client";

import type { EventStage, EventView } from "@gestarahub/contracts";
import { cn } from "@/lib/utils";
import { STAGE_LABEL } from "../event-copy";

/** Selo da situacao do evento: cancelado, encerrado, em andamento ou lotado. */
export function EventStatusBadge({ event, className }: { event: Pick<EventView, "status" | "stage" | "isFull">; className?: string }) {
  if (event.status === "canceled") {
    return <Badge className={cn("border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400", className)}>Cancelado</Badge>;
  }
  if (event.stage === "finished") {
    return <Badge className={cn("border-border/60 bg-muted/60 text-muted-foreground", className)}>{STAGE_LABEL.finished}</Badge>;
  }
  if (event.stage === "ongoing") {
    return <Badge className={cn("border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", className)}>{STAGE_LABEL.ongoing}</Badge>;
  }
  if (event.isFull) {
    return <Badge className={cn("border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400", className)}>Lotado</Badge>;
  }
  return null;
}

export function stageTone(stage: EventStage): string {
  return stage === "finished" ? "text-muted-foreground" : stage === "ongoing" ? "text-emerald-700 dark:text-emerald-400" : "text-foreground";
}

/** Selo fixo de evento (cor propria, reservada aos eventos no sistema). */
export function EventKindBadge({ className }: { className?: string }) {
  return <Badge className={cn("border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300", className)}>Evento</Badge>;
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none", className)}>
      {children}
    </span>
  );
}
