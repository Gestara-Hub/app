"use client";

import { useEffect } from "react";

/** Texto de status do rodape das abas de configuracoes (Geral / Horarios). */
export function UnsavedChangesStatus({ dirty }: { dirty: boolean }) {
  return (
    <p className="text-xs text-muted-foreground" aria-live="polite">
      {dirty ? (
        <span className="text-amber-600 dark:text-amber-400 font-medium">
          ● Alterações não salvas
        </span>
      ) : (
        <span className="text-muted-foreground">Todas as alterações estão salvas</span>
      )}
    </p>
  );
}

/** Avisa o pai quando o estado "sujo" do formulario muda. */
export function useReportDirty(dirty: boolean, onDirtyChange?: (dirty: boolean) => void) {
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  // Ao desmontar, o formulario deixa de contar como sujo
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
}

/** Pede confirmacao do navegador ao recarregar/fechar a aba com alteracoes nao salvas. */
export function useBeforeUnloadGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Navegadores antigos exigem returnValue preenchido
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
