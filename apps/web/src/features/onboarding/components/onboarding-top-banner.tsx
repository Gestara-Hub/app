"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAppRouter } from "@/lib/use-app-router";
import { ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "@/lib/toast";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Button } from "@/components/ui/button";
import { SectionSpotlight } from "@/components/shared/section-spotlight";
import { Skeleton } from "@/components/ui/skeleton";
import { useAttentionUntilInteraction } from "@/lib/use-attention-until-interaction";
import { cn } from "@/lib/utils";
import { setModalitiesReviewOnBanner } from "@/lib/modalities-review-signal";
import { useCurrentUser } from "@/features/auth";
import { useMarkModalitiesReviewed } from "@/features/settings";
import { useOnboardingSteps } from "../hooks/use-onboarding-steps";
import type { OnboardingStep } from "../onboarding-steps";

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
        return hasClassesDone || hasSchedulingDone;
      }
    }
  } catch {
    // ignore storage errors
  }
  // Sem historico no navegador: assume concluido ate confirmar, evitando empurrar
  // a tela com o skeleton em contas prontas e depois colapsar.
  return true;
}

const ASIDE_CLASS = "mx-auto w-full max-w-7xl px-4 pt-3 pb-1 md:px-6 md:pt-4 print:hidden";
// CTA menor no celular; tamanho padrao a partir de sm
const CTA_CLASS = "shrink-0 sm:h-9 sm:px-4 sm:has-[>svg]:px-3";
const emptySubscribe = () => () => {};

