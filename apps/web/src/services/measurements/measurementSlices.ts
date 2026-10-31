import type { Id } from "@gestarahub/contracts";
import { oneStudent } from "../clients/clientSlices";
import type { MethodSlice } from "../world/slices";

/** Recorte da leitura (doc 19, fase 2): o aluno e as avaliacoes dele. */
export const measurementSlices: Record<string, MethodSlice> = {
  getStudentMeasurements: async ([id], load) => {
    await oneStudent(id as Id, load);
    await load.where("studentMeasurements", "studentId", [id as Id]);
  },
};
