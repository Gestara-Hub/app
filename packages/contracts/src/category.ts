import type { ModalityAssessmentSettings } from "./assessment";
import type { ModalityMeasurementSettings } from "./measurement";
import type { DateTimeISO, Id, RecordStatus, TenantScopeFields } from "./common";
import type { CertificateTemplate } from "./certificate";

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
  | "karate"
  | "taekwondo"
  | "capoeira"
  | "kickboxing"
  | "general_levels"
  | "modules"
  | "language_cefr"
  | "swim_stages"
  | "functional_categories"
  | "blank"
  | "custom";

/**
 * Visual da trilha. `belt`: faixa/corda com ponta e graus (lutas). `levels`:
 * etiqueta simples, cor opcional e sem subniveis (demais areas).
 */
export type ProgressionTrackStyle = "belt" | "levels";

export interface ProgressionLevelStep {
  id: string;
  name: string;
  /** Opcional no estilo `levels` (sem cor = etiqueta neutra). */
  color?: ProgressionBeltColor;
  tipColor?: ProgressionBeltColor;
  maxSubLevels: number;
  /** Idade minima para o nivel (inclusive). Ausente = sem minimo. */
  minAge?: number;
  /** Idade maxima para o nivel (inclusive). Ausente = sem maximo. */
  maxAge?: number;
}

export interface ModalityProgressionTrack {
  enabled: boolean;
  /** Ausente em trilhas antigas: resolvido por `resolveTrackStyle`. */
  style?: ProgressionTrackStyle;
  templateKey?: ProgressionTrackTemplateKey;
  criteriaType: ProgressionCriteriaType;
  targetAttendances?: number;
  targetMonths?: number;
  levels: ProgressionLevelStep[];
}

/**
 * Cor da modalidade no Calendario e nas listas (doc product/29
 * §Calendario, versao 2 de 13/11/2026, expandida para 14 cores).
 * Ordem inicial = a da versao 1. O roxo (`violet`) fica so para Evento.
 */
export type ModalityColorKey =
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "cyan"
  | "orange"
  | "lime"
  | "stone"
  | "indigo"
  | "teal"
  | "pink"
  | "red"
  | "sky"
  | "yellow";

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
  /** Avaliacoes e notas (doc 21 §2.1). Ausente = desligado. */
  assessments?: ModalityAssessmentSettings;
  /** Testes e medidas (doc 21 §2.4). Ausente = desligado. */
  measurements?: ModalityMeasurementSettings;
  /** Modelo de certificado so desta modalidade (doc 21 §1). Ausente = o do espaco. */
  certificateTemplate?: CertificateTemplate;
  /** Modelo do certificado de graduacao so desta modalidade (doc 21 §1.6); ausente = o do espaco. */
  graduationCertificateTemplate?: CertificateTemplate;
  /** Cor no Calendario. Ausente (dado antigo do mock) = a cor pela ordem de criacao. */
  color?: ModalityColorKey;
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
  Pick<Category, "name" | "position" | "progressionTrack" | "assessments" | "measurements" | "color" | "status">
>;

export interface CategoryFilter {
  search?: string;
  status?: RecordStatus;
}

