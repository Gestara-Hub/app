import type {
  ApiErrorField,
  Assessment,
  AssessmentGrade,
  AssessmentView,
  Category,
  ClassGroup,
  GradeAverage,
  Id,
  ModalityAssessmentSettings,
} from "@gestarahub/contracts";
import {
  MAX_ASSESSMENT_NAME_LENGTH,
  averageGrades,
  assessmentsEnabled,
  validateWeight,
} from "@gestarahub/core/grades";
import { getCurrentActor } from "@/services/world/actor";
import { apiError, notFoundError } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { format, parseISO } from "date-fns";
import { can } from "@/lib/permissions";
import { resolveModalityTrack } from "@/lib/progression-tracks";

/**
 * Notas dos alunos (doc 21 §2.1, fase 1): avaliacoes da turma, lancamento por
 * avaliacao e boletim do aluno. As regras de escala, media e arredondamento
 * vem de `@gestarahub/core/grades`; aqui ficam a guarda (modalidade com
 * avaliacoes, aluno matriculado, permissao) e a auditoria.
 *
 * Permissao: `grades:manage` (dono, gerente e professor). O professor so mexe
 * nas turmas em que e o instrutor titular — escopo aplicado AQUI, no service,
 * como a API real faria. Leitura segue `classes:view` (guardada na tela).
 */

/**
 * Regras das avaliacoes: modalidade ligada, quem lanca, matriculados na data, validacao e medias.
 */

export const NOT_FOUND = "Avaliação não encontrada.";

export const CLASS_NOT_FOUND = "Turma não encontrada.";

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Colecao do tenant ativo (opcional no store: nasce no 1o uso, sem migracao). */
export function assessmentsStore(): Assessment[] {
  if (!store.assessments) store.assessments = [];
  return store.assessments;
}

export function findClass(classGroupId: Id): ClassGroup {
  const group = store.classGroups.find((g) => g.id === classGroupId);
  if (!group) throw notFoundError(CLASS_NOT_FOUND);
  return group;
}

export function findAssessment(id: Id): Assessment {
  const found = assessmentsStore().find((a) => a.id === id);
  if (!found) throw notFoundError(NOT_FOUND);
  return found;
}

export function modalityOf(modalityId: Id | undefined): Category | undefined {
  return modalityId ? store.categories.find((c) => c.id === modalityId) : undefined;
}

/** Configuracao ligada da modalidade, ou undefined. */
export function enabledSettings(modalityId: Id | undefined): ModalityAssessmentSettings | undefined {
  const settings = modalityOf(modalityId)?.assessments;
  return assessmentsEnabled(settings) ? settings : undefined;
}

export function requireSettings(group: ClassGroup): ModalityAssessmentSettings {
  const settings = enabledSettings(group.modalityId);
  if (!settings) {
    throw apiError("VALIDATION", "A modalidade desta turma não tem avaliações.", { httpStatus: 422 });
  }
  return settings;
}

/**
 * Quem esta logado pode lancar notas nesta turma? Sem ator (seed/scripts)
 * passa. Professor: so na turma em que e o instrutor titular.
 */
export function assertCanManage(group: ClassGroup): void {
  const actor = getCurrentActor();
  if (!actor) return;
  if (!can(actor.profile, "grades:manage")) {
    throw apiError("FORBIDDEN", "Você não tem permissão para lançar notas.", { httpStatus: 403 });
  }
  if (actor.profile !== "professional") return;
  const user = store.users.find((u) => u.id === actor.userId);
  if (!user?.professionalId || user.professionalId !== group.instructorId) {
    throw apiError("FORBIDDEN", "Você só lança notas nas suas turmas.", { httpStatus: 403 });
  }
}

export function actorId(): Id {
  return getCurrentActor()?.userId ?? "system";
}

export function activeEnrollments(classGroupId: Id) {
  return store.enrollments.filter((e) => e.classGroupId === classGroupId && e.status === "active");
}

/** Matriculados hoje que ja estavam na turma no dia da avaliacao (ALU-28). */
export function enrolledOnDate(classGroupId: Id, date: string) {
  return activeEnrollments(classGroupId).filter((e) => format(parseISO(e.enrolledAt), "yyyy-MM-dd") <= date);
}

export function studentName(studentId: Id): string {
  return store.clients.find((c) => c.id === studentId)?.name ?? "Aluno";
}

export function levelName(modalityId: Id, levelId?: string): string | undefined {
  if (!levelId) return undefined;
  const track = resolveModalityTrack(modalityOf(modalityId));
  return track.levels.find((l) => l.id === levelId)?.name;
}

export function validateLevel(modalityId: Id, levelId: string | undefined, fields: ApiErrorField[]): void {
  if (!levelId) return;
  const track = resolveModalityTrack(modalityOf(modalityId));
  if (!track.enabled || !track.levels.some((l) => l.id === levelId)) {
    fields.push({ field: "levelId", message: "Escolha uma etapa da trilha." });
  }
}

export function validateFields(
  payload: { name?: string; date?: string; weight?: unknown },
  partial: boolean,
  fields: ApiErrorField[],
): void {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  if (!partial || has("name")) {
    const name = payload.name?.trim() ?? "";
    if (!name) fields.push({ field: "name", message: "Informe o nome da avaliação." });
    else if (name.length > MAX_ASSESSMENT_NAME_LENGTH) {
      fields.push({ field: "name", message: `Use até ${MAX_ASSESSMENT_NAME_LENGTH} caracteres.` });
    }
  }
  if (!partial || has("date")) {
    if (!payload.date || !DATE_PATTERN.test(payload.date)) {
      fields.push({ field: "date", message: "Informe a data da avaliação." });
    } else if (payload.date > format(new Date(), "yyyy-MM-dd")) {
      fields.push({ field: "date", message: "A avaliação não pode ter data futura." });
    }
  }
  if (payload.weight !== undefined) {
    const check = validateWeight(payload.weight);
    if (!check.ok) fields.push({ field: "weight", message: check.message });
  }
}

/** Notas dos matriculados de hoje (as de quem saiu ficam guardadas, fora da conta). */
export function enrolledGrades(a: Assessment): AssessmentGrade[] {
  const enrolled = new Set(activeEnrollments(a.classGroupId).map((e) => e.studentId));
  return a.grades.filter((g) => enrolled.has(g.studentId));
}

export function toView(a: Assessment, settings: ModalityAssessmentSettings | undefined): AssessmentView {
  const { grades: _grades, ...rest } = a;
  void _grades;
  const grades = enrolledGrades(a);
  return {
    ...rest,
    levelName: levelName(a.modalityId, a.levelId),
    gradedCount: grades.filter((g) => g.status !== "none").length,
    enrolledCount: activeEnrollments(a.classGroupId).length,
    average: settings
      ? averageGrades(
          settings,
          grades.map((g) => ({ status: g.status, value: g.value, weight: 1 })),
        )
      : null,
  };
}

export function sortAssessments(list: Assessment[]): Assessment[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** Media geral do aluno nas avaliacoes dadas (ponderada). */
export function studentAverage(
  settings: ModalityAssessmentSettings,
  assessments: Assessment[],
  studentId: Id,
): GradeAverage | null {
  return averageGrades(
    settings,
    assessments.map((a) => {
      const grade = a.grades.find((g) => g.studentId === studentId);
      return { status: grade?.status ?? "none", value: grade?.value, weight: a.weight };
    }),
  );
}

export function className(classGroupId: Id): string {
  return store.classGroups.find((g) => g.id === classGroupId)?.name ?? "Turma";
}
