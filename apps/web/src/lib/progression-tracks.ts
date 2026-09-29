import type {
  ModalityProgressionTrack,
  ProgressionBeltColor,
  ProgressionCriteriaType,
  ProgressionLevelStep,
  ProgressionTrackTemplateKey,
} from "@gestarahub/contracts";

export interface BeltColorVisual {
  label: string;
  swatchClass: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  barFill: string;
  tipBg: string;
}

export const BELT_COLOR_META: Record<ProgressionBeltColor, BeltColorVisual> = {
  white: {
    label: "Branca",
    swatchClass: "bg-white border border-zinc-300",
    badgeBg: "bg-zinc-100 dark:bg-zinc-800",
    badgeText: "text-zinc-900 dark:text-zinc-100",
    badgeBorder: "border-zinc-300 dark:border-zinc-600",
    barFill: "bg-zinc-200 border border-zinc-300",
    tipBg: "bg-zinc-900",
  },
  gray: {
    label: "Cinza",
    swatchClass: "bg-zinc-400",
    badgeBg: "bg-zinc-200/80 dark:bg-zinc-700/60",
    badgeText: "text-zinc-800 dark:text-zinc-100",
    badgeBorder: "border-zinc-400/60",
    barFill: "bg-zinc-400",
    tipBg: "bg-zinc-900",
  },
  yellow: {
    label: "Amarela",
    swatchClass: "bg-amber-400",
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-800 dark:text-amber-300",
    badgeBorder: "border-amber-500/35",
    barFill: "bg-amber-400",
    tipBg: "bg-zinc-900",
  },
  orange: {
    label: "Laranja",
    swatchClass: "bg-orange-500",
    badgeBg: "bg-orange-500/15",
    badgeText: "text-orange-800 dark:text-orange-300",
    badgeBorder: "border-orange-500/35",
    barFill: "bg-orange-500",
    tipBg: "bg-zinc-900",
  },
  green: {
    label: "Verde",
    swatchClass: "bg-emerald-600",
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-800 dark:text-emerald-300",
    badgeBorder: "border-emerald-500/35",
    barFill: "bg-emerald-600",
    tipBg: "bg-zinc-900",
  },
  blue: {
    label: "Azul",
    swatchClass: "bg-blue-600",
    badgeBg: "bg-blue-500/15",
    badgeText: "text-blue-800 dark:text-blue-300",
    badgeBorder: "border-blue-500/35",
    barFill: "bg-blue-600",
    tipBg: "bg-zinc-900",
  },
  purple: {
    label: "Roxa",
    swatchClass: "bg-purple-600",
    badgeBg: "bg-purple-500/15",
    badgeText: "text-purple-800 dark:text-purple-300",
    badgeBorder: "border-purple-500/35",
    barFill: "bg-purple-600",
    tipBg: "bg-zinc-900",
  },
  brown: {
    label: "Marrom",
    swatchClass: "bg-amber-900",
    badgeBg: "bg-amber-900/15 dark:bg-amber-900/30",
    badgeText: "text-amber-950 dark:text-amber-200",
    badgeBorder: "border-amber-900/35",
    barFill: "bg-amber-900",
    tipBg: "bg-zinc-900",
  },
  black: {
    label: "Preta",
    swatchClass: "bg-zinc-950 border border-zinc-700",
    badgeBg: "bg-zinc-900 text-zinc-50 dark:bg-zinc-950",
    badgeText: "text-zinc-50",
    badgeBorder: "border-zinc-700",
    barFill: "bg-zinc-900",
    tipBg: "bg-red-700",
  },
  red: {
    label: "Vermelha",
    swatchClass: "bg-red-600",
    badgeBg: "bg-red-500/15",
    badgeText: "text-red-800 dark:text-red-300",
    badgeBorder: "border-red-500/35",
    barFill: "bg-red-600",
    tipBg: "bg-zinc-900",
  },
  slate: {
    label: "Neutra / Nível",
    swatchClass: "bg-slate-500",
    badgeBg: "bg-slate-500/15",
    badgeText: "text-slate-800 dark:text-slate-200",
    badgeBorder: "border-slate-500/30",
    barFill: "bg-slate-500",
    tipBg: "bg-slate-800",
  },
};

