"use client";

import Link from "next/link";
import { ArrowUpCircle, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ageAt, isAgedOutOfLevel, resolveModalityTrack } from "@/lib/progression-tracks";
import { plural } from "@gestarahub/core/format";
import { useCategories } from "@/features/categories";
import { useClients } from "@/features/clients";
import { useSegmentVocabulary } from "@/features/settings";

/**
 * Alunos que passaram da idade do nivel atual (ex.: fizeram 16 anos na faixa
 * Verde, que vai ate 15) e precisam de um nivel da nova faixa etaria.
 */
export function LevelChangeAlert({ today }: { today: string }) {
  const vocabulary = useSegmentVocabulary();
  const { data: clients } = useClients({ status: "active" });
  const { data: categories } = useCategories({ status: "active" });
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));

  const pending: { id: string; name: string; levelName: string }[] = [];
  for (const client of clients ?? []) {
    const age = ageAt(client.birthDate, today);
    if (age === null) continue;
    for (const prog of Object.values(client.progressions ?? {})) {
      const category = categoryById.get(prog.modalityId);
      if (!category) continue;
      const track = resolveModalityTrack(category);
      if (!track.enabled) continue;
      const level = track.levels.find((l) => l.id === prog.levelId || l.name === prog.levelName);
      if (isAgedOutOfLevel(level, age)) {
        pending.push({ id: `${client.id}-${prog.modalityId}`, name: client.name, levelName: level!.name });
      }
    }
  }
  if (pending.length === 0) return null;

  const shown = pending.slice(0, 3);
  const rest = pending.length - shown.length;

  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3.5 sm:flex-row sm:items-center sm:px-4 sm:py-3">
      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400">
          <ArrowUpCircle className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {plural(pending.length, "aluno precisa", "alunos precisam")} trocar de{" "}
            {vocabulary.level.toLowerCase()} pela idade
          </p>
          <p className="text-xs text-muted-foreground">
            {shown.map((p) => `${p.name} (${p.levelName})`).join(", ")}
            {rest > 0 ? ` e mais ${rest}` : ""}.
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 shrink-0 gap-1.5 self-end text-xs sm:self-auto"
        asChild
      >
        <Link href="/clients">
          Ver alunos
          <ArrowUpRight className="size-3.5" />
        </Link>
      </Button>
    </div>
  );
}
