import type {
  ApiErrorField,
  CreateStudentMeasurement,
  Id,
  ModalityMeasure,
  StudentMeasurement,
  StudentMeasurementsModality,
  StudentMeasurementsView,
  UpdateStudentMeasurement,
} from "@gestarahub/contracts";
import { MAX_MEASUREMENT_NOTES_LENGTH, measureProgress, normalizeMeasureValue } from "@gestarahub/core/measurements";
import { dateInSpace } from "@gestarahub/core/date";
import { apiError, newId, notFoundError, nowIso, readOp, validationError, writeOp } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { getCurrentActor } from "@/services/world/actor";
import { auditLogService } from "../audit/auditLogService";
import { assertCanManageProgression, assertTeacherSeesStudent } from "../classes/teacherScope";

/**
 * Testes e medidas dos alunos (doc 21 §2.4, fase B de 31/10/2026). A
 * modalidade liga e define as medidas; cada avaliacao e de um aluno numa
 * modalidade. As regras (valor, evolucao) vem de `@gestarahub/core/measurements`.
 *
 * Gravar pede `progression:manage` (como a evolucao): dono e gerente em todos;
 * o professor so em aluno de turma dele na modalidade. Ver: o professor so os
 * alunos das turmas dele.
 */

const NOT_FOUND = "Avaliação não encontrada.";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Colecao do espaco (opcional no store: nasce no 1o uso, como as avaliacoes). */
function measurementsStore(): StudentMeasurement[] {
  if (!store.studentMeasurements) store.studentMeasurements = [];
  return store.studentMeasurements;
}

function studentOf(studentId: Id) {
  const student = store.clients.find((c) => c.id === studentId);
  if (!student) throw notFoundError("Aluno não encontrado.");
  return student;
}

function modalityName(modalityId: Id): string {
  return store.categories.find((c) => c.id === modalityId)?.name ?? "Modalidade";
}

/** Medidas ligadas da modalidade, ou undefined. */
function enabledMeasures(modalityId: Id): ModalityMeasure[] | undefined {
  const settings = store.categories.find((c) => c.id === modalityId)?.measurements;
  return settings?.enabled && settings.measures.length > 0 ? settings.measures : undefined;
}

function requireMeasures(modalityId: Id): ModalityMeasure[] {
  const measures = enabledMeasures(modalityId);
  if (!measures) {
    throw apiError("VALIDATION", "Esta modalidade não tem testes e medidas.", { httpStatus: 422 });
  }
  return measures;
}

/** Data (ate hoje), valores (so medidas da modalidade, pelo menos um) e observacao. */
function validate(
  measures: ModalityMeasure[],
  payload: { date?: string; values?: Record<string, unknown>; notes?: string },
  partial: boolean,
): { values?: Record<string, number> } {
  const fields: ApiErrorField[] = [];
  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  if (!partial || has("date")) {
    if (!payload.date || !DATE_PATTERN.test(payload.date)) fields.push({ field: "date", message: "Informe a data." });
    else if (payload.date > dateInSpace()) fields.push({ field: "date", message: "A data não pode ser futura." });
  }
  let values: Record<string, number> | undefined;
  if (!partial || has("values")) {
    values = {};
    const known = new Set(measures.map((m) => m.id));
    for (const [id, raw] of Object.entries(payload.values ?? {})) {
      if (raw === undefined || raw === null || raw === "") continue;
      if (!known.has(id)) {
        fields.push({ field: `values.${id}`, message: "Medida fora desta modalidade." });
        continue;
      }
      const check = normalizeMeasureValue(raw);
      if (!check.ok) fields.push({ field: `values.${id}`, message: check.message });
      else values[id] = check.value;
    }
    if (fields.length === 0 && Object.keys(values).length === 0) {
      fields.push({ field: "values", message: "Preencha pelo menos uma medida." });
    }
  }
  if (payload.notes !== undefined && payload.notes.length > MAX_MEASUREMENT_NOTES_LENGTH) {
    fields.push({ field: "notes", message: `Use até ${MAX_MEASUREMENT_NOTES_LENGTH} caracteres.` });
  }
  if (fields.length > 0) throw validationError(fields);
  return { values };
}

