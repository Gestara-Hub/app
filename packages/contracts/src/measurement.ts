import type { DateISO, DateTimeISO, Id } from "./common";

/**
 * Testes e medidas dos alunos (doc 21 §2.4, fase B de 31/10/2026): para
 * funcional e crossfit, pilates e yoga, natação e esportes. A modalidade define
 * as medidas; a avaliacao e por aluno (a de entrada e as periodicas), nao por
 * turma. Regras puras (validacao, evolucao, formato) em
 * `@gestarahub/core/measurements`.
 */

/** Melhor quando sobe (prancha, flexoes) ou quando desce (peso, tempo nos 25 m). */
export type MeasureDirection = "higher" | "lower";

/** Uma medida da modalidade. */
export interface ModalityMeasure {
  id: string;
  /** "Prancha", "Peso", "25 m crawl". */
  name: string;
  /** "s", "kg", "cm", "%", "rep". */
  unit: string;
  better: MeasureDirection;
}

/** Testes e medidas da modalidade. Ausente = desligado. */
export interface ModalityMeasurementSettings {
  enabled: boolean;
  measures: ModalityMeasure[];
}

/** Uma avaliacao de testes e medidas de um aluno. */
export interface StudentMeasurement {
  id: Id;
  organizationId: Id;
  studentId: Id;
  modalityId: Id;
  date: DateISO;
  /** Valor por medida (id da medida -> numero). Medida sem valor fica de fora. */
  values: Record<string, number>;
  notes?: string;
  /** Usuario que registrou. */
  createdBy: Id;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export interface CreateStudentMeasurement {
  studentId: Id;
  modalityId: Id;
  date: DateISO;
  values: Record<string, number>;
  notes?: string;
}

export type UpdateStudentMeasurement = Partial<Pick<StudentMeasurement, "date" | "values" | "notes">>;

/** Evolucao de uma medida: a ultima, a anterior, a primeira e a mudanca. */
export interface MeasureProgress {
  measure: ModalityMeasure;
  latest?: { value: number; date: DateISO };
  previous?: { value: number; date: DateISO };
  first?: { value: number; date: DateISO };
  /** Ultima menos a anterior (null sem anterior). */
  change: number | null;
  /** A mudanca foi para o lado bom? null sem mudanca. */
  improved: boolean | null;
}

/** Testes e medidas do aluno numa modalidade. */
export interface StudentMeasurementsModality {
  modalityId: Id;
  modalityName: string;
  measures: ModalityMeasure[];
  progress: MeasureProgress[];
  /** Mais recente primeiro. */
  history: StudentMeasurement[];
}

/** Tela "Testes e medidas" do aluno: so modalidades com medidas ligadas. */
export interface StudentMeasurementsView {
  studentId: Id;
  studentName: string;
  modalities: StudentMeasurementsModality[];
}
