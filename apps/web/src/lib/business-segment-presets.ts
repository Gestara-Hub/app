import type {
  ClassesBusinessSegment,
  CustomSegmentProgression,
  ModalityProgressionTrack,
  ProgressionTrackTemplateKey,
} from "@gestarahub/contracts";
import { PROGRESSION_TEMPLATES, inferDefaultTrackForModalityName } from "./progression-tracks";

/**
 * Palavras que mudam conforme a area. Lutas fala em faixa e graduacao; as
 * outras areas, em nivel, modulo ou fase. Frases prontas porque o genero muda
 * o artigo ("a faixa", "o nivel").
 */
export interface SegmentVocabulary {
  /** "Faixa", "Nível", "Módulo", "Fase". */
  level: string;
  /** "Faixas", "Níveis"... */
  levelPlural: string;
  /** "Faixa atual". */
  currentLevel: string;
  /** "Nova faixa", "Novo nível". */
  newLevel: string;
  /** "Selecione a faixa", "Selecione o nível". */
  selectLevel: string;
  /** Placeholder do nome da etapa: "Nome da faixa", "Nome do nível". */
  levelName: string;
  /** "nesta faixa", "neste nível" (meio de frase). */
  inLevel: string;
  /** Substantivo do avanco: "Graduação", "Avanço". */
  promotion: string;
  /** Minusculo, para meio de frase: "graduação", "avanço". */
  promotionLower: string;
  /** Verbo do botao: "Graduar", "Avançar". */
  promoteVerb: string;
  /** "Prontos para graduar", "Prontos para avançar". */
  readyTitle: string;
  /** Selo do aluno apto: "Apto para graduar", "Apto para avançar". */
  readyBadge: string;
  /** "Graduado em", "Avançou em" (seguido da data). */
  promotedOn: string;
  /** "Data da graduação", "Data do avanço". */
  promotionDate: string;
  /** "Trilha de graduação", "Trilha de níveis". */
  trackTitle: string;
  /** Titulo da ficha do aluno: "Evolução e graduação", "Evolução e níveis". */
  /** Titulo do modal de graduacao/niveis: "Graduação", "Níveis", "Módulos". */
  levelsTitle: string;
}

export interface BusinessSegmentPreset {
  id: ClassesBusinessSegment;
  /** Nome curto da area ("Lutas", "Pilates e yoga"). */
  label: string;
  /** Uma linha de exemplos, sem reticencias ("Jiu-jitsu, judô, muay thai"). */
  examples: string;
  defaultModalities: string[];
  /**
   * Trilha das modalidades criadas no setup. `by_modality_name` infere pelo nome
   * (Jiu-Jitsu, Judô, Muay Thai); `null` cria sem trilha (pode ligar depois).
   */
  progressionTemplate: Exclude<ProgressionTrackTemplateKey, "custom"> | "by_modality_name" | null;
  /** Modelos de trilha sugeridos primeiro no editor da modalidade. */
  trackTemplates: Exclude<ProgressionTrackTemplateKey, "custom">[];
  /** Padroes do formulario de nova turma. */
  classDefaults: { durationMinutes: number; capacity: number };
  vocabulary: SegmentVocabulary;
}

function vocabulary(
  level: string,
  levelPlural: string,
  gender: "f" | "m",
  promotion: {
    noun: string;
    verb: string;
    ready: string;
    badge: string;
    promotedOn: string;
    date: string;
  },
): SegmentVocabulary {
  const lower = level.toLowerCase();
  const pluralLower = levelPlural.toLowerCase();
  const isMartial = promotion.noun === "Graduação";
  return {
    level,
    levelPlural,
    currentLevel: `${level} atual`,
    newLevel: gender === "f" ? `Nova ${lower}` : `Novo ${lower}`,
    selectLevel: gender === "f" ? `Selecione a ${lower}` : `Selecione o ${lower}`,
    levelName: gender === "f" ? `Nome da ${lower}` : `Nome do ${lower}`,
    inLevel: gender === "f" ? `nesta ${lower}` : `neste ${lower}`,
    promotion: promotion.noun,
    promotionLower: promotion.noun.toLowerCase(),
    promoteVerb: promotion.verb,
    readyTitle: promotion.ready,
    readyBadge: promotion.badge,
    promotedOn: promotion.promotedOn,
    promotionDate: promotion.date,
    trackTitle: isMartial ? "Trilha de graduação" : `Trilha de ${pluralLower}`,
    levelsTitle: isMartial ? "Graduação" : levelPlural,
  };
}

const ADVANCE = {
  noun: "Avanço",
  verb: "Avançar",
  ready: "Prontos para avançar",
  badge: "Apto para avançar",
  promotedOn: "Avançou em",
  date: "Data do avanço",
};

const GRADUATION = {
  noun: "Graduação",
  verb: "Graduar",
  ready: "Prontos para graduar",
  badge: "Apto para graduar",
  promotedOn: "Graduado em",
  date: "Data da graduação",
};