export function OnboardingTopBanner() {
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
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


  const isDashboard = pathname === "/" || pathname === "/dashboard";

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

  // Primeira etapa concluida (so ela): destaca este aviso (resto da tela
  // escuro) mostrando onde continuar. Dali em diante o pulso do "Continuar"
  // basta. Enquanto o destaque esta aberto o "Continuar" nao pulsa; fecha num
  // clique fora, com Esc, ao trocar de tela ou ao continuar.
  const bannerRef = useRef<HTMLDivElement>(null);
  const bannerRefs = useMemo(() => [bannerRef], []);
  const [spotlightNudge, setSpotlightNudge] = useState(0);
  // Vale para a tela e o proximo passo do momento da conclusao: trocar de tela
  // ou de passo encerra (Horarios e Regras ficam na mesma pagina, em abas).
  const [spotlightFor, setSpotlightFor] = useState<{ path: string; stepId: string } | null>(null);
  if (nudgeCount > 0 && spotlightNudge !== nudgeCount) {
    setSpotlightNudge(nudgeCount);
    if (doneCount === 1 && nextStep) setSpotlightFor({ path: pathname, stepId: nextStep.id });
  }
  const spotlightOn =
    spotlightFor !== null &&
    spotlightFor.path === pathname &&
    spotlightFor.stepId === nextStep?.id &&
    !isOnNextStepPage;
  if (spotlightFor !== null && (spotlightFor.path !== pathname || spotlightFor.stepId !== nextStep?.id || isOnNextStepPage)) {
    setSpotlightFor(null);
  }
  const closeSpotlight = () => setSpotlightFor(null);
  const activeStepOnPage =
    (user.profile === "owner" || user.profile === "manager") &&
    !isDashboard &&
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

  // CTA principal da tela do passo (`data-onboarding-cta`): pulsa sem parar ate
  // ser clicado (globals.css). Modalidades fica de fora: pulsa so 2 ciclos.
  const stepCtaAttention = useAttentionUntilInteraction(
    Boolean(activeStepOnPage) && activeStepOnPage !== "modalities",
    activeStepOnPage,
  );
  const stepCtaId = stepCtaAttention.attention ? activeStepOnPage : null;
  useEffect(() => {
    if (!stepCtaId) return;
    const root = document.documentElement;
    root.dataset.onboardingCtaAttention = stepCtaId;
    const selector = `[data-onboarding-cta~="${stepCtaId}"]`;
    // O clique para o pulso SO do botao clicado (ex.: "Novo plano" nao para o
    // "Novo pacote" da outra aba, que ainda nao foi clicado). pointerdown cobre
    // menus que abrem no toque (ex.: "Novo" da agenda); click cobre o teclado.
    const handleInteraction = (event: Event) => {
      const cta = event.target instanceof Element ? event.target.closest(selector) : null;
      cta?.setAttribute("data-onboarding-cta-done", "");
    };
    document.addEventListener("pointerdown", handleInteraction, true);
    document.addEventListener("click", handleInteraction, true);
    return () => {
      delete root.dataset.onboardingCtaAttention;
      document.removeEventListener("pointerdown", handleInteraction, true);
      document.removeEventListener("click", handleInteraction, true);
    };
  }, [stepCtaId]);

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

  // Fora da tela do passo, o "Continuar" pulsa sem parar chamando para la (ate
  // ser clicado); nela, fica quieto.
  const continueAttention = useAttentionUntilInteraction(
    isReady && Boolean(nextStep) && !isOnNextStepPage && !spotlightOn,
    nextStep?.id ?? null,
  );

  // Na tela de Modalidades com a revisao pendente, a acao do passo fica aqui
  // (antes ficava so no aviso amarelo da tela e o usuario nao achava o
  // "Continuar"): "Esta tudo certo" pulsa ate o clique.
  const reviewOnPage =
    isOnNextStepPage && nextStep?.id === "modalities" && Boolean(nextStep.needsReview);
  const markReviewed = useMarkModalitiesReviewed();
  const reviewAttention = useAttentionUntilInteraction(reviewOnPage, "modalities-review");
  // Com o botao aqui, o aviso amarelo da tela nao repete o dele.
  const reviewButtonShown =
    isHydrated &&
    (user.profile === "owner" || user.profile === "manager") &&
    reviewOnPage;
  useEffect(() => {
    setModalitiesReviewOnBanner(reviewButtonShown);
    return () => setModalitiesReviewOnBanner(false);
  }, [reviewButtonShown]);
  // Confirmar a revisao conclui o passo e segue para o proximo, como o
  // "Continuar" (o passo seguinte so e conhecido depois que os passos recarregam).
  const router = useAppRouter();
  const advanceFromRef = useRef<string | null>(null);
  // Reavalia ao confirmar, caso os passos ja tenham recarregado antes.
  const [advanceTick, setAdvanceTick] = useState(0);
  useEffect(() => {
    const from = advanceFromRef.current;
    if (!from || !nextStep || nextStep.id === from) return;
    advanceFromRef.current = null;
    router.push(nextStep.href);
  }, [nextStep, router, advanceTick]);
  async function confirmReview() {
    reviewAttention.stop();
    try {
      await markReviewed.mutateAsync();
      toast.success("Modalidades revisadas.");
      advanceFromRef.current = "modalities";
      setAdvanceTick((n) => n + 1);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível concluir a revisão."));
    }
  }

  if (!isHydrated) return null;

  // Exibe para Proprietário e Gerente enquanto houver passos pendentes (exceto no Painel)
  if ((user.profile !== "owner" && user.profile !== "manager") || isDashboard) return null;

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

  const pct = Math.round((doneCount / total) * 100);

  return (
    <aside
      aria-label="Progresso da configuração inicial"
      className={ASIDE_CLASS}
    >
      <SectionSpotlight
        active={spotlightOn && Boolean(nextStep) && !isOnNextStepPage}
        targetRefs={bannerRefs}
        onDismiss={closeSpotlight}
        hint="Etapa concluída! Siga para a próxima."
      />
      <div
        ref={bannerRef}
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
                <p className="mt-0.5 text-sm font-semibold text-foreground">
                  {nextStep.label}
                </p>
              </div>
            ) : (
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <Check className="size-3.5 stroke-[2.5]" />
                  <span>Configuração concluída · 100%</span>
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">
                  Todas as etapas foram concluídas!
                </p>
              </div>
            )}
          </div>

          {/* Lado direito: Continuar (apenas quando fora da tela do passo) */}
          <div className="flex shrink-0 items-center gap-2">
            {nextStep ? (
              reviewOnPage ? (
                <>
                  <span className="hidden text-xs text-muted-foreground md:inline">
                    Confira as modalidades e confirme.
                  </span>
                  <Button
                    type="button"
                    className={cn(
                      CTA_CLASS,
                      reviewAttention.attention && "motion-safe:animate-attention-loop-infinite",
                    )}
                    disabled={markReviewed.isPending}
                    onClick={confirmReview}
                  >
                    {markReviewed.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    Está tudo certo
                  </Button>
                </>
              ) : isOnNextStepPage ? (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {nextStep.description}
                </span>
              ) : (
                <Button
                  key={nextStep.id}
                  asChild
                  className={cn(
                    CTA_CLASS,
                    continueAttention.attention &&
                      "motion-safe:animate-attention-loop-infinite",
                  )}
                >
                  <Link
                    ref={ctaRef}
                    href={nextStep.href}
                    onClick={() => {
                      continueAttention.stop();
                      closeSpotlight();
                    }}
                  >
                    Continuar
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )
            ) : (
              <Button asChild variant="outline" className={CTA_CLASS}>
                <Link href="/dashboard">Concluir no painel</Link>
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
