"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Share, SquarePlus, X } from "lucide-react";
import { dateInSpace } from "@gestarahub/core/date";
import appIcon from "@/assets/icon.svg";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth";
import { trackEvent } from "@/lib/analytics";
import { interruptedThisSession, markInterruption } from "@/lib/account-menu-tip";
import { isDemoOrganization } from "@/lib/demo";
import {
  dismissInstall,
  installPlatform,
  shouldOfferInstall,
  type InstallPlatform,
  type InstallPromptState,
} from "@/lib/install-prompt";
import { SCREEN_BUSY_SELECTOR } from "./account-menu-tip";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// A janela de instalacao do navegador avisa cedo, as vezes antes da tela
// montar: guarda o aviso ja ao carregar este arquivo.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Sem a faixa automatica do Chrome: quem oferece e o cartao abaixo.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    promptListeners.forEach((listener) => listener());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    trackEvent("app_installed");
    promptListeners.forEach((listener) => listener());
  });
}

// Recusa vale por aparelho: instalar e de cada celular ou computador.
const STORAGE_KEY = "gestarahub:install-prompt";

function readState(): InstallPromptState | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as InstallPromptState) : undefined;
  } catch {
    return undefined;
  }
}

function writeState(state: InstallPromptState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sem armazenamento: volta a sugerir no proximo acesso.
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function subscribePrompt(listener: () => void): () => void {
  promptListeners.add(listener);
  return () => {
    promptListeners.delete(listener);
  };
}

function currentPlatform(): InstallPlatform | null {
  return installPlatform({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone: isStandalone(),
    canPrompt: deferredPrompt !== null,
  });
}

const COPY: Record<InstallPlatform, { mobile: string; desktop: string }> = {
  prompt: { mobile: "Abra direto da tela de início, como um app.", desktop: "Abra numa janela própria, fora do navegador." },
  ios: { mobile: "Abra direto da tela de início, como um app.", desktop: "Abra direto da tela de início, como um app." },
  "mac-safari": { mobile: "Abra pelo Dock, numa janela própria.", desktop: "Abra pelo Dock, numa janela própria." },
};

/**
 * Cartao "Instale o GestaraHub" (04/11/2026; regras em `@/lib/install-prompt`).
 * So para quem usa pelo navegador, uma interrupcao por acesso e com a tela
 * livre (sem janela, tour ou guia abertos). Nunca na configuracao inicial nem
 * na demonstracao.
 */
export function InstallAppPrompt() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const demo = isDemoOrganization(user.organizationId);
  const inSetup = pathname?.startsWith("/setup") ?? false;
  // A plataforma muda quando o navegador libera (ou some) a janela de instalacao.
  const platform = useSyncExternalStore(subscribePrompt, currentPlatform, () => null);
  const [showing, setShowing] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);

  useEffect(() => {
    if (!platform || showing || demo || inSetup) return;
    if (interruptedThisSession() || !shouldOfferInstall(readState(), dateInSpace())) return;

    const tryShow = () => {
      if (document.querySelector(SCREEN_BUSY_SELECTOR)) return false;
      markInterruption();
      trackEvent("install_prompt_shown", { platform });
      setShowing(true);
      return true;
    };
    // Espera a pessoa chegar e a tela assentar antes de oferecer.
    let pending: ReturnType<typeof setTimeout> | undefined;
    let observer: MutationObserver | undefined;
    const timer = setTimeout(() => {
      if (tryShow()) return;
      observer = new MutationObserver(() => {
        clearTimeout(pending);
        pending = setTimeout(() => {
          if (tryShow()) observer?.disconnect();
        }, 400);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }, 6000);
    return () => {
      clearTimeout(timer);
      clearTimeout(pending);
      observer?.disconnect();
    };
  }, [platform, showing, demo, inSetup]);

  if (!showing || !platform) return null;
  // So monta depois do efeito (no navegador): pode ler a tela aqui.
  const isMobile = window.matchMedia("(pointer: coarse)").matches;

  const dismiss = () => {
    writeState(dismissInstall(readState(), dateInSpace()));
    trackEvent("install_prompt_dismissed", { platform });
    setShowing(false);
  };

  const install = async () => {
    if (platform !== "prompt" || !deferredPrompt) {
      setStepsOpen(true);
      return;
    }
    const event = deferredPrompt;
    deferredPrompt = null;
    await event.prompt();
    const { outcome } = await event.userChoice;
    trackEvent("install_prompt_answered", { platform, outcome });
    if (outcome === "dismissed") writeState(dismissInstall(readState(), dateInSpace()));
    setShowing(false);
  };

  return (
    <div
      role="region"
      aria-label="Instalar o app"
      data-install-prompt=""
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:px-0 sm:pb-0 print:hidden"
    >
      <div className="relative mx-auto w-full max-w-sm rounded-2xl border bg-card p-4 shadow-2xl ring-1 ring-black/5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 dark:ring-white/10">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2 text-muted-foreground"
          onClick={dismiss}
          aria-label="Fechar"
        >
          <X className="size-4" />
        </Button>
        <div className="flex items-start gap-3 pr-8">
          <Image src={appIcon} alt="" className="size-11 shrink-0 rounded-[10px]" />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Instale o GestaraHub</p>
            <p className="text-sm text-muted-foreground">{isMobile ? COPY[platform].mobile : COPY[platform].desktop}</p>
          </div>
        </div>

        {stepsOpen ? (
          <ol className="mt-4 space-y-2.5 rounded-xl bg-muted/50 p-3 text-sm text-foreground">
            {platform === "mac-safari" ? (
              <li className="flex items-center gap-2.5">
                <SquarePlus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>
                  No menu <strong className="font-semibold">Arquivo</strong>, escolha{" "}
                  <strong className="font-semibold">Adicionar ao Dock</strong>.
                </span>
              </li>
            ) : (
              <>
                <li className="flex items-center gap-2.5">
                  <Share className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>
                    Toque em <strong className="font-semibold">Compartilhar</strong> no navegador.
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <SquarePlus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>
                    Escolha <strong className="font-semibold">Adicionar à Tela de Início</strong>.
                  </span>
                </li>
              </>
            )}
          </ol>
        ) : null}

        <div className="mt-4 flex gap-2">
          {stepsOpen ? (
            <Button
              type="button"
              className="flex-1"
              onClick={() => {
                // Ja sabe o caminho: volta a lembrar so depois do intervalo.
                writeState(dismissInstall(readState(), dateInSpace()));
                setShowing(false);
              }}
            >
              Entendi
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="flex-1" onClick={dismiss}>
                Agora não
              </Button>
              <Button type="button" className="flex-1" onClick={() => void install()}>
                {platform === "prompt" ? "Instalar" : "Como instalar"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
