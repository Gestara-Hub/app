"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/auth";
import { useOnboardingSteps, type OnboardingStep } from "../hooks/use-onboarding-steps";

/**
 * Pagina do passo = o caminho exato do seu destino. Subpaginas (ex.:
 * /classes/calendar para o passo /classes) nao contam: nelas o "Continuar" pulsa.
 */
function isStepPage(step: OnboardingStep, pathname: string): boolean {
  return pathname === step.href.split(/[?#]/)[0];
}

function isOnboardingAlreadyComplete(organizationId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const cached = window.localStorage.getItem(
      `gestarahub_onboarding_complete:${organizationId}`,
    );
    if (cached === "1") return true;
    if (cached === "0") return false;

    const rawState = window.localStorage.getItem(
      `gestarahub:onboarding:${organizationId}`,
    );
    if (rawState) {
      const parsed = JSON.parse(rawState) as { setupCompletedShown?: boolean };
      if (parsed.setupCompletedShown) return true;
    }

    const rawDb = window.localStorage.getItem("gestarahub:db");
    if (rawDb) {
      const db = JSON.parse(rawDb) as {
        data?: {
          tenants?: Record<
            string,
            {
              classGroups?: unknown[];
              clients?: unknown[];
              professionals?: unknown[];
              plans?: unknown[];
              categories?: unknown[];
              appointments?: unknown[];
            }
          >;
        };
      };
      const tenant = db.data?.tenants?.[organizationId];
      if (tenant) {
        const hasClassesDone =
          (tenant.classGroups?.length ?? 0) > 0 &&
          (tenant.clients?.length ?? 0) > 0 &&
          (tenant.professionals?.length ?? 0) > 0 &&
          (tenant.plans?.length ?? 0) > 0 &&
          (tenant.categories?.length ?? 0) > 0;
        const hasSchedulingDone = (tenant.appointments?.length ?? 0) > 0;
        if (hasClassesDone || hasSchedulingDone) return true;
      }
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

const ASIDE_CLASS = "mx-auto w-full max-w-7xl px-4 pt-3 pb-1 md:px-6 md:pt-4";
// CTA menor no celular; tamanho padrao a partir de sm
const CTA_CLASS = "shrink-0 sm:h-9 sm:px-4 sm:has-[>svg]:px-3";

export function OnboardingTopBanner() {
  const user = useCurrentUser();
  const { steps, doneCount, total, isReady, isComplete, nextStep } =
    useOnboardingSteps();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab") ?? null;
  const ctaRef = useRef<HTMLAnchorElement>(null);

  // Quando um passo acaba de ser concluido (doneCount sobe), leva o usuario ao
  // topo com o foco no "Continuar". O primeiro valor pronto so vira referencia,
  // para nao rolar ao abrir a pagina.
  const [seenDoneCount, setSeenDoneCount] = useState<number | null>(null);
  const [nudgeCount, setNudgeCount] = useState(0);
  if (isReady && seenDoneCount !== doneCount) {
    if (seenDoneCount !== null && doneCount > seenDoneCount) setNudgeCount((n) => n + 1);
    setSeenDoneCount(doneCount);
  }

  useEffect(() => {
    if (nudgeCount === 0) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    ctaRef.current?.focus({ preventScroll: true });
  }, [nudgeCount]);

  const nextStepIndex = nextStep
    ? steps.findIndex((s) => s.id === nextStep.id)
    : -1;
  const isOnNextStepPage = Boolean(
    nextStep &&
      (nextStep.id === "hours"
        ? pathname === "/settings" && tab === "horarios"
        : nextStep.id === "billing"
          ? pathname === "/settings" && (tab === "geral" || !tab)
          : isStepPage(nextStep, pathname)),
  );
  const activeStepOnPage =
    user.profile === "owner" &&
    pathname !== "/" &&
    isReady &&
    !isComplete &&
    isOnNextStepPage &&
    nextStep
      ? nextStep.id
      : null;

  useEffect(() => {
    const root = document.documentElement;
    if (activeStepOnPage) {
      root.dataset.onboardingStep = activeStepOnPage;
    } else {
      delete root.dataset.onboardingStep;
    }
    return () => {
      delete root.dataset.onboardingStep;
    };
  }, [activeStepOnPage]);

  useEffect(() => {
    if (!isReady || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `gestarahub_onboarding_complete:${user.organizationId}`,
        isComplete ? "1" : "0",
      );
    } catch {
      // ignore storage errors
    }
  }, [isReady, isComplete, user.organizationId]);

  // Exibe obrigatoriamente para o perfil de Proprietário enquanto houver passos pendentes (exceto na Dashboard)
  if (user.profile !== "owner" || pathname === "/") return null;

  if (isComplete) return null;

  // Enquanto os passos carregam, se o setup basico ja foi concluido nesta
  // organizacao (ou durante o SSR antes de hidratar), nao exibe o skeleton do
  // banner para evitar piscar/empurrar a tela em contas ja configuradas.
  if (!isReady) {
    if (isOnboardingAlreadyComplete(user.organizationId)) {
      return null;
    }
    return (
      <div aria-hidden className={ASIDE_CLASS}>
        <Skeleton className="h-16 rounded-xl bg-muted sm:h-[72px]" />
      </div>
    );
  }

  // Fora da tela do passo, o "Continuar" pulsa chamando para la; nela, fica quieto.
  const pulse = Boolean(nextStep) && !isOnNextStepPage;
  const pct = Math.round((doneCount / total) * 100);

  return (
    <aside
      aria-label="Progresso da configuração inicial"
      className={ASIDE_CLASS}
    >
      <div
        className={cn(
          "rounded-xl border shadow-xs transition-colors",
          !nextStep
            ? "border-emerald-500/30 bg-emerald-500/[0.08] dark:bg-emerald-950/25"
            : "border-primary/20 bg-primary/[0.04] dark:bg-primary/[0.07]",
        )}
      >
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 sm:gap-4 sm:px-5 sm:py-3">
          {/* Lado esquerdo: Rótulo suave em cinza + Título único em destaque */}
          <div className="min-w-0 flex-1">
            {nextStep ? (
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Sparkles className="size-3.5 text-primary/70" />
                  <span>
                    Configuração inicial · {nextStepIndex + 1} de {total}
                  </span>
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-foreground sm:line-clamp-1">
                  {nextStep.label}
                </p>
              </div>
            ) : (
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3.5 stroke-[2.5]" />
                  <span>Configuração concluída · 100%</span>
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-foreground sm:line-clamp-1">
                  Todas as etapas foram concluídas!
                </p>
              </div>
            )}
          </div>

          {/* Lado direito: Continuar (apenas quando fora da tela do passo) */}
          <div className="flex shrink-0 items-center gap-2">
            {nextStep ? (
              isOnNextStepPage ? (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {nextStep.description}
                </span>
              ) : (
                <Button
                  asChild
                  size="sm"
                  className={cn(
                    CTA_CLASS,
                    pulse && "motion-safe:animate-attention-loop",
                  )}
                >
                  <Link ref={ctaRef} href={nextStep.href}>
                    Continuar
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )
            ) : (
              <Button asChild size="sm" variant="outline" className={CTA_CLASS}>
                <Link href="/">Concluir na Dashboard</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Linha de progresso destacada na borda inferior */}
        <div className="h-1 w-full overflow-hidden rounded-b-xl bg-primary/10">
          <div
            className={cn(
              "h-full transition-all duration-500 ease-out",
              isComplete ? "bg-emerald-600" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
