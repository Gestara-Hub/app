"use client";

import { useEffect } from "react";
import { reportError, setErrorSink, type ErrorEntry } from "@/lib/log";
import { reportBrowserErrorAction } from "@/services/server/browserErrors";

/** O mesmo erro (impressao digital) so sai uma vez por minuto deste navegador. */
const REPEAT_MS = 60_000;

/**
 * Avisos do navegador que chegam como erro da pagina e nao sao defeito: o
 * ResizeObserver avisa quando adia uma medida (benigno), e "Script error." e o
 * erro sem detalhes de um script de outro dominio (extensao, terceiro).
 */
const BENIGN = [/ResizeObserver loop/i, /^Script error\.?$/i];

function isBenign(message: string): boolean {
  return BENIGN.some((pattern) => pattern.test(message));
}

/**
 * Liga o registro de erros do navegador (doc technical/21): `logError` e
 * `reportError` no navegador, erro sem tratamento e promessa rejeitada sem
 * `catch` vao para o servidor, que grava com o espaco e o usuario da sessao.
 * Montado no layout do app (so para quem esta logado).
 */
export function BrowserErrorReporter() {
  useEffect(() => {
    const lastSent = new Map<string, number>();
    setErrorSink(async (entry: ErrorEntry) => {
      const now = Date.now();
      if (now - (lastSent.get(entry.fingerprint) ?? 0) < REPEAT_MS) return;
      lastSent.set(entry.fingerprint, now);
      await reportBrowserErrorAction({
        event: entry.event,
        level: entry.level,
        message: entry.message,
        stack: entry.stack,
        context: { ...entry.context, path: window.location.pathname },
        reference: entry.reference,
      });
    });
    const onError = (event: ErrorEvent) => {
      if (isBenign(String(event.message ?? ""))) return;
      void reportError("unhandled", event.error ?? event.message, {
        context: { file: event.filename, line: event.lineno, column: event.colno },
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      void reportError("unhandled-promise", event.reason);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      setErrorSink(undefined);
    };
  }, []);
  return null;
}