const BELT_VOCABULARY = vocabulary("Faixa", "Faixas", "f", GRADUATION);
const LEVEL_VOCABULARY = vocabulary("Nível", "Níveis", "m", ADVANCE);
const MODULE_VOCABULARY = vocabulary("Módulo", "Módulos", "m", ADVANCE);

/** Ordem das chaves = ordem no setup, na landing page e em Configuracoes. */
export const CLASSES_SEGMENT_PRESETS: Record<ClassesBusinessSegment, BusinessSegmentPreset> = {
  martial_arts: {
    id: "martial_arts",
    label: "Lutas",
    examples: "Jiu-jitsu, judô, muay thai",
    defaultModalities: ["Jiu-Jitsu", "Muay Thai", "Boxe", "Judô", "No-Gi / Submission"],
    progressionTemplate: "by_modality_name",
    trackTemplates: ["bjj_adult", "judo_karate", "muay_thai", "karate", "taekwondo", "capoeira", "kickboxing"],
    classDefaults: { durationMinutes: 60, capacity: 20 },
    vocabulary: BELT_VOCABULARY,
  },
  pilates_yoga: {
    id: "pilates_yoga",
    label: "Pilates e yoga",
    examples: "Solo, aparelho, meditação",
    defaultModalities: ["Pilates Reformer", "Pilates Solo", "Yoga", "Studio VIP"],
    progressionTemplate: null,
    trackTemplates: ["general_levels", "blank"],
    classDefaults: { durationMinutes: 50, capacity: 6 },
    vocabulary: LEVEL_VOCABULARY,
  },
  functional_training: {
    id: "functional_training",
    label: "Funcional e crossfit",
    examples: "Funcional, HIIT, calistenia",
    defaultModalities: ["CrossFit", "Treino Funcional", "HIIT & Cardio", "Calistenia"],
    progressionTemplate: null,
    trackTemplates: ["general_levels", "functional_categories", "blank"],
    classDefaults: { durationMinutes: 60, capacity: 15 },
    vocabulary: LEVEL_VOCABULARY,
  },
  dance: {
    id: "dance",
    label: "Dança",
    examples: "Balé, salão, ritmos",
    defaultModalities: ["Ballet Clássico", "Dança de Salão", "Ritmos", "Jazz"],
    progressionTemplate: "general_levels",
    trackTemplates: ["general_levels", "blank"],
    classDefaults: { durationMinutes: 60, capacity: 15 },
    vocabulary: LEVEL_VOCABULARY,
  },
  music: {
    id: "music",
    label: "Música",
    examples: "Violão, piano, canto",
    defaultModalities: ["Violão", "Piano e teclado", "Canto", "Bateria"],
    progressionTemplate: "modules",
    trackTemplates: ["modules", "blank"],
    classDefaults: { durationMinutes: 60, capacity: 6 },
    vocabulary: MODULE_VOCABULARY,
  },
  languages: {
    id: "languages",
    label: "Idiomas e reforço",
    examples: "Inglês, reforço, cursinho",
    defaultModalities: ["Inglês", "Espanhol", "Reforço escolar"],
    progressionTemplate: "general_levels",
    trackTemplates: ["language_cefr", "general_levels", "modules", "blank"],
    classDefaults: { durationMinutes: 60, capacity: 10 },
    vocabulary: LEVEL_VOCABULARY,
  },
  swimming_sports: {
    id: "swimming_sports",
    label: "Natação e esportes",
    examples: "Natação, futebol, tênis",
    defaultModalities: ["Natação Infantil", "Natação Adulto", "Hidroginástica", "Beach Tennis"],
    progressionTemplate: "swim_stages",
    trackTemplates: ["swim_stages", "general_levels", "blank"],
    classDefaults: { durationMinutes: 45, capacity: 8 },
    vocabulary: vocabulary("Fase", "Fases", "f", ADVANCE),
  },
  gastronomy: {
    id: "gastronomy",
    label: "Gastronomia",
    examples: "Confeitaria, pães, culinária",
    defaultModalities: ["Confeitaria", "Panificação", "Culinária", "Chocolateria"],
    progressionTemplate: "modules",
    trackTemplates: ["modules", "blank"],
    classDefaults: { durationMinutes: 120, capacity: 12 },
    vocabulary: MODULE_VOCABULARY,
  },
  arts_crafts: {
    id: "arts_crafts",
    label: "Artes e artesanato",
    examples: "Cerâmica, pintura, costura",
    defaultModalities: ["Cerâmica", "Desenho e pintura", "Costura", "Crochê e tricô"],
    progressionTemplate: "modules",
    trackTemplates: ["modules", "blank"],
    classDefaults: { durationMinutes: 120, capacity: 10 },
    vocabulary: MODULE_VOCABULARY,
  },
  beauty_courses: {
    id: "beauty_courses",
    label: "Beleza e cursos livres",
    examples: "Maquiagem, unhas, oratória",
    defaultModalities: ["Maquiagem", "Design de sobrancelha", "Manicure", "Oratória"],
    progressionTemplate: "modules",
    trackTemplates: ["modules", "blank"],
    classDefaults: { durationMinutes: 120, capacity: 12 },
    vocabulary: MODULE_VOCABULARY,
  },
  custom: {
    id: "custom",
    label: "Outra área",
    examples: "Teatro, xadrez, autoescola",
    defaultModalities: [],
    progressionTemplate: null,
    trackTemplates: ["general_levels", "blank"],
    classDefaults: { durationMinutes: 60, capacity: 10 },
    vocabulary: LEVEL_VOCABULARY,
  },
};

