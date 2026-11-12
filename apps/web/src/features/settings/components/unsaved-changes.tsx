"use client";

import { useEffect } from "react";

/** Avisa o pai quando o estado "sujo" do formulario muda. */
export function useReportDirty(dirty: boolean, onDirtyChange?: (dirty: boolean) => void) {
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  // Ao desmontar, o formulario deixa de contar como sujo
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
}

// Guardas de saida moraram aqui; agora sao comuns (chamada da aula tambem usa).
export { useBeforeUnloadGuard, useLeaveLinkGuard } from "@/lib/unsaved-changes";
