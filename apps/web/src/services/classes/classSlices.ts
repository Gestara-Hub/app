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
async function session(sessionId: Id, load: SliceLoader, extraStudents: Id[] = []): Promise<void> {
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
    ...extraStudents,
  ] as string[];
  // Todos os pacotes dos alunos (desmarcar devolve a aula a um pacote que ja tinha acabado).
  await Promise.all([
    load.where("clients", "id", students),
    load.where("charges", "studentId", students),
    load.where("studentPackages", "studentId", students),
  ]);
  load.none("auditLog");
}

/** Uma turma: matriculas e lista de espera dela, com os alunos. */
async function classGroup(classGroupId: Id, load: SliceLoader): Promise<void> {
  await catalog(load);
  const [enrollments, waitlist] = await Promise.all([
    load.where("enrollments", "classGroupId", [classGroupId]),
    load.where("waitlist", "classGroupId", [classGroupId]),
  ]);
  await load.where("clients", "id", [...enrollments, ...waitlist].map((row) => row.studentId as string));
  load.none("auditLog");
}

const sessionOf: MethodSlice = async ([id], load) => session(id as Id, load);
const sessionOfInput: MethodSlice = async ([input], load) => session((input as { sessionId: Id }).sessionId, load);
/** Aula com um aluno que ainda nao esta nela (reservar, cancelar reserva). */
const sessionWithStudent: MethodSlice = async ([input], load) => {
  const { sessionId, studentId } = input as { sessionId: Id; studentId: Id };
  return session(sessionId, load, [studentId]);
};

export const classSlices: Record<string, MethodSlice> = {
  getSession: sessionOf,
  markAttendance: sessionOfInput,
  markManyAttendance: sessionOfInput,
  clearAttendance: sessionOfInput,
  reserveSession: sessionWithStudent,
  cancelReservation: sessionWithStudent,
  cancelReserva: sessionWithStudent,
  // Professor ocupado: confere as substituicoes de todas as turmas no mesmo dia (sao poucas).
  substituteInstructor: async ([id], load) => {
    await session(id as Id, load);
    await load.all("sessionOverrides");
  },
  restorePrimaryInstructor: sessionOf,
  getById: async ([id], load) => classGroup(id as Id, load),
  listWaitlist: async ([id], load) => classGroup(id as Id, load),
};
