"use client";

import { useCallback, useEffect } from "react";
import { useUserPreferences } from "@/features/preferences";
import { LATEST_RELEASE_VERSION } from "../release-notes";

/**
 * Ha novidade que a pessoa ainda nao viu? (doc technical/27). Quem entra pela
 * primeira vez comeca com a versao atual vista: o ponto aparece so a partir da
 * proxima versao, nunca com o historico inteiro.
 */
export function useUnseenRelease(): { hasUnseen: boolean; markSeen: () => void } {
  const { preferences, updatePreferences, remoteLoaded } = useUserPreferences();
  const lastSeen = preferences.lastSeenRelease;

  useEffect(() => {
    if (remoteLoaded && LATEST_RELEASE_VERSION && lastSeen === undefined) {
      updatePreferences({ lastSeenRelease: LATEST_RELEASE_VERSION });
    }
  }, [remoteLoaded, lastSeen, updatePreferences]);

  const markSeen = useCallback(() => {
    if (LATEST_RELEASE_VERSION && lastSeen !== LATEST_RELEASE_VERSION) {
      updatePreferences({ lastSeenRelease: LATEST_RELEASE_VERSION });
    }
  }, [lastSeen, updatePreferences]);

  return {
    hasUnseen: remoteLoaded && Boolean(LATEST_RELEASE_VERSION) && lastSeen !== undefined && lastSeen !== LATEST_RELEASE_VERSION,
    markSeen,
  };
}
