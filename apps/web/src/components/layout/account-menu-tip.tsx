"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { dateInSpace } from "@gestarahub/core/date";
import { ProductTour } from "@/components/shared/product-tour";
import { useUserPreferences } from "@/features/preferences";
import {
  accountMenuTipReason,
  interruptedThisSession,
  markInterruption,
  onAccountMenuTipRequest,
  type AccountMenuTipReason,
} from "@/lib/account-menu-tip";

/** O botao do avatar no topo (`data-account-menu` em AppTopbar). */
export const ACCOUNT_MENU_TARGET = "[data-account-menu]";

const COPY: Record<AccountMenuTipReason, { title: string; body: string }> = {
  security: {
    title: "Segurança fica aqui",
    body: "Quando quiser, ative a verificação em duas etapas neste menu.",
  },
  support: {
    title: "Resposta do suporte",
    body: "Abra este menu e veja em Ajuda e suporte.",
  },
  second_day: {
    title: "Sua conta fica aqui",
    body: "Tema, segurança, ajuda e sair, tudo neste menu.",
  },
};

// Espera a tela ficar livre e carregada: janela, painel, menu, tour, guia na
// tela ou o topo e o conteudo ainda carregando.
/** Tela ocupada: algo aberto que uma dica ou sugestao nao deve cobrir. */
export const SCREEN_BUSY_SELECTOR = [
  '[data-slot="dialog-content"]',
  '[data-slot="alert-dialog-content"]',
  '[data-slot="sheet-content"]',
  "[data-product-tour]",
  "[data-guide-ui]",
  "[data-install-prompt]",
  '[aria-label="Aviso de cookies"]',
  '[role="menu"]',
  'header [data-slot="skeleton"]',
  'main [data-slot="skeleton"]',
].join(", ");

/**
 * Dica de 1 passo no avatar, uma vez por pessoa (decisao de 31/10/2026; regras
 * em `@/lib/account-menu-tip`). O "visto" fica nas preferencias da conta, entao
 * nao repete em outro aparelho. Nunca na configuracao inicial nem na demonstracao.
 */
export function AccountMenuTip({ supportUnread, demo }: { supportUnread: number; demo: boolean }) {
  const pathname = usePathname();
  const { preferences, updatePreferences, remoteLoaded } = useUserPreferences();
  const [requested, setRequested] = useState<AccountMenuTipReason | null>(null);
  const [showing, setShowing] = useState<AccountMenuTipReason | null>(null);
  const today = dateInSpace();
  const state = preferences.accountMenuTip;
  const inSetup = pathname?.startsWith("/setup") ?? false;
  const onDashboard = pathname === "/" || pathname === "/dashboard";

  // Primeiro dia no app, so depois das preferencias do servidor (antes, "sem
  // data" seria so a copia local ainda vazia).
  useEffect(() => {
    if (remoteLoaded && !demo && !state?.firstSeenAt) {
      updatePreferences({ accountMenuTip: { ...state, firstSeenAt: today } });
    }
  }, [remoteLoaded, demo, state, today, updatePreferences]);

  useEffect(() => onAccountMenuTipRequest(setRequested), []);

  useEffect(() => {
    if (!remoteLoaded || demo || inSetup || showing) return;
    const reason = accountMenuTipReason({
      state,
      today,
      requested,
      supportUnread,
      onDashboard,
      interruptedThisSession: interruptedThisSession(),
    });
    if (!reason) return;

    const tryShow = () => {
      if (document.querySelector(SCREEN_BUSY_SELECTOR) || !document.querySelector(ACCOUNT_MENU_TARGET)) return;
      markInterruption();
      updatePreferences({ accountMenuTip: { ...state, shownAt: today } });
      setShowing(reason);
    };
    const timer = setTimeout(tryShow, 600);
    let pending: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(pending);
      pending = setTimeout(tryShow, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      clearTimeout(timer);
      clearTimeout(pending);
      observer.disconnect();
    };
  }, [remoteLoaded, demo, inSetup, showing, state, today, requested, supportUnread, onDashboard, updatePreferences]);

  if (!showing) return null;
  return (
    <ProductTour
      steps={[{ target: ACCOUNT_MENU_TARGET, ...COPY[showing] }]}
      onClose={() => {
        setShowing(null);
        setRequested(null);
      }}
      mobileMenuStep={false}
      finishLabel="Entendi"
    />
  );
}