export const CRITERIA_TYPE_LABELS: Record<ProgressionCriteriaType, string> = {
  attendance: "Por quantidade de aulas",
  time: "Por tempo mínimo no nível",
  attendance_and_time: "Por aulas + tempo mínimo",
  manual_exam: "Apenas avaliação / exame do professor",
};

export const PROGRESSION_TEMPLATES: Record<
  Exclude<ProgressionTrackTemplateKey, "custom">,
  {
    label: string;
    description: string;
    track: ModalityProgressionTrack;
  }
> = {
  bjj_adult: {
    label: "Jiu-Jitsu (Faixas + 4 Graus)",
    description:
      "Branca → Cinza → Amarela → Laranja → Verde → Azul → Roxa → Marrom → Preta.",
    track: {
      enabled: true,
      templateKey: "bjj_adult",
      criteriaType: "attendance_and_time",
      targetAttendances: 30,
      targetMonths: 6,
      levels: [
        { id: "lvl-white", name: "Faixa Branca", color: "white", maxSubLevels: 4 },
        { id: "lvl-kids-gray", name: "Faixa Cinza", color: "gray", maxSubLevels: 4 },
        { id: "lvl-kids-yellow", name: "Faixa Amarela", color: "yellow", maxSubLevels: 4 },
        { id: "lvl-kids-orange", name: "Faixa Laranja", color: "orange", maxSubLevels: 4 },
        { id: "lvl-kids-green", name: "Faixa Verde", color: "green", maxSubLevels: 4 },
        { id: "lvl-blue", name: "Faixa Azul", color: "blue", maxSubLevels: 4 },
        { id: "lvl-purple", name: "Faixa Roxa", color: "purple", maxSubLevels: 4 },
        { id: "lvl-brown", name: "Faixa Marrom", color: "brown", maxSubLevels: 4 },
        { id: "lvl-black", name: "Faixa Preta", color: "black", maxSubLevels: 6 },
      ],
    },
  },
  judo_karate: {
    label: "Judô (CBJ — Infantil ao Adulto)",
    description: "Todas as faixas e pontas da CBJ (Branca até Preta).",
    track: {
      enabled: true,
      templateKey: "judo_karate",
      criteriaType: "attendance_and_time",
      targetAttendances: 40,
      targetMonths: 6,
      levels: [
        { id: "lvl-jk-white", name: "Faixa Branca", color: "white", maxSubLevels: 0 },
        { id: "lvl-jk-white-gray", name: "Branca Ponta Cinza", color: "white", tipColor: "gray", maxSubLevels: 0 },
        { id: "lvl-jk-gray", name: "Faixa Cinza", color: "gray", maxSubLevels: 0 },
        { id: "lvl-jk-gray-blue", name: "Cinza Ponta Azul", color: "gray", tipColor: "blue", maxSubLevels: 0 },
        { id: "lvl-jk-blue", name: "Faixa Azul", color: "blue", maxSubLevels: 0 },
        { id: "lvl-jk-blue-yellow", name: "Azul Ponta Amarela", color: "blue", tipColor: "yellow", maxSubLevels: 0 },
        { id: "lvl-jk-yellow", name: "Faixa Amarela", color: "yellow", maxSubLevels: 0 },
        { id: "lvl-jk-yellow-orange", name: "Amarela Ponta Laranja", color: "yellow", tipColor: "orange", maxSubLevels: 0 },
        { id: "lvl-jk-orange", name: "Faixa Laranja", color: "orange", maxSubLevels: 0 },
        { id: "lvl-jk-green", name: "Faixa Verde", color: "green", maxSubLevels: 0 },
        { id: "lvl-jk-purple", name: "Faixa Roxa", color: "purple", maxSubLevels: 0 },
        { id: "lvl-jk-brown", name: "Faixa Marrom", color: "brown", maxSubLevels: 0 },
        { id: "lvl-jk-black", name: "Faixa Preta", color: "black", maxSubLevels: 5 },
      ],
    },
  },
  muay_thai: {
    label: "Muay Thai (CBMT — Kruang / Prajied)",
    description: "Branco → Ponta Vermelha → Vermelho → Ponta Azul → Azul Claro → Ponta Azul Escuro → Azul Escuro → Ponta Preta → Preto.",
    track: {
      enabled: true,
      templateKey: "muay_thai",
      criteriaType: "attendance",
      targetAttendances: 40,
      targetMonths: 6,
      levels: [
        { id: "lvl-mt-white", name: "Kruang Branco", color: "white", maxSubLevels: 0 },
        { id: "lvl-mt-red-tip", name: "Branco Ponta Vermelha", color: "white", tipColor: "red", maxSubLevels: 0 },
        { id: "lvl-mt-red", name: "Kruang Vermelho", color: "red", maxSubLevels: 0 },
        { id: "lvl-mt-red-blue-tip", name: "Vermelho Ponta Azul Claro", color: "red", tipColor: "blue", maxSubLevels: 0 },
        { id: "lvl-mt-light-blue", name: "Kruang Azul Claro", color: "blue", maxSubLevels: 0 },
        { id: "lvl-mt-blue-dark-tip", name: "Azul Claro Ponta Azul Escuro", color: "blue", tipColor: "purple", maxSubLevels: 0 },
        { id: "lvl-mt-dark-blue", name: "Kruang Azul Escuro", color: "purple", maxSubLevels: 0 },
        { id: "lvl-mt-dark-black-tip", name: "Azul Escuro Ponta Preta", color: "purple", tipColor: "black", maxSubLevels: 0 },
        { id: "lvl-mt-black", name: "Kruang Preto", color: "black", maxSubLevels: 0 },
      ],
    },
  },
  general_levels: {
    label: "Níveis Gerais (Iniciante → Avançado)",
    description: "Ideal para funcional, pilates, natação, dança, cross ou cursos.",
    track: {
      enabled: true,
      templateKey: "general_levels",
      criteriaType: "attendance",
      targetAttendances: 24,
      targetMonths: 6,
      levels: [
        { id: "lvl-gen-beg", name: "Iniciante", color: "white", maxSubLevels: 0 },
        { id: "lvl-gen-int", name: "Intermediário", color: "blue", maxSubLevels: 0 },
        { id: "lvl-gen-adv", name: "Avançado", color: "purple", maxSubLevels: 0 },
        { id: "lvl-gen-pro", name: "Competidor / Especialista", color: "black", maxSubLevels: 0 },
      ],
    },
  },
};

