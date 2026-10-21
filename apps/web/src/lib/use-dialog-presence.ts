"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dialog, Sheet e AlertDialog saem com animacao (200 a 500 ms). Mudar o
 * conteudo ou resetar estado no `onOpenChange(false)` faz a tela piscar
 * durante essa saida: o texto some, o formulario volta ao inicio, a lista
 * perde o filtro. Estes hooks adiam isso para depois da animacao.
 *
 * Complementam `useRetainedValue` (lib/use-retained-value.ts), que segura a
 * entidade de `open={x !== null}` enquanto o dialog fecha.
 */

/** Duracao maxima das animacoes de saida em components/ui (sheet: 500 ms). */
export const DIALOG_EXIT_MS = 520;

/**
 * `true` enquanto o dialog esta aberto e ainda por alguns instantes depois de
 * fechar. Use no lugar de `open` para decidir se o conteudo fica montado:
 * `{present ? <Form /> : null}` em vez de `{open ? <Form /> : null}`.
 */
export function useDialogPresence(open: boolean, delayMs = DIALOG_EXIT_MS): boolean {
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => setPresent(false), delayMs);
    return () => window.clearTimeout(timer);
  }, [open, delayMs]);
  return open || present;
}

/**
 * Roda `onClosed` depois que o dialog terminou de fechar (e nao no clique de
 * fechar). Para resets de estado interno: busca, escolha, motivo, aba.
 * Se reabrir antes do prazo, o reset roda na hora, para a nova abertura
 * comecar limpa.
 */
export function useAfterDialogClose(open: boolean, onClosed: () => void, delayMs = DIALOG_EXIT_MS): void {
  const callbackRef = useRef(onClosed);
  useEffect(() => {
    callbackRef.current = onClosed;
  });
  const wasOpenRef = useRef(open);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (open || !wasOpen) return;
    const timer = window.setTimeout(() => callbackRef.current(), delayMs);
    return () => {
      window.clearTimeout(timer);
      // Reabriu antes do prazo: limpa ja.
      callbackRef.current();
    };
  }, [open, delayMs]);
}
