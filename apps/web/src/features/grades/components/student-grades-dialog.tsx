"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ClipboardList } from "lucide-react";
import type { Id, ReportCardModality } from "@gestarahub/contracts";
import {
  DialogBody,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { cn } from "@/lib/utils";
import { useCategories } from "@/features/categories";
import { useModalityVocabulary } from "@/features/settings";
import { useStudentReportCard } from "../hooks/use-grades";
import { AverageValue, GradeStatusValue, SCALE_LABEL, passingLabel, weightLabel } from "./grade-ui";

function ModalityCard({ modality }: { modality: ReportCardModality }) {
  const { data: categories } = useCategories();
  const category = (categories ?? []).find((c) => c.id === modality.modalityId);
  // Palavras da trilha da modalidade (Nível, Módulo, Fase, Faixa).
  const vocabulary = useModalityVocabulary(category ?? { name: modality.modalityName });
  const { scale } = modality.settings;
  const leveled = modality.levels.some((l) => l.levelId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold">Média geral</p>
          <p className="text-xs text-muted-foreground">
            {SCALE_LABEL[scale]} · {passingLabel(modality.settings)}
          </p>
        </div>
        <AverageValue scale={scale} average={modality.overall} className="text-sm" />
      </div>

      {leveled ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Média por {vocabulary.level.toLowerCase()}
          </p>
          <ul className="divide-y rounded-lg border">
            {modality.levels.map((l) => (
              <li key={l.levelId ?? "none"} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className={cn(!l.levelId && "text-muted-foreground")}>
                  {l.levelName ?? `Sem ${vocabulary.level.toLowerCase()}`}
                </span>
                <AverageValue scale={scale} average={l.average} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Avaliações ({modality.entries.length})
        </p>
        {modality.entries.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhuma avaliação nas turmas do aluno.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {modality.entries.map((e) => (
              <li
                key={e.assessmentId}
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2.5",
                  e.belowPassing && "bg-red-50/60 dark:bg-red-950/20",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[format(parseISO(e.date), "dd/MM/yyyy"), weightLabel(e.weight), e.levelName, e.classGroupName]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <GradeStatusValue scale={scale} status={e.status} value={e.value} below={e.belowPassing} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReportCardContent({ studentId, initialModalityId }: { studentId: Id; initialModalityId?: Id }) {
  const { data, isPending } = useStudentReportCard(studentId);
  const [selected, setSelected] = useState<Id | undefined>(initialModalityId);
  const modalities = data?.modalities ?? [];
  const active = modalities.find((m) => m.modalityId === selected) ?? modalities[0];

  if (isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }
  if (!active) {
    return (
      <ModuleEmptyGuide
        icon={<ClipboardList className="size-8" />}
        title="Sem notas por aqui."
        description="As modalidades do aluno não têm avaliações."
      />
    );
  }
  return (
    <div className="space-y-4">
      {modalities.length > 1 ? (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Modalidade">
          {modalities.map((m) => (
            <button
              key={m.modalityId}
              type="button"
              role="tab"
              aria-selected={m.modalityId === active.modalityId}
              onClick={() => setSelected(m.modalityId)}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                m.modalityId === active.modalityId
                  ? "border-foreground/50 bg-foreground/5 text-foreground"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              {m.modalityName}
            </button>
          ))}
        </div>
      ) : null}
      <ModalityCard key={active.modalityId} modality={active} />
    </div>
  );
}

/**
 * Boletim "Notas" do aluno (terceiro item da evolucao, ao lado de Graduação e
 * Registros de aula): so as modalidades com avaliacoes ligadas.
 */
export function StudentGradesDialog({
  client,
  open,
  onOpenChange,
  initialModalityId,
}: {
  client: { id: Id; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialModalityId?: Id;
}) {
  if (!client) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="shrink-0 p-6 pb-3 pr-16 text-left border-b border-border/40">
          <SheetTitle className="text-lg font-semibold text-foreground">Notas</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">{client.name}</SheetDescription>
        </SheetHeader>
        <DialogBody className="pb-6">
          {open ? <ReportCardContent studentId={client.id} initialModalityId={initialModalityId} /> : null}
        </DialogBody>
      </SheetContent>
    </Sheet>
  );
}

export const StudentGradesDrawer = StudentGradesDialog;
