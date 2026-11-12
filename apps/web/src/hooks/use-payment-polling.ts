"use client";

import { useEffect, useRef } from "react";

/**
 * Intervalo da proxima conferencia de pagamento pelo tempo ja esperado
 * (11/11/2026). Antes: a cada 3,5 s para sempre, ~1.000 chamadas por hora numa
 * aba esquecida, cada uma com consulta ao parceiro de pagamentos.
 * - ate 2 min: 3,5 s (o Pix costuma cair logo);
 * - ate 10 min: 10 s;
 * - ate 20 min: 30 s;
 * - depois: para (`null`). Voltar para a aba confere de novo.
 */
export function pollDelayMs(elapsedMs: number): number | null {
  if (elapsedMs < 2 * 60_000) return 3_500;
  if (elapsedMs < 10 * 60_000) return 10_000;
  if (elapsedMs < 20 * 60_000) return 30_000;
  return null;
}

/**
 * Confere um pagamento ate `check` devolver `true`. Aba escondida nao confere;
 * ao voltar para ela, confere na hora e recomeca a contagem.
 */
export function usePaymentPolling(check: () => Promise<boolean>, active: boolean): void {
  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  }, [check]);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: number | undefined;
    let startedAt = Date.now();

    const schedule = () => {
      window.clearTimeout(timer);
      const delay = pollDelayMs(Date.now() - startedAt);
      if (stopped || delay === null || document.hidden) return;
      timer = window.setTimeout(run, delay);
    };
    const run = async () => {
      if (stopped || document.hidden) return;
      let done = false;
      try {
        done = await checkRef.current();
      } catch {
        // A proxima conferencia tenta de novo.
      }
      if (done) stopped = true;
      else schedule();
    };
    const onVisibility = () => {
      if (document.hidden || stopped) return;
      startedAt = Date.now();
      void run();
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active]);
}
