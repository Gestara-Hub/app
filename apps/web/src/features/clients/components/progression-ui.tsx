"use client";

import { useMemo, useState } from "react";
import type {
  DateISO,
  EvaluationEntryTone,
  ModalityProgressionTrack,
  ProgressionLevelStep,
  StudentModalityOverviewItem,
  StudentModalityProgression,
} from "@gestarahub/contracts";
import { BeltBadge } from "@/components/shared/belt-badge";
import { resolveModalityTrack, resolveTrackStyle } from "@/lib/progression-tracks";
import { cn } from "@/lib/utils";
import { useStudentProgressionOverview } from "../hooks/use-clients";

/**
 * Pecas comuns aos modais "Graduação" e "Registros de aula": modalidades do
 * aluno, nivel atual, tom do registro e o lembrete "Para hoje".
 */

export const TONE_META: Record<EvaluationEntryTone, { label: string; className: string; dot: string }> = {
  positive: {
    label: "Evolução",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  attention: {
    label: "Ajustar",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  general: {
    label: "Observação",
    className: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

export const TONES = Object.keys(TONE_META) as EvaluationEntryTone[];

/** Meses inteiros desde a data (30 dias = 1 mes). */
export function monthsSince(iso?: string): number {
  if (!iso) return 0;
  const start = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  const days = Math.floor((Date.now() - start.getTime()) / 86_400_000);
  return Math.max(0, Math.floor(days / 30));
}

/** Nivel atual do aluno na trilha (cai no primeiro sem progresso). */
export function levelOf(
  track: ModalityProgressionTrack,
  progression?: StudentModalityProgression,
): ProgressionLevelStep | undefined {
  return (
    track.levels.find((l) => l.id === progression?.levelId || l.name === progression?.levelName) ??
    track.levels[0]
  );
}

/**
 * Lembrete "Para hoje": o "Para a próxima aula" do registro mais recente
 * ANTES da data da aula (o registro da propria aula vale para a seguinte).
 */
export function nextClassReminder(
  progression: StudentModalityProgression | undefined,
  beforeDate: DateISO,
): string | undefined {
  const latest = [...(progression?.evaluations ?? [])]
    .filter((e) => e.date < beforeDate)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];
  return latest?.nextClassNote || undefined;
}

/** Modalidades com trilha em que o aluno esta matriculado, e a escolhida. */
export function useStudentModalities(clientId: string, initialModalityId?: string) {
  const { data: overview, isPending } = useStudentProgressionOverview(clientId);
  const items = useMemo(
    () =>
      (overview?.items ?? [])
        .filter((item) => {
          const track = resolveModalityTrack(item.modality);
          return track.enabled && track.levels.length > 0 && item.isEnrolled;
        })
        .sort((a, b) => a.modality.position - b.modality.position),
    [overview],
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(initialModalityId);
  const active = items.find((i) => i.modality.id === selectedId) ?? items[0];
  return { isPending, items, active, select: setSelectedId };
}

export function ModalityPicker({
  items,
  activeId,
  onSelect,
}: {
  items: StudentModalityOverviewItem[];
  activeId?: string;
  onSelect: (modalityId: string) => void;
}) {
  if (items.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Modalidade">
      {items.map((item) => {
        const track = resolveModalityTrack(item.modality);
        const style = resolveTrackStyle(track);
        const level = levelOf(track, item.progression);
        const selected = item.modality.id === activeId;
        return (
          <button
            key={item.modality.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(item.modality.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              selected ? "border-foreground/50 bg-foreground/5 text-foreground" : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            {item.modality.name}
            {level && (style === "belt" || level.color) ? (
              <BeltBadge
                name={level.name}
                color={level.color}
                variant={style}
                subLevel={item.progression?.subLevel ?? 0}
                maxSubLevels={level.maxSubLevels}
                size="xs"
                showLabel={false}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