const COLOR_KEYWORDS: Array<{ keywords: string[]; color: ProgressionBeltColor }> = [
  { keywords: ["ponta cinza", "/ cinza", "e cinza"], color: "gray" },
  { keywords: ["ponta azul", "/ azul", "e azul"], color: "blue" },
  { keywords: ["ponta amarela", "ponta amarelo", "/ amarela", "/ amarelo", "e amarela"], color: "yellow" },
  { keywords: ["ponta laranja", "/ laranja", "e laranja"], color: "orange" },
  { keywords: ["ponta verde", "/ verde", "e verde"], color: "green" },
  { keywords: ["ponta roxa", "ponta roxo", "/ roxa", "/ roxo", "e roxa"], color: "purple" },
  { keywords: ["ponta marrom", "/ marrom", "e marrom"], color: "brown" },
  { keywords: ["ponta preta", "ponta preto", "/ preta", "/ preto", "e preta"], color: "black" },
  { keywords: ["ponta vermelha", "ponta vermelho", "/ vermelha", "/ vermelho", "e vermelha"], color: "red" },
  { keywords: ["ponta branca", "ponta branco", "/ branca", "/ branco", "e branca"], color: "white" },
];

export function extractTipColorFromText(
  levelName: string,
  primaryColor?: ProgressionBeltColor,
): ProgressionBeltColor | null {
  const lower = levelName.toLowerCase();
  for (const entry of COLOR_KEYWORDS) {
    if (entry.color !== primaryColor && entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.color;
    }
  }
  return null;
}

export function inferTipColorFromLevelName(
  levelName: string,
  primaryColor: ProgressionBeltColor,
  explicitTipColor?: ProgressionBeltColor,
): ProgressionBeltColor | null {
  const fromText = extractTipColorFromText(levelName, primaryColor);
  if (fromText) {
    return fromText;
  }
  if (explicitTipColor && explicitTipColor !== primaryColor) {
    return explicitTipColor;
  }
  return null;
}

export function isMartialArtsLevelName(levelName: string): boolean {
  const lower = levelName.toLowerCase();
  return (
    lower.includes("faixa") ||
    lower.includes("kruang") ||
    lower.includes("prajied") ||
    lower.includes("corda") ||
    lower.includes("cordel") ||
    lower.includes("ponta ") ||
    lower.includes("dan") ||
    lower.includes("kyu") ||
    lower.includes("grau")
  );
}

