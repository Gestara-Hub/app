import type { DateTimeISO, Id, RecordStatus, TenantScopeFields } from "./common";

export type ProgressionBeltColor =
  | "white"
  | "gray"
  | "yellow"
  | "orange"
  | "green"
  | "blue"
  | "purple"
  | "brown"
  | "black"
  | "red"
  | "slate";

export type ProgressionCriteriaType =
  | "attendance"
  | "time"
  | "attendance_and_time"
  | "manual_exam";

export type ProgressionTrackTemplateKey =
  | "bjj_adult"
  | "judo_karate"
  | "muay_thai"
  | "general_levels"
  | "custom";

export interface ProgressionLevelStep {
  id: string;
  name: string;
  color: ProgressionBeltColor;
  tipColor?: ProgressionBeltColor;
  maxSubLevels: number;
}

export interface ModalityProgressionTrack {
  enabled: boolean;
  templateKey?: ProgressionTrackTemplateKey;
  criteriaType: ProgressionCriteriaType;
  targetAttendances?: number;
  targetMonths?: number;
  levels: ProgressionLevelStep[];
}

/**
 * Categoria de servico / Modalidade — entidade da organizacao.
 * Semeada por segmento e editavel pelo tenant. `position` controla a ordem de
 * exibicao; `progressionTrack` define a trilha opcional de graduacao/niveis.
 */
export interface Category {
  id: Id;
  organizationId: Id;
  name: string;
  position: number;
  progressionTrack?: ModalityProgressionTrack;
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

// position/status sao opcionais na criacao: a gestao cria so com o nome; o
// service atribui a proxima position e status "active".
export type CreateCategory = Omit<
  Category,
  "id" | "position" | "status" | "createdAt" | "updatedAt" | TenantScopeFields
> & {
  position?: number;
  status?: RecordStatus;
};
export type UpdateCategory = Partial<
  Pick<Category, "name" | "position" | "progressionTrack" | "status">
>;

export interface CategoryFilter {
  search?: string;
  status?: RecordStatus;
}

