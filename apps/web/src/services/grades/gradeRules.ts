import type {
  ApiErrorField,
  Assessment,
  AssessmentGrade,
  AssessmentGradeStatus,
  AssessmentView,
  Category,
  ClassGroup,
  GradeAverage,
  GradeValue,
  Id,
  ModalityAssessmentSettings,
} from "@gestarahub/contracts";
import {
  MAX_ASSESSMENT_NAME_LENGTH,
  assessmentAverage,
  assessmentsEnabled,
  resultOf,
  scaleMax,
  usesPointsSum,
  validatePoints,
  validateWeight,
  withRecovery,
  type LevelGrade,
} from "@gestarahub/core/grades";
import { attendancePercent } from "@gestarahub/core/certificate";
import { SEP } from "../classes/classShared";
import { teacherSeesClass } from "../classes/teacherScope";
import { getCurrentActor } from "@/services/world/actor";
import { apiError, notFoundError } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { can } from "@/lib/permissions";
import { resolveModalityTrack } from "@/lib/progression-tracks";
import { dateInSpace } from "@gestarahub/core/date";

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
  if (!teacherSeesClass(group)) {
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
  return activeEnrollments(classGroupId).filter((e) => dateInSpace(e.enrolledAt) <= date);
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
    } else if (payload.date > dateInSpace()) {
      fields.push({ field: "date", message: "A avaliação não pode ter data futura." });
    }
  }
  if (payload.weight !== undefined) {
    const check = validateWeight(payload.weight);
    if (!check.ok) fields.push({ field: "weight", message: check.message });
  }
}

/**
 * Pontos e recuperacao da avaliacao (fase A, 31/10/2026). Na soma, a avaliacao
 * que nao e recuperacao precisa dizer quanto vale. A recuperacao aponta uma
 * avaliacao da mesma turma que nao seja recuperacao, e herda os pontos dela.
 */
export function validatePointsAndRecovery(
  settings: ModalityAssessmentSettings,
  classGroupId: Id,
  payload: { points?: unknown; recoveryOf?: Id | null },
  current: Assessment | undefined,
  fields: ApiErrorField[],
): void {
  const recoveryOf = payload.recoveryOf === undefined ? current?.recoveryOf : payload.recoveryOf || undefined;
  if (recoveryOf) {
    const original = assessmentsStore().find((a) => a.id === recoveryOf);
    if (!original || original.classGroupId !== classGroupId || original.id === current?.id) {
      fields.push({ field: "recoveryOf", message: "Escolha uma avaliação desta turma." });
    } else if (original.recoveryOf) {
      fields.push({ field: "recoveryOf", message: "Escolha uma avaliação que não seja recuperação." });
    } else if (current && assessmentsStore().some((a) => a.recoveryOf === current.id)) {
      fields.push({ field: "recoveryOf", message: "Esta avaliação já tem recuperação." });
    }
    return;
  }
  if (!usesPointsSum(settings)) return;
  const points = payload.points === undefined ? current?.points : payload.points;
  const check = validatePoints(settings.scale, points);
  if (!check.ok) fields.push({ field: "points", message: check.message });
}

/** Quanto a avaliacao vale na soma (a recuperacao herda da recuperada); fora da soma, nada. */
export function pointsOf(settings: ModalityAssessmentSettings, a: Assessment): number | undefined {
  if (!usesPointsSum(settings)) return undefined;
  const source = a.recoveryOf ? (assessmentsStore().find((o) => o.id === a.recoveryOf) ?? a) : a;
  return source.points ?? scaleMax(settings.scale);
}

/** Nome da avaliacao recuperada. */
export function recoveryOfName(a: Assessment): string | undefined {
  return a.recoveryOf ? assessmentsStore().find((o) => o.id === a.recoveryOf)?.name : undefined;
}

/**
 * Notas que valem para o aluno: uma por avaliacao que nao e recuperacao, ja
 * com a melhor recuperacao dela (a maior nota). Com o peso, os pontos e a etapa.
 */
export function effectiveItems(
  settings: ModalityAssessmentSettings,
  assessments: Assessment[],
  studentId: Id,
): (LevelGrade & { assessmentId: Id; recovered: boolean })[] {
  const gradeOf = (a: Assessment): { status: AssessmentGradeStatus; value?: GradeValue } => {
    const g = a.grades.find((x) => x.studentId === studentId);
    return { status: g?.status ?? "none", value: g?.value };
  };
  const out: (LevelGrade & { assessmentId: Id; recovered: boolean })[] = [];
  for (const a of assessments) {
    if (a.recoveryOf) continue;
    let effective: { status: AssessmentGradeStatus; value?: GradeValue; recovered: boolean } = {
      ...gradeOf(a),
      recovered: false,
    };
    for (const r of assessments.filter((x) => x.recoveryOf === a.id)) {
      const next = withRecovery(settings.scale, effective, gradeOf(r));
      effective = { ...next, recovered: effective.recovered || next.recovered };
    }
    out.push({
      assessmentId: a.id,
      status: effective.status,
      value: effective.value,
      recovered: effective.recovered,
      weight: a.weight,
      points: pointsOf(settings, a),
      levelId: a.levelId,
    });
  }
  return out;
}

/** Frequencia do aluno nas turmas da modalidade (presencas / presencas + faltas, em %). */
export function modalityAttendancePercent(modalityId: Id, studentId: Id): number | null {
  const classIds = new Set(
    store.enrollments
      .filter((e) => e.studentId === studentId)
      .map((e) => e.classGroupId)
      .filter((id) => store.classGroups.find((g) => g.id === id)?.modalityId === modalityId),
  );
  let present = 0;
  let absent = 0;
  for (const a of store.attendances) {
    if (a.studentId !== studentId) continue;
    const classId = a.sessionId.split(SEP)[0];
    if (!classIds.has(classId)) continue;
    if (a.status === "present") present += 1;
    else if (a.status === "absent") absent += 1;
  }
  return attendancePercent(present, absent);
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
  const original = recoveryOfName(a);
  return {
    ...rest,
    levelName: levelName(a.modalityId, a.levelId),
    ...(original ? { recoveryOfName: original } : {}),
    gradedCount: grades.filter((g) => g.status !== "none").length,
    enrolledCount: activeEnrollments(a.classGroupId).length,
    average: settings
      ? assessmentAverage(
          settings,
          grades.map((g) => ({ status: g.status, value: g.value })),
          pointsOf(settings, a),
        )
      : null,
  };
}

export function sortAssessments(list: Assessment[]): Assessment[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** Resultado do aluno nas avaliacoes dadas: media com pesos ou total, ja com a recuperacao. */
export function studentAverage(
  settings: ModalityAssessmentSettings,
  assessments: Assessment[],
  studentId: Id,
): GradeAverage | null {
  return resultOf(settings, effectiveItems(settings, assessments, studentId));
}

export function className(classGroupId: Id): string {
  return store.classGroups.find((g) => g.id === classGroupId)?.name ?? "Turma";
}
