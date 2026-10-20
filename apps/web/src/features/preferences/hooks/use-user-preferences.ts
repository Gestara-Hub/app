"use client";

import { useCallback } from "react";
import type { ListViewMode } from "@gestarahub/contracts";
import { useUserPreferences } from "../context/user-preferences-provider";
import { playAudioFeedback } from "@/lib/audio-feedback";

export { useUserPreferences };

/**
 * Hook para obter e atualizar o modo de visualização (lista ou cartões) de uma tela específica
 * sincronizado automaticamente com as preferências do usuário.
 */
export function useScreenViewMode(
  screenKey: string,
  defaultMode: ListViewMode = "list",
): [ListViewMode, (mode: ListViewMode) => void] {
  const { preferences, updatePreferences } = useUserPreferences();
  const currentMode = preferences.viewModes[screenKey] ?? defaultMode;

  const setMode = useCallback(
    (newMode: ListViewMode) => {
      updatePreferences({
        viewModes: {
          ...preferences.viewModes,
          [screenKey]: newMode,
        },
      });
    },
    [preferences.viewModes, screenKey, updatePreferences],
  );

  return [currentMode, setMode];
}

/**
 * Hook para disparo de feedback sonoro respeitando a preferência do usuário
 */
export function useAudioFeedback() {
  const { preferences } = useUserPreferences();

  const playChime = useCallback(
    (type: "success" | "checkin" | "error" = "checkin") => {
      if (preferences.audioFeedbackEnabled) {
        playAudioFeedback(type);
      }
    },
    [preferences.audioFeedbackEnabled],
  );

  return {
    audioEnabled: preferences.audioFeedbackEnabled,
    playChime,
  };
}
