import type {
  ApiErrorField,
  Assessment,
  AssessmentGrade,
  AssessmentGradeInput,
  AssessmentSheet,
  AssessmentView,
  Category,
  ClassAssessmentsView,
  ClassGroup,
  CreateAssessment,
  GradeAverage,
  Id,
  ModalityAssessmentSettings,
  ReportCardEntry,
  ReportCardModality,
  StudentReportCard,
  UpdateAssessment,
} from "@gestarahub/contracts";
import {
  DEFAULT_ASSESSMENT_WEIGHT,
  MAX_ASSESSMENT_NAME_LENGTH,
  averageGrades,
  averageOfAverages,
  averagesByLevel,
  assessmentsEnabled,
  isBelowPassing,
  normalizeGrade,
  validateWeight,
} from "@gestarahub/core/grades";
import { getCurrentActor } from "@/mocks/currentActor";
import {
  apiError,
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  validationError,
} from "@/mocks/helpers";
import { store } from "@/mocks/store";
import { format, parseISO } from "date-fns";
import { can } from "@/lib/permissions";
import { resolveModalityTrack } from "@/lib/progression-tracks";
import { auditLogService } from "./auditLogService";
import { delegateAll, realAccountInBrowser } from "./world/delegate";
import {
  listAssessmentsFromDb,
} from "./gradesBackend";

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

const NOT_FOUND = "Avaliação não encontrada.";
const CLASS_NOT_FOUND = "Turma não encontrada.";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Colecao do tenant ativo (opcional no store: nasce no 1o uso, sem migracao). */
function assessmentsStore(): Assessment[] {
  if (!store.assessments) store.assessments = [];
  return store.assessments;
}

function findClass(classGroupId: Id): ClassGroup {
  const group = store.classGroups.find((g) => g.id === classGroupId);
  if (!group) throw notFoundError(CLASS_NOT_FOUND);
  return group;
}

function findAssessment(id: Id): Assessment {
  const found = assessmentsStore().find((a) => a.id === id);
  if (!found) throw notFoundError(NOT_FOUND);
  return found;
}

function modalityOf(modalityId: Id | undefined): Category | undefined {
  return modalityId ? store.categories.find((c) => c.id === modalityId) : undefined;
}

/** Configuracao ligada da modalidade, ou undefined. */
function enabledSettings(modalityId: Id | undefined): ModalityAssessmentSettings | undefined {
  const settings = modalityOf(modalityId)?.assessments;
  return assessmentsEnabled(settings) ? settings : undefined;
}

