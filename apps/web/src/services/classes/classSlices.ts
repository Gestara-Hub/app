import type { ClassGroup, DateISO, Id } from "@gestarahub/contracts";
import { meetingSlotsOn, weekdayOf } from "@gestarahub/core/scheduling";
import type { MethodSlice, SliceLoader } from "../world/slices";
import { datesBetween, makeSessionId, parseSessionId } from "./classShared";

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
  const [, charges] = await Promise.all([
    load.where("clients", "id", students),
    load.where("charges", "studentId", students),
    load.where("studentPackages", "studentId", students),
  ]);
  // Pix e links das cobrancas: sair da aula avulsa cancela o codigo enviado.
  await load.where("onlinePayments", "chargeId", charges.map((c) => c.id as string));
  load.none("auditLog");
}

/**
 * Uma turma: matriculas e lista de espera dela, com os alunos. As substituicoes
 * (poucas) dizem se o professor que nao e o titular ve a lista da turma.
 */
async function classGroup(classGroupId: Id, load: SliceLoader): Promise<void> {
  await catalog(load);
  const [enrollments, waitlist] = await Promise.all([
    load.where("enrollments", "classGroupId", [classGroupId]),
    load.where("waitlist", "classGroupId", [classGroupId]),
    load.all("sessionOverrides"),
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

/** Ids das aulas das turmas entre duas datas (todas as turmas ou so uma). */
export function sessionIdsInRange(groups: ClassGroup[], dateFrom: DateISO, dateTo: DateISO, classGroupId?: Id): Id[] {
  const ids: Id[] = [];
  for (const date of datesBetween(dateFrom, dateTo)) {
    const wd = weekdayOf(date);
    for (const g of groups) {
      if (classGroupId && g.id !== classGroupId) continue;
      for (const slot of meetingSlotsOn(g, date)) if (slot.weekday === wd) ids.push(makeSessionId(g.id, date, slot.start));
    }
  }
  return ids;
}

/** Aulas de um periodo: as turmas e, dessas aulas, marcacoes, reservas e substituicoes. */
async function sessionsInRange(filter: { classGroupId?: Id; dateFrom: DateISO; dateTo: DateISO }, load: SliceLoader): Promise<void> {
  await catalog(load);
  const groups = (await load.all("classGroups")) as unknown as ClassGroup[];
  const ids = sessionIdsInRange(groups, filter.dateFrom, filter.dateTo, filter.classGroupId);
  await Promise.all([
    load.all("enrollments"),
    load.all("clients"),
    load.all("studentPackages"),
    load.all("sessionOverrides"),
    load.where("attendances", "sessionId", ids),
    load.where("reservations", "sessionId", ids),
  ]);
}

/**
 * Uma turma com os seus alunos (matriculados e na espera): o historico deles
 * (presencas, cobrancas, pacotes, reservas, Pix e links), nao o do espaco.
 */
export async function classWithStudents(classGroupId: Id, load: SliceLoader): Promise<void> {
  await catalog(load);
  // Reservas e cobrancas da turma (avulsas de aulas futuras de quem nao e matriculado).
  const [enrollments, waitlist, reservations] = await Promise.all([
    load.where("enrollments", "classGroupId", [classGroupId]),
    load.where("waitlist", "classGroupId", [classGroupId]),
    load.where("reservations", "classGroupId", [classGroupId]),
    load.where("charges", "classGroupId", [classGroupId]),
    load.all("sessionOverrides"),
  ]);
  const students = [...enrollments, ...waitlist, ...reservations].map((row) => row.studentId as string);
  const [, , charges] = await Promise.all([
    load.where("clients", "id", students),
    load.where("attendances", "studentId", students),
    load.where("charges", "studentId", students),
    load.where("studentPackages", "studentId", students),
    load.where("reservations", "studentId", students),
    load.where("enrollments", "studentId", students),
  ]);
  const classCharges = (await load.where("charges", "classGroupId", [classGroupId])) as { id: string }[];
  await load.where("onlinePayments", "chargeId", [...charges, ...classCharges].map((c) => c.id as string));
  load.none("auditLog");
}

/** Turma de uma linha (matricula, lista de espera) pelo id da linha. */
function classOfRow(key: "enrollments" | "waitlist"): MethodSlice {
  return async ([id], load) => {
    const [row] = await load.where(key, "id", [id as Id]);
    if (row) await classWithStudents(row.classGroupId as Id, load);
    else await catalog(load);
  };
}

/** Lista de turmas: o catalogo, as matriculas e a lista de espera (sem o historico). */
const classList: MethodSlice = async (_args, load) => {
  await catalog(load);
  await Promise.all([load.all("enrollments"), load.all("waitlist"), load.all("clients")]);
};

export const classSlices: Record<string, MethodSlice> = {
  listSessions: async ([filter], load) => sessionsInRange(filter as { classGroupId?: Id; dateFrom: DateISO; dateTo: DateISO }, load),
  list: classList,
  getSession: sessionOf,
  markAttendance: sessionOfInput,
  markManyAttendance: sessionOfInput,
  clearAttendance: sessionOfInput,
  reserveSession: sessionWithStudent,
  cancelReservation: sessionWithStudent,
  // Professor ocupado: confere as substituicoes de todas as turmas no mesmo dia (sao poucas).
  substituteInstructor: async ([id], load) => {
    await session(id as Id, load);
    await load.all("sessionOverrides");
  },
  restorePrimaryInstructor: sessionOf,
  getById: async ([id], load) => classGroup(id as Id, load),
  listWaitlist: async ([id], load) => classGroup(id as Id, load),
  listEnrollments: async ([id], load) => classWithStudents(id as Id, load),
  deactivate: async ([id], load) => classWithStudents(id as Id, load),
  reactivate: async ([id], load) => classWithStudents(id as Id, load),
  setEnrollmentPayment: classOfRow("enrollments"),
  // Frequencia do aluno no curso: a turma da matricula e os seus alunos.
  // Emitir grava o certificado (doc 21 §1.3): o recorte traz o ja emitido da matricula.
  getCourseCertificate: async ([id], load) => {
    await classOfRow("enrollments")([id], load);
    await load.where("issuedCertificates", "enrollmentId", [id as Id]);
  },
  // Previa do editor com um aluno real: lista dos concluidos (turmas, matriculas, alunos) e os dados de um.
  listCompletedEnrollments: classList,
  previewCourseCertificate: async ([id], load) => {
    await classOfRow("enrollments")([id], load);
    await load.where("issuedCertificates", "enrollmentId", [id as Id]);
  },
  // Emissao em lote (doc 21 §1.4): a turma com os alunos e os certificados ja emitidos dela.
  issueCourseCertificates: async ([id], load) => {
    await classWithStudents(id as Id, load);
    await load.where("issuedCertificates", "classGroupId", [id as Id]);
  },
  cancelCertificate: async ([id], load) => {
    await catalog(load);
    await load.where("issuedCertificates", "enrollmentId", [id as Id]);
  },
  promoteFromWaitlist: classOfRow("waitlist"),
  removeFromWaitlist: classOfRow("waitlist"),
};
