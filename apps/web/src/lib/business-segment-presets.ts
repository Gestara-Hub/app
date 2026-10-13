import type {
  ClassesBusinessSegment,
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
  label: string;
  badge: string;
  description: string;
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

export const CLASSES_SEGMENT_PRESETS: Record<ClassesBusinessSegment, BusinessSegmentPreset> = {
  martial_arts: {
    id: "martial_arts",
    label: "Lutas & Artes Marciais",
    badge: "Tatame & Faixas",
    description: "Chamada no tatame e esteira de faixas.",
    examples: "Jiu-Jitsu • Muay Thai • Judô • Boxe",
    defaultModalities: ["Jiu-Jitsu", "Muay Thai", "Boxe", "Judô", "No-Gi / Submission"],
    progressionTemplate: "by_modality_name",
    trackTemplates: ["bjj_adult", "judo_karate", "muay_thai", "karate", "taekwondo", "capoeira", "kickboxing"],
    classDefaults: { durationMinutes: 60, capacity: 20 },
    vocabulary: vocabulary("Faixa", "Faixas", "f", {
      noun: "Graduação",
      verb: "Graduar",
      ready: "Prontos para graduar",
      badge: "Apto para graduar",
      promotedOn: "Graduado em",
      date: "Data da graduação",
    }),
  },
  pilates_yoga: {
    id: "pilates_yoga",
    label: "Pilates & Yoga",
    badge: "Grupo ou 1 a 1",
    description: "Turmas pequenas e aulas particulares.",
    examples: "Reformer • Solo • Studio VIP",
    defaultModalities: ["Pilates Reformer", "Pilates Solo", "Yoga", "Studio VIP"],
    progressionTemplate: null,
    trackTemplates: ["general_levels", "blank"],
    classDefaults: { durationMinutes: 50, capacity: 6 },
    vocabulary: vocabulary("Nível", "Níveis", "m", ADVANCE),
  },
  music_languages: {
    id: "music_languages",
    label: "Música & Idiomas",
    badge: "Grupo ou VIP",
    description: "Aulas particulares ou turmas por módulos.",
    examples: "Inglês • Espanhol • Violão • Piano",
    defaultModalities: ["Inglês", "Espanhol", "Violão", "Piano & Teclado", "Canto"],
    progressionTemplate: "modules",
    trackTemplates: ["modules", "language_cefr", "blank"],
    classDefaults: { durationMinutes: 60, capacity: 8 },
    vocabulary: vocabulary("Módulo", "Módulos", "m", ADVANCE),
  },
  dance: {
    id: "dance",
    label: "Dança & Movimento",
    badge: "Níveis & Turmas",
    description: "Turmas por nível e aulas particulares.",
    examples: "Ballet • Salão • Ritmos • Jazz",
    defaultModalities: ["Ballet Clássico", "Dança de Salão", "Ritmos", "Jazz"],
    progressionTemplate: "general_levels",
    trackTemplates: ["general_levels", "blank"],
    classDefaults: { durationMinutes: 60, capacity: 15 },
    vocabulary: vocabulary("Nível", "Níveis", "m", ADVANCE),
  },
  functional_training: {
    id: "functional_training",
    label: "Boxes & Funcional",
    badge: "Lotação & Fila",
    description: "Bloqueio ao lotar e fila de espera automática.",
    examples: "CrossFit • Funcional • HIIT • Calistenia",
    defaultModalities: ["CrossFit", "Treino Funcional", "HIIT & Cardio", "Calistenia"],
    progressionTemplate: null,
    trackTemplates: ["general_levels", "functional_categories", "blank"],
    classDefaults: { durationMinutes: 60, capacity: 15 },
    vocabulary: vocabulary("Nível", "Níveis", "m", ADVANCE),
  },
  swimming_sports: {
    id: "swimming_sports",
    label: "Natação & Esportes",
    badge: "Fases & Presença",
    description: "Turmas por fase e controle de presença.",
    examples: "Natação • Hidroginástica • Beach Tennis",
    defaultModalities: ["Natação Infantil", "Natação Adulto", "Hidroginástica", "Beach Tennis"],
    progressionTemplate: "swim_stages",
    trackTemplates: ["swim_stages", "general_levels", "blank"],
    classDefaults: { durationMinutes: 45, capacity: 8 },
    vocabulary: vocabulary("Fase", "Fases", "f", ADVANCE),
  },
  custom: {
    id: "custom",
    label: "Outra modalidade?",
    badge: "Personalizado",
    description: "Regras flexíveis para o seu jeito de ensinar.",
    examples: "Natação • Tênis • Cursos Livres",
    defaultModalities: [],
    progressionTemplate: null,
    trackTemplates: ["general_levels", "blank"],
    classDefaults: { durationMinutes: 60, capacity: 10 },
    vocabulary: vocabulary("Nível", "Níveis", "m", ADVANCE),
  },
};

/** Tenants antigos (sem area salva) seguem como lutas: e o comportamento de antes. */
export const DEFAULT_CLASS_SEGMENT: ClassesBusinessSegment = "martial_arts";

export function getAllSegmentPresets(): BusinessSegmentPreset[] {
  return Object.values(CLASSES_SEGMENT_PRESETS);
}

export function getSegmentPreset(id: ClassesBusinessSegment | undefined): BusinessSegmentPreset {
  return CLASSES_SEGMENT_PRESETS[id ?? DEFAULT_CLASS_SEGMENT] ?? CLASSES_SEGMENT_PRESETS.custom;
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
