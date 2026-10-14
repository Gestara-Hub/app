"use client";

import type { Client, ModalityProgressionTrack } from "@gestarahub/contracts";
import { ageAt, isAgedOutOfLevel, resolveModalityTrack } from "@/lib/progression-tracks";
import { useCategories } from "@/features/categories";
import { useClients } from "@/features/clients";
import { useEnrolledModalities } from "@/features/turmas";

export interface LevelChangePending {
  key: string;
  client: Client;
  modalityId: string;
  modalityName: string;
  levelName: string;
  /** Trilha da modalidade: define as palavras do item (Graduar ou Avançar). */
  track: ModalityProgressionTrack;
}

/**
 * Alunos que passaram da idade do nivel atual (ex.: fizeram 16 anos na faixa
 * Verde, que vai ate 15) e precisam de um nivel da nova faixa etaria. So conta
 * modalidade em que o aluno esta matriculado (e a Graduacao consegue abrir).
 */
export function useLevelChangePending(today: string): LevelChangePending[] {
  const { data: clients } = useClients({ status: "active" });
  const { data: categories } = useCategories({ status: "active" });
  const { data: enrolled } = useEnrolledModalities();
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const enrolledKeys = new Set((enrolled ?? []).map((e) => `${e.studentId}~${e.modalityId}`));

  const pending: LevelChangePending[] = [];
  for (const client of clients ?? []) {
    const age = ageAt(client.birthDate, today);
    if (age === null) continue;
    for (const prog of Object.values(client.progressions ?? {})) {
      const category = categoryById.get(prog.modalityId);
      if (!category || !enrolledKeys.has(`${client.id}~${prog.modalityId}`)) continue;
      const track = resolveModalityTrack(category);
      if (!track.enabled) continue;
      const level = track.levels.find((l) => l.id === prog.levelId || l.name === prog.levelName);
      if (level && isAgedOutOfLevel(level, age)) {
        pending.push({
          key: `${client.id}-${prog.modalityId}`,
          client,
          modalityId: prog.modalityId,
          modalityName: category.name,
          levelName: level.name,
          track,
        });
      }
    }
  }
  return pending;
}
