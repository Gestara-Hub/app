"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { ListItemCard } from "@/components/shared/list-item-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarRange, Plus } from "lucide-react";
import type { ClassMeetingSlot } from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import { useClassGroups } from "../hooks/use-turmas";
import { TurmaFormDialog } from "./turma-form-dialog";

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function slotsSummary(slots: ClassMeetingSlot[]): string {
  return slots
    .map((s) => `${WEEKDAY_SHORT[s.weekday]} ${s.start}`)
    .join(" · ");
}

export function TurmasView() {
  const { data: turmas, isLoading } = useClassGroups();
  const can = useCan();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Turmas"
        description="Turmas, matrículas e frequência dos alunos."
      >
        <Button asChild variant="outline">
          <Link href="/classes/calendar">
            <CalendarRange className="size-4" />
            Calendário
          </Link>
        </Button>
        {can("classes:manage") ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Nova turma
          </Button>
        ) : null}
      </PageHeader>

      <TurmaFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      <div className="space-y-2">
        {isLoading ? (
          [0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[4.5rem] w-full rounded-md" />
          ))
        ) : (turmas ?? []).length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma turma cadastrada.
          </p>
        ) : (
          (turmas ?? []).map((t) => {
            const full = t.vagasRestantes <= 0;
            return (
              <Link key={t.id} href={`/classes/${t.id}`} className="block">
                <ListItemCard>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[
                          t.modalityName,
                          `Instrutor: ${t.instructorName}`,
                          slotsSummary(t.meetingSlots),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span
                      className={
                        "inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium " +
                        (full
                          ? "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                          : "border-border bg-muted/40 text-muted-foreground")
                      }
                    >
                      {t.enrolledCount}/{t.capacity} vagas
                    </span>
                  </div>
                </ListItemCard>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
