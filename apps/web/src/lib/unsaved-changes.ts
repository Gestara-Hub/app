"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

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

/**
 * Sair da tela por um link (menu lateral, topo, "‹ Voltar") com alteracoes nao
 * salvas pede confirmacao antes; confirmando, segue para o link. Abrir em outra
 * aba passa.
 */
export function useLeaveLinkGuard(active: boolean, ask: () => Promise<boolean>) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      void ask().then((ok) => {
        if (ok) router.push(`${url.pathname}${url.search}${url.hash}`);
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active, ask, router]);
}

/**
 * Botao voltar do navegador e gesto de voltar do iPhone com alteracoes nao
 * salvas (12/11/2026): ao ficar com algo a salvar, a tela ganha uma entrada
 * repetida no historico, que segura o primeiro "voltar" e pergunta antes.
 * Confirmando, volta de verdade. Depois de salvar a entrada fica; o proximo
 * "voltar" pula ela sozinho (tirar na hora atrapalhava toque e recarregar logo
 * depois de salvar).
 */
export function useHistoryBackGuard(active: boolean, ask: () => Promise<boolean>) {
  const askRef = useRef(ask);
  const activeRef = useRef(active);
  // Ha uma entrada repetida desta tela no topo do historico.
  const extraEntry = useRef(false);
  useEffect(() => {
    askRef.current = ask;
    activeRef.current = active;
  }, [ask, active]);
  useEffect(() => {
    if (!active || extraEntry.current) return;
    // Mesmo estado do Next (__NA): voltar para a entrada de baixo e a mesma tela.
    window.history.pushState(window.history.state, "", window.location.href);
    extraEntry.current = true;
  }, [active]);
  useEffect(() => {
    let leaving = false;
    const onPopState = () => {
      if (leaving || !extraEntry.current) return;
      // Saiu da entrada repetida: esta na entrada original desta tela.
      extraEntry.current = false;
      if (!activeRef.current) {
        leaving = true;
        window.history.back();
        return;
      }
      void askRef.current().then((ok) => {
        if (ok) {
          leaving = true;
          window.history.back();
          return;
        }
        window.history.pushState(window.history.state, "", window.location.href);
        extraEntry.current = true;
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}
