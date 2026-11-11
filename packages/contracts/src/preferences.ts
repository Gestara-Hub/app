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
  onboarding: {
    dismissed: boolean;
    completedStepIds: string[];
  };
  dismissedAlertKeys: string[];
  /** Lembretes adiados ou ignorados (doc product/25): chave -> "yyyy-MM-dd" ou "never". */
  reminderSnoozes?: Record<string, string>;
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
  lastUnitId?: string;
  defaultCalendarView?: "day" | "week" | "month";
  themeStyling?: ThemeStylingPreferences;
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
  };
}
