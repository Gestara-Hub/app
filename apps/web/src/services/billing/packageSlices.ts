import type { StudentPackageFilter } from "@gestarahub/contracts";
import type { MethodSlice } from "../world/slices";

/**
 * Recortes de pacotes (doc 19, fase 2): os pacotes do aluno (ou todos), com o
 * catalogo de pacotes e os alunos, sem o historico do espaco.
 */
export const packageSlices: Record<string, MethodSlice> = {
  listStudentPackages: async ([filter], load) => {
    const studentId = (filter as StudentPackageFilter | undefined)?.studentId;
    await Promise.all([
      load.all("lessonPackages"),
      load.all("classGroups"),
      load.all("categories"),
      studentId ? load.where("studentPackages", "studentId", [studentId]) : load.all("studentPackages"),
      studentId ? load.where("clients", "id", [studentId]) : load.all("clients"),
    ]);
  },
};