export function inferDefaultTrackForModalityName(
  modalityName: string,
): ModalityProgressionTrack {
  const lower = modalityName.toLowerCase();
  if (
    lower.includes("jiu") ||
    lower.includes("bjj") ||
    lower.includes("no-gi") ||
    lower.includes("nogi") ||
    lower.includes("submission") ||
    lower.includes("kimono") ||
    lower.includes("kids") ||
    lower.includes("infantil")
  ) {
    return structuredClone(PROGRESSION_TEMPLATES.bjj_adult.track);
  }
  if (lower.includes("judo") || lower.includes("judô")) {
    return structuredClone(PROGRESSION_TEMPLATES.judo_karate.track);
  }
  if (lower.includes("karate") || lower.includes("karatê")) {
    return {
      enabled: true,
      templateKey: "custom",
      criteriaType: "attendance_and_time",
      targetAttendances: 40,
      targetMonths: 6,
      levels: [
        { id: "lvl-kar-white", name: "Faixa Branca", color: "white", maxSubLevels: 0 },
        { id: "lvl-kar-yellow", name: "Faixa Amarela", color: "yellow", maxSubLevels: 0 },
        { id: "lvl-kar-orange", name: "Faixa Laranja", color: "orange", maxSubLevels: 0 },
        { id: "lvl-kar-green", name: "Faixa Verde", color: "green", maxSubLevels: 0 },
        { id: "lvl-kar-blue", name: "Faixa Azul", color: "blue", maxSubLevels: 0 },
        { id: "lvl-kar-purple", name: "Faixa Roxa", color: "purple", maxSubLevels: 0 },
        { id: "lvl-kar-brown", name: "Faixa Marrom", color: "brown", maxSubLevels: 0 },
        { id: "lvl-kar-black", name: "Faixa Preta", color: "black", maxSubLevels: 5 },
      ],
    };
  }
  if (lower.includes("taekwondo")) {
    return {
      enabled: true,
      templateKey: "custom",
      criteriaType: "attendance_and_time",
      targetAttendances: 36,
      targetMonths: 6,
      levels: [
        { id: "lvl-tkd-white", name: "Faixa Branca", color: "white", maxSubLevels: 0 },
        { id: "lvl-tkd-white-yellow", name: "Branca Ponta Amarela", color: "white", tipColor: "yellow", maxSubLevels: 0 },
        { id: "lvl-tkd-yellow", name: "Faixa Amarela", color: "yellow", maxSubLevels: 0 },
        { id: "lvl-tkd-yellow-green", name: "Amarela Ponta Verde", color: "yellow", tipColor: "green", maxSubLevels: 0 },
        { id: "lvl-tkd-green", name: "Faixa Verde", color: "green", maxSubLevels: 0 },
        { id: "lvl-tkd-green-blue", name: "Verde Ponta Azul", color: "green", tipColor: "blue", maxSubLevels: 0 },
        { id: "lvl-tkd-blue", name: "Faixa Azul", color: "blue", maxSubLevels: 0 },
        { id: "lvl-tkd-blue-red", name: "Azul Ponta Vermelha", color: "blue", tipColor: "red", maxSubLevels: 0 },
        { id: "lvl-tkd-red", name: "Faixa Vermelha", color: "red", maxSubLevels: 0 },
        { id: "lvl-tkd-red-black", name: "Vermelha Ponta Preta", color: "red", tipColor: "black", maxSubLevels: 0 },
        { id: "lvl-tkd-black", name: "Faixa Preta", color: "black", maxSubLevels: 5 },
      ],
    };
  }
  if (lower.includes("kickboxing") || lower.includes("krav")) {
    return {
      enabled: true,
      templateKey: "custom",
      criteriaType: "attendance_and_time",
      targetAttendances: 40,
      targetMonths: 6,
      levels: [
        { id: "lvl-kb-white", name: "Faixa Branca", color: "white", maxSubLevels: 0 },
        { id: "lvl-kb-yellow", name: "Faixa Amarela", color: "yellow", maxSubLevels: 0 },
        { id: "lvl-kb-orange", name: "Faixa Laranja", color: "orange", maxSubLevels: 0 },
        { id: "lvl-kb-green", name: "Faixa Verde", color: "green", maxSubLevels: 0 },
        { id: "lvl-kb-blue", name: "Faixa Azul", color: "blue", maxSubLevels: 0 },
        { id: "lvl-kb-brown", name: "Faixa Marrom", color: "brown", maxSubLevels: 0 },
        { id: "lvl-kb-black", name: "Faixa Preta", color: "black", maxSubLevels: 5 },
      ],
    };
  }
  if (lower.includes("capoeira")) {
    return {
      enabled: true,
      templateKey: "custom",
      criteriaType: "attendance_and_time",
      targetAttendances: 40,
      targetMonths: 6,
      levels: [
        { id: "lvl-cap-white", name: "Corda Crua", color: "white", maxSubLevels: 0 },
        { id: "lvl-cap-white-yellow", name: "Crua Ponta Amarela", color: "white", tipColor: "yellow", maxSubLevels: 0 },
        { id: "lvl-cap-yellow", name: "Corda Amarela", color: "yellow", maxSubLevels: 0 },
        { id: "lvl-cap-yellow-orange", name: "Amarela Ponta Laranja", color: "yellow", tipColor: "orange", maxSubLevels: 0 },
        { id: "lvl-cap-orange", name: "Corda Laranja", color: "orange", maxSubLevels: 0 },
        { id: "lvl-cap-orange-blue", name: "Laranja Ponta Azul", color: "orange", tipColor: "blue", maxSubLevels: 0 },
        { id: "lvl-cap-blue", name: "Corda Azul", color: "blue", maxSubLevels: 0 },
        { id: "lvl-cap-green", name: "Corda Verde", color: "green", maxSubLevels: 0 },
        { id: "lvl-cap-purple", name: "Corda Roxa", color: "purple", maxSubLevels: 0 },
        { id: "lvl-cap-brown", name: "Corda Marrom", color: "brown", maxSubLevels: 0 },
        { id: "lvl-cap-red", name: "Corda Vermelha", color: "red", maxSubLevels: 0 },
      ],
    };
  }
  if (lower.includes("muay") || lower.includes("thai")) {
    return structuredClone(PROGRESSION_TEMPLATES.muay_thai.track);
  }
  return {
    ...structuredClone(PROGRESSION_TEMPLATES.general_levels.track),
    enabled: false,
  };
}

