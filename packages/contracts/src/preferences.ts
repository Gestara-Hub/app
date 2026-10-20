export type ThemeMode = "light" | "dark" | "system";
export type DensityMode = "comfortable" | "compact";
export type ListViewMode = "list" | "grid";

export interface UserPreferences {
  theme: ThemeMode;
  accentColor?: string;
  sidebarCollapsed: boolean;
  density: DensityMode;
  viewModes: Record<string, ListViewMode>;
  pageSizes?: Record<string, number>;
  defaultPageSize: number;
  audioFeedbackEnabled: boolean;
  onboarding: {
    dismissed: boolean;
    completedStepIds: string[];
  };
  dismissedAlertKeys: string[];
  lastUnitId?: string;
  defaultCalendarView?: "day" | "week" | "month";
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
  onboarding: {
    dismissed: false,
    completedStepIds: [],
  },
  dismissedAlertKeys: [],
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