function findMeasurement(id: Id): StudentMeasurement {
  const found = measurementsStore().find((m) => m.id === id);
  if (!found) throw notFoundError(NOT_FOUND);
  return found;
}

function label(m: Pick<StudentMeasurement, "studentId" | "modalityId">): string {
  return `${studentOf(m.studentId).name} · ${modalityName(m.modalityId)}`;
}

export const measurementsService = {
  /**
   * Testes e medidas do aluno, por modalidade com medidas ligadas em que ele
   * tem turma ativa ou alguma avaliacao: evolucao de cada medida e historico.
   */
  getStudentMeasurements(studentId: Id): Promise<StudentMeasurementsView> {
    return readOp(async () => {
      const student = studentOf(studentId);
      assertTeacherSeesStudent(studentId);
      const history = measurementsStore().filter((m) => m.studentId === studentId);
      const activeModalities = new Set(
        store.enrollments
          .filter((e) => e.studentId === studentId && e.status === "active")
          .map((e) => store.classGroups.find((g) => g.id === e.classGroupId)?.modalityId)
          .filter((id): id is Id => Boolean(id)),
      );
      const modalities: StudentMeasurementsModality[] = [];
      for (const category of [...store.categories].sort((a, b) => a.position - b.position)) {
        const measures = enabledMeasures(category.id);
        if (!measures) continue;
        const own = history
          .filter((m) => m.modalityId === category.id)
          .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
        if (!activeModalities.has(category.id) && own.length === 0) continue;
        modalities.push({
          modalityId: category.id,
          modalityName: category.name,
          measures,
          progress: measureProgress(measures, own),
          history: own,
        });
      }
      return clone({ studentId, studentName: student.name, modalities });
    });
  },
  create(payload: CreateStudentMeasurement): Promise<StudentMeasurement> {
    return writeOp(async () => {
      studentOf(payload.studentId);
      const measures = requireMeasures(payload.modalityId);
      assertCanManageProgression(payload.studentId, { modalityId: payload.modalityId });
      const { values } = validate(measures, payload, false);
      const ts = nowIso();
      const notes = payload.notes?.trim();
      const measurement: StudentMeasurement = {
        id: newId(),
        organizationId: store.organization.id,
        studentId: payload.studentId,
        modalityId: payload.modalityId,
        date: payload.date,
        values: values ?? {},
        ...(notes ? { notes } : {}),
        createdBy: getCurrentActor()?.userId ?? "system",
        createdAt: ts,
        updatedAt: ts,
      };
      measurementsStore().push(measurement);
      auditLogService.record({
        action: "created",
        target: { type: "measurement", id: measurement.id, label: label(measurement) },
        predicate: `registrou testes e medidas de ${label(measurement)}`,
      });
      return clone(measurement);
    });
  },
  update(id: Id, payload: UpdateStudentMeasurement): Promise<StudentMeasurement> {
    return writeOp(async () => {
      const current = findMeasurement(id);
      const measures = requireMeasures(current.modalityId);
      assertCanManageProgression(current.studentId, { modalityId: current.modalityId });
      const { values } = validate(measures, payload, true);
      if (payload.date !== undefined) current.date = payload.date;
      if (values !== undefined) current.values = values;
      if (payload.notes !== undefined) {
        const notes = payload.notes.trim();
        if (notes) current.notes = notes;
        else delete current.notes;
      }
      current.updatedAt = nowIso();
      auditLogService.record({
        action: "updated",
        target: { type: "measurement", id: current.id, label: label(current) },
        predicate: `editou testes e medidas de ${label(current)}`,
      });
      return clone(current);
    });
  },
  /** Exclui a avaliacao (a tela confirma antes). */
  remove(id: Id): Promise<void> {
    return writeOp(async () => {
      const current = findMeasurement(id);
      assertCanManageProgression(current.studentId, { modalityId: current.modalityId });
      store.studentMeasurements = measurementsStore().filter((m) => m.id !== id);
      auditLogService.record({
        action: "deleted",
        target: { type: "measurement", id, label: label(current) },
        predicate: `excluiu testes e medidas de ${label(current)}`,
      });
    });
  },
};
