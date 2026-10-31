import type {
  ApiErrorField,
  Assessment,
  AssessmentGradeInput,
  AssessmentSheet,
  AssessmentView,
  ClassAssessmentsView,
  CreateAssessment,
  Id,
  UpdateAssessment,
} from "@gestarahub/contracts";
import { DEFAULT_ASSESSMENT_WEIGHT, averageOfAverages, normalizeGrade } from "@gestarahub/core/grades";
import { newId, nowIso, readOp, writeOp, validationError } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { auditLogService } from "../audit/auditLogService";
import { assertTeacherSeesClass } from "../classes/teacherScope";
import {
  clone,
  assessmentsStore,
  findClass,
  findAssessment,
  modalityOf,
  enabledSettings,
  requireSettings,
  assertCanManage,
  actorId,
  activeEnrollments,
  enrolledOnDate,
  studentName,
  validateLevel,
  validateFields,
  validatePointsAndRecovery,
  pointsOf,
  toView,
  sortAssessments,
  studentAverage,
} from "./gradeRules";

/** Avaliacoes da turma: listar, lancar notas, criar, editar e excluir. */
export const assessmentsService = {
  /** Aba "Avaliações" da turma: avaliacoes (mais recente primeiro) e media da turma. */
  listClassAssessments(classGroupId: Id): Promise<ClassAssessmentsView> {
    return readOp(async () => {
      const group = findClass(classGroupId);
      // Professor: so as avaliacoes das turmas dele (revisao geral de 31/10/2026).
      assertTeacherSeesClass(group, "Você só vê as avaliações das suas turmas.");
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
    return readOp(async () => {
      const a = findAssessment(assessmentId);
      const group = findClass(a.classGroupId);
      assertTeacherSeesClass(group, "Você só vê as avaliações das suas turmas.");
      const settings = requireSettings(group);
      // Recuperacao: a nota da avaliacao recuperada fica de referencia em cada linha.
      const original = a.recoveryOf ? assessmentsStore().find((o) => o.id === a.recoveryOf) : undefined;
      const rows = enrolledOnDate(group.id, a.date)
        .map((e) => {
          const grade = a.grades.find((g) => g.studentId === e.studentId);
          const before = original?.grades.find((g) => g.studentId === e.studentId);
          return {
            studentId: e.studentId,
            studentName: studentName(e.studentId),
            status: grade?.status ?? "none",
            ...(grade?.value !== undefined ? { value: grade.value } : {}),
            ...(original
              ? { original: { status: before?.status ?? "none", ...(before?.value !== undefined ? { value: before.value } : {}) } }
              : {}),
          };
        })
        .sort((x, y) => x.studentName.localeCompare(y.studentName, "pt-BR"));
      const maxGrade = pointsOf(settings, a);
      return clone({
        assessment: toView(a, settings),
        classGroupName: group.name,
        settings,
        ...(maxGrade !== undefined ? { maxGrade } : {}),
        rows,
      });
    });
  },
  create(payload: CreateAssessment): Promise<AssessmentView> {
    return writeOp(async () => {
      const group = findClass(payload.classGroupId);
      assertCanManage(group);
      const settings = requireSettings(group);
      const modalityId = group.modalityId as Id;
      const fields: ApiErrorField[] = [];
      validateFields(payload, false, fields);
      validateLevel(modalityId, payload.levelId, fields);
      validatePointsAndRecovery(settings, group.id, payload, undefined, fields);
      if (fields.length > 0) throw validationError(fields);

      const ts = nowIso();
      const weight = payload.weight ?? DEFAULT_ASSESSMENT_WEIGHT;
      // A recuperacao herda peso, pontos e etapa da recuperada.
      const recoveryOf = payload.recoveryOf || undefined;
      const assessment: Assessment = {
        id: newId(),
        organizationId: store.organization.id,
        classGroupId: group.id,
        modalityId,
        name: payload.name.trim(),
        date: payload.date,
        weight: recoveryOf ? DEFAULT_ASSESSMENT_WEIGHT : weight,
        ...(recoveryOf ? { recoveryOf } : {}),
        ...(!recoveryOf && payload.points !== undefined ? { points: Number(payload.points) } : {}),
        ...(!recoveryOf && payload.levelId ? { levelId: payload.levelId } : {}),
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
    return writeOp(async () => {
      const current = findAssessment(id);
      const group = findClass(current.classGroupId);
      assertCanManage(group);
      const settings = requireSettings(group);
      const fields: ApiErrorField[] = [];
      validateFields(payload, true, fields);
      if (payload.levelId) validateLevel(current.modalityId, payload.levelId, fields);
      validatePointsAndRecovery(settings, group.id, payload, current, fields);
      // Menos pontos do que uma nota ja lancada deixaria a nota acima do maximo (achado V5).
      if (payload.points !== undefined && !current.recoveryOf) {
        const highest = Math.max(0, ...current.grades.map((g) => (typeof g.value === "number" ? g.value : 0)));
        if (Number(payload.points) < highest) {
          fields.push({ field: "points", message: `Já há nota ${highest.toLocaleString("pt-BR")}: vale pelo menos isso.` });
        }
      }
      if (fields.length > 0) throw validationError(fields);

      if (payload.name !== undefined) current.name = payload.name.trim();
      if (payload.date !== undefined) current.date = payload.date;
      if (payload.weight !== undefined) current.weight = payload.weight;
      if (payload.points !== undefined) current.points = Number(payload.points);
      if (payload.levelId === null || payload.levelId === "") delete current.levelId;
      else if (payload.levelId !== undefined) current.levelId = payload.levelId;
      if (payload.recoveryOf === null || payload.recoveryOf === "") delete current.recoveryOf;
      else if (payload.recoveryOf !== undefined) current.recoveryOf = payload.recoveryOf;
      // A recuperacao herda peso, pontos e etapa da recuperada.
      if (current.recoveryOf) {
        current.weight = DEFAULT_ASSESSMENT_WEIGHT;
        delete current.points;
        delete current.levelId;
      }
      current.updatedAt = nowIso();
      auditLogService.record({
        action: "updated",
        target: { type: "assessment", id: current.id, label: current.name },
        predicate: `editou a avaliação ${current.name} da turma ${group.name}`,
      });
      return clone(toView(current, settings));
    });
  },
  /** Exclui a avaliacao e as notas dela, com as recuperacoes dela (a tela confirma antes). */
  remove(id: Id): Promise<void> {
    return writeOp(async () => {
      const current = findAssessment(id);
      const group = findClass(current.classGroupId);
      assertCanManage(group);

      store.assessments = assessmentsStore().filter((a) => a.id !== id && a.recoveryOf !== id);
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
    return writeOp(async () => {
      const current = findAssessment(assessmentId);
      const group = findClass(current.classGroupId);
      assertCanManage(group);
      const settings = requireSettings(group);
      const maxGrade = pointsOf(settings, current);
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
          const check = normalizeGrade(settings.scale, entry.value, maxGrade);
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
};
