"use client";

import { format } from "date-fns";
import { ArrowUpCircle } from "lucide-react";
import type { ProgressionLevelStep } from "@gestarahub/contracts";
import { ageAt, isAgedOutOfLevel, levelAgeLabel } from "@/lib/progression-tracks";

/**
 * "Trocar faixa": o aluno passou da idade do nivel atual (ex.: fez 16 anos na
 * Verde, que vai ate 15). `levelWord` vem do vocabulario da area.
 */
export function LevelChangeBadge({
  level,
  birthDate,
  levelWord,
}: {
  level?: ProgressionLevelStep | null;
  birthDate?: string;
  levelWord: string;
}) {
  const age = ageAt(birthDate, format(new Date(), "yyyy-MM-dd"));
  if (!level || !isAgedOutOfLevel(level, age)) return null;
  return (
    <span
      title={`${level.name} vale ${levelAgeLabel(level)}; o aluno tem ${age} anos.`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
    >
      <ArrowUpCircle className="size-3" aria-hidden />
      Trocar {levelWord.toLowerCase()}
    </span>
  );
}
