import type { Id } from "@gestarahub/contracts";
import { classWithStudents } from "../classes/classSlices";
import { oneStudent } from "../clients/clientSlices";
import type { MethodSlice } from "../world/slices";

/**
 * Recortes das avaliacoes (doc 19, fase 2): as avaliacoes da turma, com a
 * turma e os seus alunos; o boletim, o aluno e as avaliacoes (as notas de
 * cada aluno ficam dentro da avaliacao, sem coluna para filtrar).
 */
export const gradeSlices: Record<string, MethodSlice> = {
  listClassAssessments: async ([id], load) => {
    await classWithStudents(id as Id, load);
    await load.where("assessments", "classGroupId", [id as Id]);
  },
  getReportCard: async ([id], load) => {
    await oneStudent(id as Id, load);
    await load.all("assessments");
  },
};
