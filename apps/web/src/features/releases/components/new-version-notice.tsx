"use client";

import { useEffect } from "react";
import { toast } from "@/lib/toast";
import { APP_COMMIT, APP_VERSION } from "@/config/release";

const TOAST_ID = "new-version";
/** Volta ao app depois de pelo menos 1 minuto fora: confere. */
const MIN_GAP_MS = 60_000;
/** Com o app aberto e visivel: confere a cada 30 minutos. */
const INTERVAL_MS = 30 * 60_000;

const loaded = `${APP_VERSION}|${APP_COMMIT}`;

/**
 * Aviso de versao nova (25/11/2026; doc technical/10). O app instalado fica
 * dias suspenso no celular e volta com o codigo velho: ao voltar para ele (ou a
 * cada 30 min com a tela aberta), confere a versao publicada e, se mudou, mostra
 * "Nova versão do GestaraHub" com "Atualizar". Nunca recarrega sozinho: a
 * pessoa pode estar no meio de um formulario.
 */
export function NewVersionNotice() {
  useEffect(() => {
    // Desenvolvimento e testes: sem versao de build, nada a comparar.
    if (APP_VERSION === "dev") return;
    let lastCheck = Date.now();
    let shown = false;

    async function check() {
      if (shown || document.visibilityState !== "visible") return;
      lastCheck = Date.now();
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string; commit?: string };
        if (!data.version || `${data.version}|${data.commit ?? ""}` === loaded) return;
        shown = true;
        toast("Nova versão do GestaraHub", {
          id: TOAST_ID,
          description: "Atualize para usar as novidades.",
          duration: Number.POSITIVE_INFINITY,
          action: { label: "Atualizar", onClick: () => window.location.reload() },
        });
      } catch {
        // Sem internet: confere na proxima volta.
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastCheck >= MIN_GAP_MS) void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => void check(), INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, []);
  return null;
}
