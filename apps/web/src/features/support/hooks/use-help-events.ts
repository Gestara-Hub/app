"use client";

import { useCallback } from "react";
import { logHelpEventAction, type HelpEvent } from "@/services/support/helpActions";

/** Registra o uso da ajuda. Dispara e esquece: falhar nunca atrapalha quem está lendo. */
export function useLogHelpEvent(): (event: HelpEvent) => void {
  return useCallback((event: HelpEvent) => {
    void logHelpEventAction(event).catch(() => undefined);
  }, []);
}
