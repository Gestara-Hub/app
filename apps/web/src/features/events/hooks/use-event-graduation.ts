"use client";

import type { EventRegistrationView, EventView, PromotionCandidate, StudentPromotionHistoryEntry } from "@gestarahub/contracts";
import { usePromotionCandidates } from "@/features/clients";

/**
 * Evento de graduacao (doc product/30 §4): os inscritos confirmados com o
 * retrato da trilha (nivel, aulas, notas) e quem ja graduou neste evento.
 * Usado na aba Graduação e no repasse a federacao do Financeiro do evento.
 */
export function useEventGraduation(event: EventView, registrations: EventRegistrationView[] | undefined, enabled = true) {
  const confirmed = (registrations ?? []).filter((r) => r.status === "confirmed");
  const on = enabled && Boolean(event.graduation && event.modalityId);
  const query = usePromotionCandidates(
    event.modalityId,
    confirmed.map((r) => r.studentId),
    on,
  );
  const graduatedHere = (c: PromotionCandidate | undefined): StudentPromotionHistoryEntry | undefined =>
    c?.progression?.promotionHistory.find((h) => h.eventId === event.id);
  const candidates = query.data?.candidates ?? [];
  const graduatedCount = candidates.filter((c) => graduatedHere(c)).length;
  return { ...query, confirmed, candidates, graduatedHere, graduatedCount };
}
