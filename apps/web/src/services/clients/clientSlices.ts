import type { Id } from "@gestarahub/contracts";
import type { MethodSlice, SliceLoader } from "../world/slices";

/**
 * Recortes dos metodos de alunos (doc 19, fase 2). A lista de alunos so le o
 * cadastro dos alunos (sem presencas, cobrancas ou mensagens); o resumo da
 * ficha le so o que e daquele aluno.
 */
const clientsOnly: MethodSlice = async (_args, load) => {
  await load.all("clients");
};

/** Tudo de um aluno: cadastro, matriculas, presencas, cobrancas, pacotes, mensagens e reservas. */
export async function oneStudent(studentId: Id, load: SliceLoader): Promise<void> {
  await Promise.all([
    load.all("classGroups"),
    load.all("categories"),
    load.all("professionals"),
    load.all("plans"),
    load.all("lessonPackages"),
    load.all("users"),
    load.where("clients", "id", [studentId]),
    load.where("enrollments", "studentId", [studentId]),
    load.where("attendances", "studentId", [studentId]),
    load.where("charges", "studentId", [studentId]),
    load.where("studentPackages", "studentId", [studentId]),
    load.where("messageLogs", "clientId", [studentId]),
    load.where("reservations", "studentId", [studentId]),
  ]);
  load.none("auditLog");
}

/** Certificado de graduacao (doc 21 §1.6): o aluno inteiro e o certificado ja emitido do registro. */
async function graduationCertificate([studentId, promotionId]: unknown[], load: SliceLoader): Promise<void> {
  await oneStudent(studentId as Id, load);
  await load.where("issuedCertificates", "promotionId", [promotionId as Id]);
}

export const clientSlices: Record<string, MethodSlice> = {
  list: clientsOnly,
  listPaginated: clientsOnly,
  // Previa do editor com uma graduacao real: todos os alunos (historico), turmas e matriculas (recorte do professor).
  listGraduations: async (_args, load) => {
    await Promise.all([load.all("clients"), load.all("categories"), load.all("classGroups"), load.all("enrollments")]);
  },
  previewGraduationCertificate: graduationCertificate,
  getGraduationCertificate: graduationCertificate,
  cancelGraduationCertificate: graduationCertificate,
};

export const studentSummarySlices: Record<string, MethodSlice> = {
  getStudentSummary: async ([id], load) => oneStudent(id as Id, load),
};
