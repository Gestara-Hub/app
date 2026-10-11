import type { ClassesBusinessSegment } from "@gestarahub/contracts";

export interface BusinessSegmentPreset {
  id: ClassesBusinessSegment;
  label: string;
  badge: string;
  description: string;
  defaultModalities: string[];
  examples: string;
  defaultProgressionEnabled: boolean;
}

export const CLASSES_SEGMENT_PRESETS: Record<ClassesBusinessSegment, BusinessSegmentPreset> = {
  martial_arts: {
    id: "martial_arts",
    label: "Lutas & Artes Marciais",
    badge: "Tatame & Faixas",
    description: "Chamada no tatame e esteira de faixas.",
    defaultModalities: ["Jiu-Jitsu", "Muay Thai", "Boxe", "Judô", "No-Gi / Submission"],
    examples: "Jiu-Jitsu • Muay Thai • Judô • Boxe",
    defaultProgressionEnabled: true,
  },
  fitness_wellness: {
    id: "fitness_wellness",
    label: "Pilates & Yoga",
    badge: "Aparelhos & VIP",
    description: "Limite por aparelho e reposições organizadas.",
    defaultModalities: ["Pilates Reformer", "Pilates Solo", "Yoga", "Studio VIP"],
    examples: "Reformer • Solo • Studio VIP",
    defaultProgressionEnabled: false,
  },
  education_courses: {
    id: "education_courses",
    label: "Música & Idiomas",
    badge: "Grupo ou VIP",
    description: "Aulas particulares ou turmas por módulos.",
    defaultModalities: ["Inglês", "Espanhol", "Violão", "Piano & Teclado", "Canto"],
    examples: "Inglês • Espanhol • Violão • Piano",
    defaultProgressionEnabled: true,
  },
  dance_arts: {
    id: "dance_arts",
    label: "Dança & Movimento",
    badge: "Níveis & Turmas",
    description: "Turmas por nível e ensaios particulares.",
    defaultModalities: ["Ballet Clássico", "Dança de Salão", "Ritmos", "Jazz"],
    examples: "Ballet • Salão • Ritmos • Jazz",
    defaultProgressionEnabled: true,
  },
  crossfit_functional: {
    id: "crossfit_functional",
    label: "Boxes & Funcional",
    badge: "Lotação & Fila",
    description: "Bloqueio ao lotar e fila de espera automática.",
    defaultModalities: ["CrossFit", "Treino Funcional", "HIIT & Cardio", "Calistenia"],
    examples: "CrossFit • Funcional • HIIT • Calistenia",
    defaultProgressionEnabled: false,
  },
  aquatics_sports: {
    id: "aquatics_sports",
    label: "Natação & Esportes",
    badge: "Turmas & Raia",
    description: "Turmas por idade e controle de presença.",
    defaultModalities: ["Natação Infantil", "Natação Adulto", "Hidroginástica", "Beach Tennis"],
    examples: "Natação • Hidroginástica • Beach Tennis",
    defaultProgressionEnabled: true,
  },
  custom: {
    id: "custom",
    label: "Outra modalidade?",
    badge: "Personalizado",
    description: "Regras flexíveis para o seu jeito de ensinar.",
    defaultModalities: [],
    examples: "Natação • Tênis • Cursos Livres",
    defaultProgressionEnabled: false,
  },
};

export function getAllSegmentPresets(): BusinessSegmentPreset[] {
  return Object.values(CLASSES_SEGMENT_PRESETS);
}

export function getSegmentPreset(id: ClassesBusinessSegment): BusinessSegmentPreset {
  return CLASSES_SEGMENT_PRESETS[id] ?? CLASSES_SEGMENT_PRESETS.custom;
}
