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
 * Como fecha o resultado (so 0 a 10 e 0 a 100): media com pesos (padrao) ou
 * soma dos pontos, em que cada avaliacao vale uma parte do total (31/10/2026).
 */
export type AssessmentResultMode = "average" | "sum";

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
  /** Ausente = "average". "sum" so vale nas escalas 0 a 10 e 0 a 100. */
  resultMode?: AssessmentResultMode;
  /** Frequencia minima para aprovar (1 a 100, em %). Ausente = sem exigencia. */
  minAttendancePercent?: number;
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
  /** Na soma dos pontos: quanto a avaliacao vale (ate o total da escala). */
  points?: number;
  /**
   * Recuperacao (ou segunda chamada) de outra avaliacao da turma: vale a maior
   * nota de cada aluno, e esta avaliacao nao entra sozinha na conta.
   */
  recoveryOf?: Id;
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
  /** Obrigatorio na soma dos pontos (fora da recuperacao). */
  points?: number;
  recoveryOf?: Id;
  levelId?: string;
}

export type UpdateAssessment = Partial<Pick<Assessment, "name" | "date" | "weight" | "points">> & {
  /** `null` tira a etapa. */
  levelId?: string | null;
  /** `null` deixa de ser recuperacao. */
  recoveryOf?: Id | null;
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
  /**
   * Abaixo da nota minima da modalidade. Na soma, pelo ritmo: o total contra
   * os pontos ja dados (3 de 3 nao fica vermelho so porque faltam provas).
   */
  belowPassing: boolean;
  /** Na soma: pontos ja dados ate aqui (das avaliacoes com nota ou falta). */
  outOf?: number;
}

/** Linha da lista de avaliacoes da turma. */
export interface AssessmentView extends Omit<Assessment, "grades"> {
  levelName?: string;
  /** Nome da avaliacao recuperada (so na recuperacao). */
  recoveryOfName?: string;
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
  /** Na recuperacao: a nota da avaliacao recuperada, de referencia. */
  original?: { status: AssessmentGradeStatus; value?: GradeValue };
}

/** Tela "Lançar notas". */
export interface AssessmentSheet {
  assessment: AssessmentView;
  classGroupName: string;
  settings: ModalityAssessmentSettings;
  /** Nota maxima de cada aluno: os pontos na soma, senao o topo da escala. */
  maxGrade?: number;
  rows: AssessmentSheetRow[];
}

/** Uma avaliacao no boletim do aluno. */
export interface ReportCardEntry {
  assessmentId: Id;
  name: string;
  date: DateISO;
  weight: number;
  points?: number;
  classGroupId: Id;
  classGroupName: string;
  levelId?: string;
  levelName?: string;
  /** Recuperacao: nao entra sozinha na conta. */
  recoveryOf?: Id;
  recoveryOfName?: string;
  status: AssessmentGradeStatus;
  value?: GradeValue;
  /** A nota da recuperacao, quando foi maior e passou a valer no lugar desta. */
  recoveredValue?: GradeValue;
  /** A nota original (a que aparece) ficou abaixo da minima. */
  belowPassing: boolean;
  /** Com recuperacao: a nota que passou a valer ainda ficou abaixo da minima. */
  recoveredBelowPassing?: boolean;
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
  /** Media geral ponderada (ou total, na soma) de todas as notas da modalidade. */
  overall: GradeAverage | null;
  /** So com frequencia minima na modalidade: a frequencia do aluno nas turmas dela. */
  attendance?: { percent: number | null; below: boolean };
}

/** Boletim "Notas" do aluno: so modalidades com avaliacoes ligadas. */
/**
 * Notas do aluno na etapa atual da trilha, para o "Apto" (doc product/30 §1).
 * Etapa atual: as avaliacoes marcadas com o nivel atual e as sem etapa desde
 * a ultima graduacao, ja com a recuperacao (maior nota).
 */
export interface StudentStageGrades {
  settings: ModalityAssessmentSettings;
  /** Media (ou total, na soma) da etapa; null = nenhuma nota ainda. */
  average: GradeAverage | null;
  /** Frequencia nas turmas da modalidade (so com frequencia minima); null = sem chamada. */
  attendancePercent: number | null;
}

export interface StudentReportCard {
  studentId: Id;
  studentName: string;
  modalities: ReportCardModality[];
}
