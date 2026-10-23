import type { Id } from "@gestarahub/contracts";
import type { MethodSlice, SliceLoader } from "../world/slices";
import { parseSessionId } from "./classShared";

/**
 * Recortes dos metodos de turmas (doc 19, fase 2): a aula e a chamada leem so
 * a turma da aula, as matriculas dela, as marcacoes daquela aula e os alunos
 * envolvidos, em vez do historico inteiro do espaco. Conferidos nos testes
 * contra o espaco inteiro (`WORLD_SLICE_CHECK=1`).
 */

/** Catalogo pequeno do espaco (nao cresce com o tempo). */
async function catalog(load: SliceLoader): Promise<void> {
  await Promise.all([
    load.all("classGroups"),
    load.all("categories"),
    load.all("professionals"),
    load.all("users"),
    load.all("plans"),
    load.all("lessonPackages"),
  ]);
}

/** Tudo de uma aula: matriculas da turma, marcacoes, reservas, substituicao e os alunos. */
async function session(sessionId: Id, load: SliceLoader): Promise<void> {
  const parsed = parseSessionId(sessionId);
  await catalog(load);
  if (!parsed) return;
  const [enrollments, attendances, reservations, packages] = await Promise.all([
    load.where("enrollments", "classGroupId", [parsed.classGroupId]),
    load.where("attendances", "sessionId", [sessionId]),
    load.where("reservations", "sessionId", [sessionId]),
    // Pacotes em uso: candidatos a entrar na aula pelo pacote.
    load.where("studentPackages", "status", ["active"]),
    load.where("sessionOverrides", "sessionId", [sessionId]),
  ]);
  const students = [
    ...enrollments.map((e) => e.studentId),
    ...attendances.map((a) => a.studentId),
    ...reservations.map((r) => r.studentId),
    ...packages.map((p) => p.studentId),
  ] as string[];
  // Todos os pacotes dos alunos (desmarcar devolve a aula a um pacote que ja tinha acabado).
  await Promise.all([
    load.where("clients", "id", students),
    load.where("charges", "studentId", students),
    load.where("studentPackages", "studentId", students),
  ]);
  load.none("auditLog");
}

const sessionOf: MethodSlice = async ([id], load) => session(id as Id, load);
const sessionOfInput: MethodSlice = async ([input], load) => session((input as { sessionId: Id }).sessionId, load);

export const classSlices: Record<string, MethodSlice> = {
  getSession: sessionOf,
  markAttendance: sessionOfInput,
  markManyAttendance: sessionOfInput,
  clearAttendance: sessionOfInput,
};
