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

const ASIDE_CLASS = "px-4 pt-3 pb-1 md:px-6 md:pt-4";
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

  // Exibe obrigatoriamente para o perfil de Proprietário enquanto houver passos pendentes (exceto na Dashboard)
  if (user.profile !== "owner" || pathname === "/") return null;

  // Enquanto os passos carregam, reserva a altura do banner para o conteudo
  // nao ser empurrado quando ele aparece (layout shift).
  if (!isReady) {
    return (
      <div aria-hidden className={ASIDE_CLASS}>
        <Skeleton className="h-16 rounded-xl bg-muted sm:h-[72px]" />
      </div>
    );
  }

  if (isComplete) return null;

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
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 sm:gap-4 sm:px-5 sm:py-3">
          {/* Lado esquerdo: Próximo passo objetivo alinhado ao padrão da dashboard */}
          <div className="min-w-0 flex-1">
            {nextStep ? (
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11px] leading-4 font-semibold uppercase tracking-wide text-primary sm:text-xs">
                  <Sparkles className="size-3.5" />
                  <span>
                    {isOnNextStepPage ? "Passo atual" : "Próximo passo"} · Passo {nextStepIndex + 1} de {total}
                  </span>
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-foreground sm:line-clamp-1 sm:text-base">
                  {nextStep.label}
                </p>
              </div>
            ) : (
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11px] leading-4 font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 sm:text-xs">
                  <Check className="size-3.5 stroke-[3]" />
                  <span>Configuração concluída · 100%</span>
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-foreground sm:line-clamp-1 sm:text-base">
                  Todas as etapas foram concluídas!
                </p>
              </div>
            )}
          </div>

          {/* Lado direito: Continuar */}
          <div className="flex shrink-0 items-center gap-2">
            {nextStep ? (
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
