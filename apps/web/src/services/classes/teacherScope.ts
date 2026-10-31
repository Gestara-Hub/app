import type { ClassGroup, Id } from "@gestarahub/contracts";
import { can } from "@/lib/permissions";
import { getCurrentActor } from "@/services/world/actor";
import { apiError } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { parseSessionId } from "./classShared";

/**
 * Escopo do professor (decisao de 18/10/2026): ve e age (chamada, registros,
 * graduacao, notas) so nas turmas em que e o titular e nas aulas em que foi
 * posto como substituto ("Trocar instrutor"). Os outros perfis veem tudo.
 */

/** Id que nao casa com ninguem: professor sem vinculo com a equipe ve nada. */
const UNLINKED = "__unlinked-professional__";

/**
 * Professor logado: o id dele na equipe. `undefined` para os outros perfis e
 * sem ator (scripts e testes de service): sem escopo.
 */
export function actorTeacherId(): Id | undefined {
  const actor = getCurrentActor();
  if (!actor || actor.profile !== "professional") return undefined;
  return store.users.find((u) => u.id === actor.userId)?.professionalId || UNLINKED;
}

function substituteOf(sessionId: Id): Id | undefined {
  return (store.sessionOverrides ?? []).find((o) => o.sessionId === sessionId)?.instructorId;
}

/** O professor ve a turma: e o titular dela. */
export function teacherSeesClass(g: Pick<ClassGroup, "instructorId">, teacherId = actorTeacherId()): boolean {
  return teacherId === undefined || g.instructorId === teacherId;
}

/** O professor ve e age na aula: titular da turma ou substituto desta aula. */
export function teacherSeesSession(
  g: Pick<ClassGroup, "instructorId">,
  sessionId: Id,
  teacherId = actorTeacherId(),
): boolean {
  return teacherId === undefined || g.instructorId === teacherId || substituteOf(sessionId) === teacherId;
}

/** O professor da aula ao aluno: matricula ativa em turma em que e o titular. */
export function teacherTeachesStudent(studentId: Id, teacherId = actorTeacherId()): boolean {
  if (teacherId === undefined) return true;
  return store.enrollments.some(
    (e) =>
      e.studentId === studentId &&
      e.status === "active" &&
      store.classGroups.some((g) => g.id === e.classGroupId && g.instructorId === teacherId),
  );
}

/**
 * Alunos que o professor ve na lista e na busca por id (auditoria de 30/10/2026:
 * antes a lista trazia todos os alunos do espaco, com CPF, para o professor):
 * matriculados nas turmas em que e titular ou em que substitui alguma aula, e
 * quem reservou aula avulsa nelas. `undefined` para os outros perfis: sem recorte.
 */
export function teacherStudentIds(teacherId = actorTeacherId()): Set<Id> | undefined {
  if (teacherId === undefined) return undefined;
  const classIds = new Set(store.classGroups.filter((g) => g.instructorId === teacherId).map((g) => g.id));
  for (const o of store.sessionOverrides ?? []) {
    if (o.instructorId !== teacherId) continue;
    const parsed = parseSessionId(o.sessionId);
    if (parsed) classIds.add(parsed.classGroupId);
  }
  const ids = new Set<Id>();
  for (const e of store.enrollments) if (classIds.has(e.classGroupId) && e.status === "active") ids.add(e.studentId);
  for (const r of store.reservations ?? []) if (classIds.has(r.classGroupId)) ids.add(r.studentId);
  return ids;
}

function forbidden(message: string) {
  return apiError("FORBIDDEN", message, { httpStatus: 403 });
}

/**
 * Leitura de um aluno (ficha, notas, testes e medidas): o professor so le os
 * alunos das turmas em que e o titular. Os outros perfis leem todos.
 */
export function assertTeacherSeesStudent(studentId: Id, message = "Você só vê os alunos das suas turmas."): void {
  const teacherId = actorTeacherId();
  if (teacherId !== undefined && !teacherTeachesStudent(studentId, teacherId)) throw forbidden(message);
}

/**
 * O professor ve a lista da turma (matriculas, espera): titular ou substituto
 * de alguma aula dela.
 */
export function teacherSeesClassRoster(g: Pick<ClassGroup, "id" | "instructorId">, teacherId = actorTeacherId()): boolean {
  if (teacherId === undefined || g.instructorId === teacherId) return true;
  return (store.sessionOverrides ?? []).some(
    (o) => o.instructorId === teacherId && parseSessionId(o.sessionId)?.classGroupId === g.id,
  );
}

/** Leitura de uma turma (avaliacoes, lancamento de notas): o professor so a dele. */
export function assertTeacherSeesClass(g: Pick<ClassGroup, "instructorId">, message = "Você só vê as suas turmas."): void {
  if (!teacherSeesClass(g)) throw forbidden(message);
}

/** Chamada e registro da aula: so o titular ou o substituto dela. */
export function assertTeacherSession(g: Pick<ClassGroup, "instructorId">, sessionId: Id): void {
  if (!teacherSeesSession(g, sessionId)) throw forbidden("Você só faz a chamada nas suas aulas.");
}

/**
 * Evolucao do aluno (graduar, registros, metas, pontos fortes): pede
 * `progression:manage`. O professor, so em aluno de turma dele (titular) na
 * modalidade ou, com `sessionId`, na aula em que deu a aula.
 */
export function assertCanManageProgression(
  studentId: Id,
  opts: { modalityId?: Id; classGroupId?: Id; sessionId?: Id } = {},
): void {
  const actor = getCurrentActor();
  if (!actor) return;
  if (!can(actor.profile, "progression:manage")) {
    throw forbidden("Você não tem permissão para mexer na evolução dos alunos.");
  }
  const teacherId = actorTeacherId();
  if (teacherId === undefined) return;
  if (opts.sessionId && opts.classGroupId) {
    // Pela aula (substituto incluido): so aluno daquela turma (matriculado ou com
    // reserva na aula) e na modalidade dela. Antes qualquer aluno passava por
    // aqui (revisao geral de 31/10/2026, achado S2).
    const g = store.classGroups.find((x) => x.id === opts.classGroupId);
    const sessionId = opts.sessionId;
    const inClass =
      g !== undefined &&
      (store.enrollments.some((e) => e.studentId === studentId && e.classGroupId === g.id) ||
        (store.reservations ?? []).some(
          (r) => r.studentId === studentId && r.classGroupId === g.id && r.sessionId === sessionId,
        ));
    const sameModality = !opts.modalityId || g?.modalityId === opts.modalityId;
    if (g && inClass && sameModality && teacherSeesSession(g, sessionId, teacherId)) return;
  }
  const teaches = store.enrollments.some(
    (e) =>
      e.studentId === studentId &&
      e.status === "active" &&
      store.classGroups.some(
        (g) =>
          g.id === e.classGroupId &&
          g.instructorId === teacherId &&
          (!opts.modalityId || g.modalityId === opts.modalityId),
      ),
  );
  if (!teaches) throw forbidden("Você só mexe na evolução dos alunos das suas turmas.");
}