/** Tenants antigos (sem area salva) seguem como lutas: e o comportamento de antes. */
export const DEFAULT_CLASS_SEGMENT: ClassesBusinessSegment = "martial_arts";

/** Opcoes de "Como seus alunos avançam?" da area `custom` (setup e Configuracoes). */
export const CUSTOM_PROGRESSION_OPTIONS: { value: CustomSegmentProgression; label: string }[] = [
  { value: "belts", label: "Faixas" },
  { value: "levels", label: "Níveis" },
  { value: "modules", label: "Módulos" },
  { value: "none", label: "Não avançam" },
];

export const DEFAULT_CUSTOM_PROGRESSION: CustomSegmentProgression = "none";

/**
 * Area `custom` ajustada pela escolha do dono. Pre-calculadas para o hook
 * devolver sempre o mesmo objeto (referencia estavel entre renders).
 */
const CUSTOM_PRESETS: Record<CustomSegmentProgression, BusinessSegmentPreset> = {
  belts: {
    ...CLASSES_SEGMENT_PRESETS.custom,
    progressionTemplate: "judo_karate",
    trackTemplates: ["judo_karate", "karate", "capoeira", "general_levels", "blank"],
    vocabulary: BELT_VOCABULARY,
  },
  levels: {
    ...CLASSES_SEGMENT_PRESETS.custom,
    progressionTemplate: "general_levels",
    trackTemplates: ["general_levels", "blank"],
    vocabulary: LEVEL_VOCABULARY,
  },
  modules: {
    ...CLASSES_SEGMENT_PRESETS.custom,
    progressionTemplate: "modules",
    trackTemplates: ["modules", "blank"],
    vocabulary: MODULE_VOCABULARY,
  },
  none: CLASSES_SEGMENT_PRESETS.custom,
};

export function getAllSegmentPresets(): BusinessSegmentPreset[] {
  return Object.values(CLASSES_SEGMENT_PRESETS);
}

/**
 * Preset efetivo da area. Para `custom` (ou area desconhecida), a trilha e as
 * palavras seguem `customProgression` (ausente = sem etapas).
 */
export function getSegmentPreset(
  id: ClassesBusinessSegment | undefined,
  customProgression?: CustomSegmentProgression,
): BusinessSegmentPreset {
  const preset = CLASSES_SEGMENT_PRESETS[id ?? DEFAULT_CLASS_SEGMENT];
  if (preset && preset.id !== "custom") return preset;
  return CUSTOM_PRESETS[customProgression ?? DEFAULT_CUSTOM_PROGRESSION] ?? CLASSES_SEGMENT_PRESETS.custom;
}

const PROGRESSION_SUMMARY: Partial<Record<NonNullable<BusinessSegmentPreset["progressionTemplate"]>, string>> = {
  by_modality_name: "faixas e graus",
  bjj_adult: "faixas e graus",
  judo_karate: "faixas e graus",
  muay_thai: "faixas e graus",
  karate: "faixas e graus",
  taekwondo: "faixas e graus",
  capoeira: "faixas e graus",
  kickboxing: "faixas e graus",
  general_levels: "níveis",
  language_cefr: "níveis",
  functional_categories: "níveis",
  modules: "módulos",
  swim_stages: "fases",
};

/**
 * Como os alunos avancam na area, para frases de meio de texto ("faixas e
 * graus", "níveis", "módulos", "fases"). `null` quando a area nao tem trilha.
 */
export function segmentProgressionSummary(preset: BusinessSegmentPreset): string | null {
  const template = preset.progressionTemplate;
  if (template === null) return null;
  return PROGRESSION_SUMMARY[template] ?? "níveis";
}

/** Trilha de uma modalidade criada no setup, conforme a area escolhida. */
export function segmentTrackForModality(
  preset: BusinessSegmentPreset,
  modalityName: string,
): ModalityProgressionTrack | undefined {
  const template = preset.progressionTemplate;
  if (template === null) return undefined;
  if (template === "by_modality_name") {
    const inferred = inferDefaultTrackForModalityName(modalityName);
    return inferred.enabled ? inferred : undefined;
  }
  return structuredClone(PROGRESSION_TEMPLATES[template].track);
}

/**
 * Trilha inicial do formulario de modalidade: a da area, ou niveis gerais
 * desligados quando a area nao tem trilha (o switch liga depois).
 */
export function segmentDefaultTrack(
  preset: BusinessSegmentPreset,
  modalityName: string,
): ModalityProgressionTrack {
  return (
    segmentTrackForModality(preset, modalityName) ?? {
      ...structuredClone(PROGRESSION_TEMPLATES.general_levels.track),
      enabled: false,
    }
  );
}
