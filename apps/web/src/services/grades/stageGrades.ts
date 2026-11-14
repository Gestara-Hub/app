import type { DateISO, Id, ModalityProgressionTrack, StudentStageGrades } from "@gestarahub/contracts";
import { resultOf } from "@gestarahub/core/grades";
import { assessmentsStore, effectiveItems, enabledSettings, modalityAttendancePercent } from "./gradeRules";

/**
 * Notas do aluno na etapa atual da trilha, para o "Apto" (doc product/30 §1).
 *
 * Entram as avaliacoes da modalidade marcadas com o nivel atual e as sem
 * etapa (ou de etapa que saiu da trilha) desde a ultima graduacao, cada uma
 * com a melhor recuperacao. Sem avaliacoes ligadas na modalidade: undefined.
 */
export function studentStageGrades(
  modalityId: Id,
  studentId: Id,
  track: ModalityProgressionTrack,
  stage: { levelId?: string; since?: DateISO },
): StudentStageGrades | undefined {
  const settings = enabledSettings(modalityId);
  if (!settings) return undefined;
  const known = new Set(track.levels.map((l) => l.id));
  const all = assessmentsStore().filter((a) => a.modalityId === modalityId);
  const originals = all.filter((a) => {
    if (a.recoveryOf) return false;
    if (a.levelId && known.has(a.levelId)) return a.levelId === stage.levelId;
    return !stage.since || a.date >= stage.since;
  });
  const ids = new Set(originals.map((a) => a.id));
  const recoveries = all.filter((a) => a.recoveryOf && ids.has(a.recoveryOf));
  return {
    settings,
    // Graduar fecha a etapa: na soma dos pontos, o total contra o minimo (nao o ritmo).
    average: resultOf(settings, effectiveItems(settings, [...originals, ...recoveries], studentId), { closed: true }),
    attendancePercent: settings.minAttendancePercent ? modalityAttendancePercent(modalityId, studentId) : null,
  };
}
