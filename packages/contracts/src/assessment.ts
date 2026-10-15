import type { DateISO, DateTimeISO, Id } from "./common";

/**
 * Notas dos alunos (doc 21 §2.1, fase 1). A modalidade liga as avaliacoes e
 * escolhe a escala; a avaliacao pertence a turma; as notas ficam dentro da
 * avaliacao (um documento por prova, uma linha por aluno). Regras puras
 * (escala, validacao, media ponderada, arredondamento) em
 * `@gestarahub/core/grades`.
 */

/** Escala da nota: 0 a 10 (uma casa), 0 a 100 (inteiro), conceito A a E, apto/nao apto. */
export type AssessmentScale = "zero_ten" | "zero_hundred" | "concept" | "pass_fail";

export type ConceptGrade = "A" | "B" | "C" | "D" | "E";

/** Apto (`pass`) ou nao apto (`fail`). */
export type PassFailGrade = "pass" | "fail";

/**
 * Valor da nota conforme a escala: numero em 0 a 10 e 0 a 100, letra no
 * conceito, `pass`/`fail` no apto.
 */
export type GradeValue = number | ConceptGrade | PassFailGrade;

/** Avaliacoes da modalidade. Ausente = desligado. */
export interface ModalityAssessmentSettings {
  enabled: boolean;
  scale: AssessmentScale;
  /**
   * Nota minima para aprovar, na mesma escala (padrao 6 / 60 / "C" / "pass").
   * Abaixo dela a nota e a media aparecem em destaque.
   */
  passingGrade: GradeValue;
}

/**
 * Situacao da nota do aluno numa avaliacao: lancada, faltou ou sem nota.
 * Faltou e sem nota ficam fora da media (recuperacao e fase 2).
 */
export type AssessmentGradeStatus = "graded" | "absent" | "none";

/** Nota de um aluno numa avaliacao (embutida na avaliacao). */
export interface AssessmentGrade {
  studentId: Id;
  status: AssessmentGradeStatus;
  /** So com `status: "graded"`. */
  value?: GradeValue;
  updatedAt: DateTimeISO;
  /** Usuario que lancou (id do ator da sessao). */
  updatedBy: Id;
}

/** Avaliacao da turma ("Prova do módulo 2"). */
export interface Assessment {
  id: Id;
  organizationId: Id;
  classGroupId: Id;
  /** Modalidade da turma na criacao (escala e trilha vem dela). */
  modalityId: Id;
  name: string;
  date: DateISO;
  /** Peso na media (> 0, padrao 1). */
  weight: number;
  /** Etapa da trilha a que se refere (modulo, nivel). Opcional. */
  levelId?: string;
  /** Notas lancadas; aluno sem linha = sem nota. */
  grades: AssessmentGrade[];
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export interface CreateAssessment {
  classGroupId: Id;
  name: string;
  date: DateISO;
  /** Ausente = 1. */
  weight?: number;
  levelId?: string;
}

export type UpdateAssessment = Partial<Pick<Assessment, "name" | "date" | "weight">> & {
  /** `null` tira a etapa. */
  levelId?: string | null;
};

/** Uma linha do lancamento: `none` apaga a nota do aluno. */
export interface AssessmentGradeInput {
  studentId: Id;
  status: AssessmentGradeStatus;
  value?: GradeValue;
}

/** Media calculada (ver `averageGrades` no core). */
export interface GradeAverage {
  /** Media de volta na escala: numero, conceito ou apto pela maioria. */
  value: GradeValue;
  /**
   * Media na escala interna: a propria nota em 0 a 10 e 0 a 100; conceito em
   * 2 a 10 (A=10, B=8, C=6, D=4, E=2); fracao de aptos (0 a 1) no apto.
   */
  numeric: number;
  /** Notas que entraram na conta. */
  count: number;
  /** Abaixo da nota minima da modalidade. */
  belowPassing: boolean;
}

/** Linha da lista de avaliacoes da turma. */
export interface AssessmentView extends Omit<Assessment, "grades"> {
  levelName?: string;
  /** Alunos matriculados com nota ou falta lancada. */
  gradedCount: number;
  /** Alunos matriculados hoje na turma. */
  enrolledCount: number;
  /** Media das notas lancadas (null sem nota). */
  average: GradeAverage | null;
}

/** Aba "Avaliações" da turma. */
export interface ClassAssessmentsView {
  classGroupId: Id;
  modalityId?: Id;
  /** Configuracao da modalidade; ausente ou desligada = turma sem avaliacoes. */
  settings?: ModalityAssessmentSettings;
  assessments: AssessmentView[];
  /** Media da turma: media das medias gerais dos alunos matriculados. */
  classAverage: GradeAverage | null;
}

/** Linha do lancamento de notas: um aluno matriculado. */
export interface AssessmentSheetRow {
  studentId: Id;
  studentName: string;
  status: AssessmentGradeStatus;
  value?: GradeValue;
}

/** Tela "Lançar notas". */
export interface AssessmentSheet {
  assessment: AssessmentView;
  classGroupName: string;
  settings: ModalityAssessmentSettings;
  rows: AssessmentSheetRow[];
}

/** Uma avaliacao no boletim do aluno. */
export interface ReportCardEntry {
  assessmentId: Id;
  name: string;
  date: DateISO;
  weight: number;
  classGroupId: Id;
  classGroupName: string;
  levelId?: string;
  levelName?: string;
  status: AssessmentGradeStatus;
  value?: GradeValue;
  belowPassing: boolean;
}

/** Media de uma etapa da trilha no boletim (sem etapa = `levelId` ausente). */
export interface ReportCardLevelAverage {
  levelId?: string;
  levelName?: string;
  average: GradeAverage | null;
}

export interface ReportCardModality {
  modalityId: Id;
  modalityName: string;
  settings: ModalityAssessmentSettings;
  /** Mais recente primeiro. */
  entries: ReportCardEntry[];
  /** Na ordem da trilha; as sem etapa por ultimo. */
  levels: ReportCardLevelAverage[];
  /** Media geral ponderada de todas as notas da modalidade. */
  overall: GradeAverage | null;
}

/** Boletim "Notas" do aluno: so modalidades com avaliacoes ligadas. */
export interface StudentReportCard {
  studentId: Id;
  studentName: string;
  modalities: ReportCardModality[];
}