function requireSettings(group: ClassGroup): ModalityAssessmentSettings {
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
function assertCanManage(group: ClassGroup): void {
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

function actorId(): Id {
  return getCurrentActor()?.userId ?? "system";
}

function activeEnrollments(classGroupId: Id) {
  return store.enrollments.filter((e) => e.classGroupId === classGroupId && e.status === "active");
}

/** Matriculados hoje que ja estavam na turma no dia da avaliacao (ALU-28). */
function enrolledOnDate(classGroupId: Id, date: string) {
  return activeEnrollments(classGroupId).filter((e) => format(parseISO(e.enrolledAt), "yyyy-MM-dd") <= date);
}

function studentName(studentId: Id): string {
  return store.clients.find((c) => c.id === studentId)?.name ?? "Aluno";
}

function levelName(modalityId: Id, levelId?: string): string | undefined {
  if (!levelId) return undefined;
  const track = resolveModalityTrack(modalityOf(modalityId));
  return track.levels.find((l) => l.id === levelId)?.name;
}

function validateLevel(modalityId: Id, levelId: string | undefined, fields: ApiErrorField[]): void {
  if (!levelId) return;
  const track = resolveModalityTrack(modalityOf(modalityId));
  if (!track.enabled || !track.levels.some((l) => l.id === levelId)) {
    fields.push({ field: "levelId", message: "Escolha uma etapa da trilha." });
  }
}

function validateFields(
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
function enrolledGrades(a: Assessment): AssessmentGrade[] {
  const enrolled = new Set(activeEnrollments(a.classGroupId).map((e) => e.studentId));
  return a.grades.filter((g) => enrolled.has(g.studentId));
}

function toView(a: Assessment, settings: ModalityAssessmentSettings | undefined): AssessmentView {
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

function sortAssessments(list: Assessment[]): Assessment[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** Media geral do aluno nas avaliacoes dadas (ponderada). */
function studentAverage(
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

function className(classGroupId: Id): string {
  return store.classGroups.find((g) => g.id === classGroupId)?.name ?? "Turma";
}

export async function syncAssessmentsFromDb(organizationId: string): Promise<void> {
  if (!realAccountInBrowser(organizationId)) return;
  const dbAssessments = await listAssessmentsFromDb(organizationId);
  const dbMap = new Map(dbAssessments.map((a) => [a.id, a]));
  const list = assessmentsStore();
  for (let i = 0; i < list.length; i++) {
    const existing = list[i];
    const fromDb = dbMap.get(existing.id);
    if (fromDb) {
      list[i] = fromDb;
      dbMap.delete(existing.id);
    }
  }
  for (const newAssessment of dbMap.values()) {
    list.push(newAssessment);
  }
}

export const gradesServiceImpl = {
  /** Aba "Avaliações" da turma: avaliacoes (mais recente primeiro) e media da turma. */
  listClassAssessments(classGroupId: Id): Promise<ClassAssessmentsView> {
    return simulateRead(async () => {
      await syncAssessmentsFromDb(store.organization.id);
      const group = findClass(classGroupId);
      const settings = enabledSettings(group.modalityId);
      const list = sortAssessments(assessmentsStore().filter((a) => a.classGroupId === classGroupId));
      const classAverage = settings
        ? averageOfAverages(
            settings,
            activeEnrollments(classGroupId).map((e) => studentAverage(settings, list, e.studentId)),
          )
        : null;
      return clone({
        classGroupId,
        modalityId: group.modalityId,
        settings: modalityOf(group.modalityId)?.assessments,
        assessments: list.map((a) => toView(a, settings)),
        classAverage,
      });
    });
  },

  /** Tela "Lançar notas": uma linha por aluno matriculado hoje, em ordem alfabetica. */
  getSheet(assessmentId: Id): Promise<AssessmentSheet> {
    return simulateRead(async () => {
      await syncAssessmentsFromDb(store.organization.id);
      const a = findAssessment(assessmentId);
      const group = findClass(a.classGroupId);
      const settings = requireSettings(group);
      const rows = enrolledOnDate(group.id, a.date)
        .map((e) => {
          const grade = a.grades.find((g) => g.studentId === e.studentId);
          return {
            studentId: e.studentId,
            studentName: studentName(e.studentId),
            status: grade?.status ?? "none",
            ...(grade?.value !== undefined ? { value: grade.value } : {}),
          };
        })
        .sort((x, y) => x.studentName.localeCompare(y.studentName, "pt-BR"));
      return clone({ assessment: toView(a, settings), classGroupName: group.name, settings, rows });
    });
  },

  create(payload: CreateAssessment): Promise<AssessmentView> {
    return simulateWrite(async () => {
      const group = findClass(payload.classGroupId);
      assertCanManage(group);
      const settings = requireSettings(group);
      const modalityId = group.modalityId as Id;
      const fields: ApiErrorField[] = [];
      validateFields(payload, false, fields);
      validateLevel(modalityId, payload.levelId, fields);
      if (fields.length > 0) throw validationError(fields);

      const ts = nowIso();
      const weight = payload.weight ?? DEFAULT_ASSESSMENT_WEIGHT;
      const assessment: Assessment = {
        id: newId(),
        organizationId: store.organization.id,
        classGroupId: group.id,
        modalityId,
        name: payload.name.trim(),
        date: payload.date,
        weight,
        ...(payload.levelId ? { levelId: payload.levelId } : {}),
        grades: [],
        createdAt: ts,
        updatedAt: ts,
      };

      assessmentsStore().push(assessment);
      auditLogService.record({
        action: "created",
        target: { type: "assessment", id: assessment.id, label: assessment.name },
        predicate: `criou a avaliação ${assessment.name} da turma ${group.name}`,
      });
      return clone(toView(assessment, settings));
    });
  },

  update(id: Id, payload: UpdateAssessment): Promise<AssessmentView> {
    return simulateWrite(async () => {
      const current = findAssessment(id);
      const group = findClass(current.classGroupId);
      assertCanManage(group);
      const settings = requireSettings(group);
      const fields: ApiErrorField[] = [];
      validateFields(payload, true, fields);
      if (payload.levelId) validateLevel(current.modalityId, payload.levelId, fields);
      if (fields.length > 0) throw validationError(fields);

      if (payload.name !== undefined) current.name = payload.name.trim();
      if (payload.date !== undefined) current.date = payload.date;
      if (payload.weight !== undefined) current.weight = payload.weight;
      if (payload.levelId === null || payload.levelId === "") delete current.levelId;
      else if (payload.levelId !== undefined) current.levelId = payload.levelId;
      current.updatedAt = nowIso();
      auditLogService.record({
        action: "updated",
        target: { type: "assessment", id: current.id, label: current.name },
        predicate: `editou a avaliação ${current.name} da turma ${group.name}`,
      });
      return clone(toView(current, settings));
    });
  },

  /** Exclui a avaliacao e as notas dela (a tela confirma antes). */
  remove(id: Id): Promise<void> {
    return simulateWrite(async () => {
      const current = findAssessment(id);
      const group = findClass(current.classGroupId);
      assertCanManage(group);

      store.assessments = assessmentsStore().filter((a) => a.id !== id);
      auditLogService.record({
        action: "deleted",
        target: { type: "assessment", id, label: current.name },
        predicate: `excluiu a avaliação ${current.name} da turma ${group.name}`,
      });
    });
  },

  /**
   * Lanca as notas da avaliacao em lote (so alunos matriculados na turma).
   * `graded` exige nota valida na escala; `absent` guarda a falta; `none` apaga.
   * Alunos fora do lote ficam como estao.
   */
  setGrades(assessmentId: Id, entries: AssessmentGradeInput[]): Promise<AssessmentView> {
    return simulateWrite(async () => {
      const current = findAssessment(assessmentId);
      const group = findClass(current.classGroupId);
      assertCanManage(group);
      const settings = requireSettings(group);
      const enrolled = new Set(enrolledOnDate(group.id, current.date).map((e) => e.studentId));
      const enrolledLater = new Set(activeEnrollments(group.id).map((e) => e.studentId));

      const fields: ApiErrorField[] = [];
      const normalized: AssessmentGradeInput[] = [];
      for (const entry of entries) {
        const field = `grades.${entry.studentId}`;
        if (!enrolled.has(entry.studentId)) {
          fields.push({
            field,
            message: enrolledLater.has(entry.studentId)
              ? `${studentName(entry.studentId)} entrou na turma depois da avaliação.`
              : `${studentName(entry.studentId)} não está matriculado nesta turma.`,
          });
          continue;
        }
        if (entry.status === "graded") {
          const check = normalizeGrade(settings.scale, entry.value);
          if (!check.ok) {
            fields.push({ field, message: check.message });
            continue;
          }
          normalized.push({ studentId: entry.studentId, status: "graded", value: check.value });
        } else if (entry.status === "absent" || entry.status === "none") {
          normalized.push({ studentId: entry.studentId, status: entry.status });
        } else {
          fields.push({ field, message: "Situação da nota inválida." });
        }
      }
      if (fields.length > 0) throw validationError(fields);

      const ts = nowIso();
      const by = actorId();
      for (const entry of normalized) {
        current.grades = current.grades.filter((g) => g.studentId !== entry.studentId);
        if (entry.status === "none") continue;
        current.grades.push({
          studentId: entry.studentId,
          status: entry.status,
          ...(entry.value !== undefined ? { value: entry.value } : {}),
          updatedAt: ts,
          updatedBy: by,
        });
      }
      current.updatedAt = ts;

      auditLogService.record({
        action: "updated",
        target: { type: "assessment", id: current.id, label: current.name },
        predicate: `lançou as notas de ${current.name} da turma ${group.name}`,
      });
      return clone(toView(current, settings));
    });
  },

  /**
   * Boletim "Notas" do aluno, por modalidade com avaliacoes ligadas: as
   * avaliacoes das turmas em que esta matriculado (ou em que ja tem nota),
   * media por etapa da trilha e geral.
   */
  getReportCard(studentId: Id): Promise<StudentReportCard> {
    return simulateRead(async () => {
      await syncAssessmentsFromDb(store.organization.id);
      const student = store.clients.find((c) => c.id === studentId);
      if (!student) throw notFoundError("Aluno não encontrado.");
      const activeClassIds = new Set(
        store.enrollments.filter((e) => e.studentId === studentId && e.status === "active").map((e) => e.classGroupId),
      );
      const relevant = assessmentsStore().filter(
        (a) => activeClassIds.has(a.classGroupId) || a.grades.some((g) => g.studentId === studentId),
      );
      // Modalidades ligadas em que o aluno tem turma ativa ou alguma avaliacao.
      const modalityIds = new Set<Id>(relevant.map((a) => a.modalityId));
      for (const classId of activeClassIds) {
        const modalityId = store.classGroups.find((g) => g.id === classId)?.modalityId;
        if (modalityId) modalityIds.add(modalityId);
      }

      const modalities: ReportCardModality[] = [];
      for (const category of [...store.categories].sort((a, b) => a.position - b.position)) {
        if (!modalityIds.has(category.id)) continue;
        const settings = enabledSettings(category.id);
        if (!settings) continue;
        const track = resolveModalityTrack(category);
        const list = sortAssessments(relevant.filter((a) => a.modalityId === category.id));
        const entries: ReportCardEntry[] = list.map((a) => {
          const grade = a.grades.find((g) => g.studentId === studentId);
          const status = grade?.status ?? "none";
          return {
            assessmentId: a.id,
            name: a.name,
            date: a.date,
            weight: a.weight,
            classGroupId: a.classGroupId,
            classGroupName: className(a.classGroupId),
            ...(a.levelId ? { levelId: a.levelId, levelName: levelName(category.id, a.levelId) } : {}),
            status,
            ...(grade?.value !== undefined ? { value: grade.value } : {}),
            belowPassing:
              status === "graded" && grade?.value !== undefined
                ? isBelowPassing(settings.scale, grade.value, settings.passingGrade)
                : false,
          };
        });
        const weighted = entries.map((e) => ({ levelId: e.levelId, status: e.status, value: e.value, weight: e.weight }));
        const levelOrder = track.enabled ? track.levels.map((l) => l.id) : [];
        modalities.push({
          modalityId: category.id,
          modalityName: category.name,
          settings,
          entries,
          levels: averagesByLevel(settings, weighted, levelOrder).map((row) => ({
            ...(row.levelId ? { levelId: row.levelId, levelName: levelName(category.id, row.levelId) } : {}),
            average: row.average,
          })),
          overall: averageGrades(settings, weighted),
        });
      }
      return clone({ studentId, studentName: student.name, modalities });
    });
  },
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const gradesService = delegateAll("grades", gradesServiceImpl);