export function resolveModalityTrack(
  modality?: { name?: string; progressionTrack?: ModalityProgressionTrack },
): ModalityProgressionTrack {
  if (modality?.progressionTrack) {
    return modality.progressionTrack;
  }
  return inferDefaultTrackForModalityName(modality?.name ?? "");
}

export function computeNextPromotionStep(
  track: ModalityProgressionTrack,
  currentLevelIdOrName: string,
  currentSubLevel: number,
): {
  nextLevel: ProgressionLevelStep;
  nextSubLevel: number;
  isNewBelt: boolean;
} | null {
  if (!track.levels.length) return null;
  const idx = track.levels.findIndex(
    (l) =>
      l.id === currentLevelIdOrName ||
      l.name.toLowerCase() === currentLevelIdOrName.toLowerCase(),
  );
  const currentStep = idx >= 0 ? track.levels[idx] : track.levels[0];
  const currentIndex = idx >= 0 ? idx : 0;

  if (currentSubLevel < currentStep.maxSubLevels) {
    return {
      nextLevel: currentStep,
      nextSubLevel: currentSubLevel + 1,
      isNewBelt: false,
    };
  }
  if (currentIndex + 1 < track.levels.length) {
    return {
      nextLevel: track.levels[currentIndex + 1],
      nextSubLevel: 0,
      isNewBelt: true,
    };
  }
  return null;
}

export function formatTrackSummary(track?: ModalityProgressionTrack): string | null {
  if (!track || !track.enabled || track.levels.length === 0) return null;
  const count = track.levels.length;
  const criteria =
    track.criteriaType === "attendance"
      ? `${track.targetAttendances ?? 30} aulas`
      : track.criteriaType === "time"
        ? `${track.targetMonths ?? 6} meses`
        : track.criteriaType === "attendance_and_time"
          ? `${track.targetAttendances ?? 30} aulas e ${track.targetMonths ?? 6}m`
          : "Exame livre";
  return `${count} ${count === 1 ? "nível" : "níveis"} • Meta: ${criteria}`;
}
