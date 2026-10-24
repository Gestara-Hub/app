import type { ClassGroup, Id } from "@gestarahub/contracts";
import { can } from "@/lib/permissions";
import { getCurrentActor } from "@/services/world/actor";
import { apiError } from "@/services/world/ops";
import { store } from "@/services/world/store";

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

function forbidden(message: string) {
  return apiError("FORBIDDEN", message, { httpStatus: 403 });
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
    const g = store.classGroups.find((x) => x.id === opts.classGroupId);
    if (g && teacherSeesSession(g, opts.sessionId, teacherId)) return;
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
