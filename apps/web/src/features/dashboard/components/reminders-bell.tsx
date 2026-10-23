"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Bell } from "lucide-react";
import { plural } from "@gestarahub/core/format";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCan, useModel } from "@/features/auth";
import { DashboardTodo, useReminderCount } from "./dashboard-todo";

/**
 * Sino no topo (doc product/25): o numero de pendencias dos lembretes e, ao
 * tocar, a mesma lista do painel num painel lateral. Some sem pendencia. So no
 * modelo de turmas e para quem manda mensagem.
 */
export function RemindersBell() {
  const can = useCan();
  const model = useModel();
  if (model !== "classes" || !can("communication:view")) return null;
  return <RemindersBellButton />;
}

function RemindersBellButton() {
  const today = format(new Date(), "yyyy-MM-dd");
  const count = useReminderCount(today);
  const [open, setOpen] = useState(false);
  if (count === 0 && !open) return null;
  const label = plural(count, "lembrete pendente", "lembretes pendentes");
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        title={label}
        aria-label={`Lembretes: ${label}`}
        onClick={() => setOpen(true)}
      >
        <Bell className="size-4" />
        {count > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-destructive-foreground">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
        >
          <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
            <SheetTitle className="text-lg font-semibold text-foreground">Lembretes</SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {count > 0 ? plural(count, "pendência", "pendências") : "Tudo em dia."}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DashboardTodo today={today} bare />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
