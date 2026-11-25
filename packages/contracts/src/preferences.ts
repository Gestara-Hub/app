export type ThemeMode = "light" | "dark" | "system";
export type DensityMode = "comfortable" | "compact";
export type ListViewMode = "list" | "grid";
/** Som ao marcar presente na chamada (09/11/2026): sintetizado no navegador, sem arquivo. */
export type CheckinSound = "confirm" | "beep" | "bell" | "drop" | "chord" | "marimba" | "soft";
export const CHECKIN_SOUNDS: readonly CheckinSound[] = ["confirm", "beep", "bell", "drop", "chord", "marimba", "soft"];

/**
 * Tema da pessoa: so a cor de destaque desde 31/10/2026 (cor base, cantos, menu,
 * fonte e estilo ficaram fixos). Preferencias antigas podem trazer outras
 * chaves; ninguem le mais.
 */
export interface ThemeStylingPreferences {
  themeColor?: string;
}

export interface UserPreferences {
  theme: ThemeMode;
  accentColor?: string;
  sidebarCollapsed: boolean;
  density: DensityMode;
  viewModes: Record<string, ListViewMode>;
  pageSizes?: Record<string, number>;
  defaultPageSize: number;
  audioFeedbackEnabled: boolean;
  /** Qual som toca ao marcar presente; sem valor, a confirmacao. */
  checkinSound?: CheckinSound;
  /** Som de sino quando chega lembrete novo, junto com o pulsar (12/11/2026); sem valor, ligado. */
  bellSoundEnabled?: boolean;
  onboarding: {
    dismissed: boolean;
    completedStepIds: string[];
  };
  dismissedAlertKeys: string[];
  /** Lembretes adiados ou ignorados (doc product/25): chave -> "yyyy-MM-dd" ou "never". */
  reminderSnoozes?: Record<string, string>;
  /** Itens de atencao e urgencia que estavam no sino na ultima vez que ele foi aberto (o sino pulsa so com item novo). */
  bellSeenKeys?: string[];
  /** Avisos urgentes cuja modal ja foi vista ("Ciente"): uma vez por item e por pessoa. */
  urgentSeenKeys?: string[];
  /** Aviso da verificacao em duas etapas (doc product/25, secao 5). */
  securityPrompt?: {
    /** Primeiro dia no app (conta os 7 dias de uso). */
    firstSeenAt?: string;
    /** "Agora não" (no maximo 3; depois, so o selo em Seguranca). */
    dismissCount?: number;
    lastDismissedAt?: string;
  };
  /** Dica do menu da conta no avatar (31/10/2026): uma vez por pessoa. */
  accountMenuTip?: {
    /** Primeiro dia no app (o "segundo dia de uso" conta daqui). */
    firstSeenAt?: string;
    /** Dia em que a dica apareceu; depois dele, nunca mais. */
    shownAt?: string;
  };
  /** Ultima versao de Novidades que a pessoa viu (doc technical/27); sem valor, ainda nao entrou depois das Novidades. */
  lastSeenRelease?: string;
  lastUnitId?: string;
  defaultCalendarView?: "day" | "week" | "month";
  themeStyling?: ThemeStylingPreferences;
  /**
   * Marcas de "ja vi" da pessoa (25/11/2026): boas-vindas, tours, dicas e o
   * cartao "Descobrir", em qualquer aparelho. Chave -> dia da marca (ISO) ou
   * "off" (desfeita, ex.: "Rever o tour"). Somadas a cada gravacao.
   */
  seen?: Record<string, string>;
}

/** Limites das marcas de "ja vi": quantas, tamanho da chave e do valor. */
export const SEEN_MARKS_MAX = 400;
const SEEN_KEY_MAX = 160;
const SEEN_VALUE_MAX = 40;

/** Junta as marcas (a do patch vale mais) e descarta o que foge do formato. */
export function mergeSeenMarks(
  base: Record<string, unknown> | undefined,
  patch: Record<string, unknown> | undefined,
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const source of [base, patch]) {
    if (!source || typeof source !== "object") continue;
    for (const [key, value] of Object.entries(source)) {
      if (typeof value !== "string" || key.length === 0 || key.length > SEEN_KEY_MAX || value.length > SEEN_VALUE_MAX) continue;
      merged[key] = value;
    }
  }
  const entries = Object.entries(merged);
  // Teto: as mais novas ficam (as datas ISO ordenam; "off" vai para o fim da fila).
  return entries.length <= SEEN_MARKS_MAX
    ? merged
    : Object.fromEntries(entries.sort((a, b) => (a[1] < b[1] ? 1 : -1)).slice(0, SEEN_MARKS_MAX));
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: "system",
  sidebarCollapsed: false,
  density: "comfortable",
  viewModes: {
    clients: "list",
    turmas: "list",
  },
  pageSizes: {},
  defaultPageSize: 20,
  audioFeedbackEnabled: true,
  checkinSound: "confirm",
  bellSoundEnabled: true,
  onboarding: {
    dismissed: false,
    completedStepIds: [],
  },
  dismissedAlertKeys: [],
  themeStyling: {
    themeColor: "zinc",
  },
};

export function mergeUserPreferences(
  current: Partial<UserPreferences> | null | undefined,
  patch: Partial<UserPreferences>,
): UserPreferences {
  const base = current ?? DEFAULT_USER_PREFERENCES;
  return {
    ...DEFAULT_USER_PREFERENCES,
    ...base,
    ...patch,
    themeStyling: {
      ...(DEFAULT_USER_PREFERENCES.themeStyling ?? {}),
      ...(base.themeStyling ?? {}),
      ...(patch.themeStyling ?? {}),
    },
    viewModes: {
      ...DEFAULT_USER_PREFERENCES.viewModes,
      ...(base.viewModes ?? {}),
      ...(patch.viewModes ?? {}),
    },
    pageSizes: {
      ...(DEFAULT_USER_PREFERENCES.pageSizes ?? {}),
      ...(base.pageSizes ?? {}),
      ...(patch.pageSizes ?? {}),
    },
    onboarding: {
      ...DEFAULT_USER_PREFERENCES.onboarding,
      ...(base.onboarding ?? {}),
      ...(patch.onboarding ?? {}),
    },
    dismissedAlertKeys: Array.from(
      new Set([
        ...(base.dismissedAlertKeys ?? []),
        ...(patch.dismissedAlertKeys ?? []),
      ]),
    ),
    seen: mergeSeenMarks(base.seen, patch.seen),
  };
}
