import { getSegmentPreset } from "@/lib/business-segment-presets";
import { teamWordsFor, type TeamWords } from "@/lib/team-words";
import { store } from "@/services/world/store";

/**
 * Substantivos que mudam com o modelo do tenant, para mensagens e auditoria:
 * na academia (turmas) cliente e "aluno" e categoria e "modalidade".
 */
export function clientNoun(): string {
  return store.organization.model === "classes" ? "aluno" : "cliente";
}

export function categoryNoun(): string {
  return store.organization.model === "classes" ? "modalidade" : "categoria";
}

/** Como se chama quem dá aula neste espaço (instrutor, professor ou, no agendamento, profissional). */
export function teamWords(): TeamWords {
  const org = store.organization;
  return teamWordsFor(
    org.model === "classes",
    getSegmentPreset(org.classSegment, org.customSegmentProgression, org.customSegmentBilling).teacherTitle,
  );
}
