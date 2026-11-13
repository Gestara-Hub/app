"use client";

import { PillTabs } from "@/components/shared/pill-tabs";
import { useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { CheckCircle2, Circle } from "lucide-react";
import type {
  DateISO,
  EvaluationEntryTone,
  Id,
  ModalityProgressionTrack,
  ProgressionLevelStep,
  StudentModalityOverviewItem,
  StudentModalityProgression,
  StudentStageGrades,
} from "@gestarahub/contracts";
import { stageGradeChecks } from "@gestarahub/core/progression";
import { BeltBadge } from "@/components/shared/belt-badge";
import { currentLevelOf, resolveModalityTrack, resolveTrackStyle } from "@/lib/progression-tracks";
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

/** Linha de meta: certo ou nao, o nome e o valor a direita. */
export function GoalRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      {ok ? (
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="size-4 shrink-0 text-muted-foreground/60" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className="ml-auto tabular-nums text-muted-foreground">{detail}</span>
    </li>
  );
}

/** Media e frequencia da etapa atual (doc product/30 §1), uma linha cada. */
export function StageGradeRows({ grades, inLevel }: { grades: StudentStageGrades; inLevel: string }) {
  return (
    <>
      {stageGradeChecks(grades).map((check) => (
        <GoalRow
          key={check.key}
          ok={check.ok}
          label={check.key === "grade" ? `${check.label} ${inLevel}` : check.label}
          detail={check.target ? `${check.value} · ${check.target}` : check.value}
        />
      ))}
    </>
  );
}

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
  age: number | null = null,
): ProgressionLevelStep | undefined {
  return currentLevelOf(track, progression, age);
}

/**
 * Lembrete "Para hoje": o "Para a próxima aula" do registro mais recente
 * ANTES da data da aula (o registro da propria aula vale para a seguinte), e
 * so na primeira aula depois dele. Na mesma turma, nenhum encontro dela entre
 * o registro e esta aula (`weekdays` = dias da turma); sem saber os dias ou em
 * outra turma, vale por ate 7 dias.
 */
export function nextClassReminder(
  progression: StudentModalityProgression | undefined,
  beforeDate: DateISO,
  current?: { classGroupId?: Id; weekdays?: readonly number[] },
): string | undefined {
  const latest = [...(progression?.evaluations ?? [])]
    .filter((e) => e.date < beforeDate)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest?.nextClassNote) return undefined;
  const recordDay = parseISO(latest.date);
  const sessionDay = parseISO(beforeDate);
  if (current?.weekdays?.length && current.classGroupId && latest.classGroupId === current.classGroupId) {
    for (let day = addDays(recordDay, 1); day < sessionDay; day = addDays(day, 1)) {
      if (current.weekdays.includes(day.getDay())) return undefined;
    }
    return latest.nextClassNote;
  }
  return differenceInCalendarDays(sessionDay, recordDay) <= 7 ? latest.nextClassNote : undefined;
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
  age = null,
}: {
  items: StudentModalityOverviewItem[];
  age?: number | null;
  activeId?: string;
  onSelect: (modalityId: string) => void;
}) {
  if (items.length < 2) return null;
  return (
    <PillTabs
      value={activeId}
      onChange={onSelect}
      tabs={items.map((item) => {
        const track = resolveModalityTrack(item.modality);
        const style = resolveTrackStyle(track);
        const level = levelOf(track, item.progression, age);
        return {
          value: item.modality.id,
          label: item.modality.name,
          extra:
            level && (style === "belt" || level.color) ? (
              <BeltBadge
                name={level.name}
                color={level.color}
                variant={style}
                subLevel={item.progression?.subLevel ?? 0}
                maxSubLevels={level.maxSubLevels}
                size="xs"
                showLabel={false}
              />
            ) : null,
        };
      })}
    />
  );
}
