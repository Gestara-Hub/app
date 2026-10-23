import type { Id, ReportCardEntry, ReportCardModality, StudentReportCard } from "@gestarahub/contracts";
import { averageGrades, averagesByLevel, isBelowPassing } from "@gestarahub/core/grades";
import { notFoundError, readOp } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { resolveModalityTrack } from "@/lib/progression-tracks";
import {
  clone,
  assessmentsStore,
  enabledSettings,
  levelName,
  sortAssessments,
  className,
} from "./gradeRules";

/** Boletim do aluno por modalidade (notas, medias por etapa e geral). */
export const reportCardService = {
  /**
   * Boletim "Notas" do aluno, por modalidade com avaliacoes ligadas: as
   * avaliacoes das turmas em que esta matriculado (ou em que ja tem nota),
   * media por etapa da trilha e geral.
   */
  getReportCard(studentId: Id): Promise<StudentReportCard> {
    return readOp(async () => {
      const student = store.clients.find((c) => c.id === studentId);
      if (!student) throw notFoundError("Aluno não encontrado.");
      const activeClassIds = new Set(
        store.enrollments.filter((e) => e.studentId === studentId && e.status === "active").map((e) => e.classGroupId),
      );
      const relevant = assessmentsStore().filter(
        (a) => activeClassIds.has(a.classGroupId) || a.grades.some((g) => g.studentId === studentId),
      );
      // Modalidades ligadas em que o aluno tem turma ativa ou alguma avaliacao.
      const modalityIds = new Set<Id>(relevant.map((a) => a.modalityId));
      for (const classId of activeClassIds) {
        const modalityId = store.classGroups.find((g) => g.id === classId)?.modalityId;
        if (modalityId) modalityIds.add(modalityId);
      }

      const modalities: ReportCardModality[] = [];
      for (const category of [...store.categories].sort((a, b) => a.position - b.position)) {
        if (!modalityIds.has(category.id)) continue;
        const settings = enabledSettings(category.id);
        if (!settings) continue;
        const track = resolveModalityTrack(category);
        const list = sortAssessments(relevant.filter((a) => a.modalityId === category.id));
        const entries: ReportCardEntry[] = list.map((a) => {
          const grade = a.grades.find((g) => g.studentId === studentId);
          const status = grade?.status ?? "none";
          return {
            assessmentId: a.id,
            name: a.name,
            date: a.date,
            weight: a.weight,
            classGroupId: a.classGroupId,
            classGroupName: className(a.classGroupId),
            ...(a.levelId ? { levelId: a.levelId, levelName: levelName(category.id, a.levelId) } : {}),
            status,
            ...(grade?.value !== undefined ? { value: grade.value } : {}),
            belowPassing:
              status === "graded" && grade?.value !== undefined
                ? isBelowPassing(settings.scale, grade.value, settings.passingGrade)
                : false,
          };
        });
        const weighted = entries.map((e) => ({ levelId: e.levelId, status: e.status, value: e.value, weight: e.weight }));
        const levelOrder = track.enabled ? track.levels.map((l) => l.id) : [];
        modalities.push({
          modalityId: category.id,
          modalityName: category.name,
          settings,
          entries,
          levels: averagesByLevel(settings, weighted, levelOrder).map((row) => ({
            ...(row.levelId ? { levelId: row.levelId, levelName: levelName(category.id, row.levelId) } : {}),
            average: row.average,
          })),
          overall: averageGrades(settings, weighted),
        });
      }
      return clone({ studentId, studentName: student.name, modalities });
    });
  },
};
