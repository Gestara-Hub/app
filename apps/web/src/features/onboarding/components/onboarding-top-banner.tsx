"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/auth";
import { useOnboardingSteps } from "../hooks/use-onboarding-steps";

export function OnboardingTopBanner() {
  const user = useCurrentUser();
  const { steps, doneCount, total, isReady, isComplete, nextStep } =
    useOnboardingSteps();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab") ?? null;

  // Exibe obrigatoriamente para o perfil de Proprietário enquanto houver passos pendentes (exceto na Dashboard)
  if (
    !isReady ||
    user.profile !== "owner" ||
    isComplete ||
    pathname === "/"
  ) {
    return null;
  }

  const nextStepIndex = nextStep
    ? steps.findIndex((s) => s.id === nextStep.id)
    : -1;
  const isOnNextStepPage = Boolean(
    nextStep &&
      (nextStep.id === "hours"
        ? pathname === "/settings" && tab === "horarios"
        : pathname === nextStep.href || pathname.startsWith(`${nextStep.href}/`)),
  );
  const pct = Math.round((doneCount / total) * 100);

  return (
    <aside
      aria-label="Progresso da configuração inicial"
      className="px-4 pt-3.5 pb-1 md:px-6 md:pt-4"
    >
      <div
        className={cn(
          "overflow-hidden rounded-xl border shadow-xs transition-colors",
          !nextStep
            ? "border-emerald-500/30 bg-emerald-500/[0.08] dark:bg-emerald-950/25"
            : "border-fuchsia-200/90 bg-gradient-to-r from-fuchsia-50/80 via-pink-50/40 to-card dark:border-fuchsia-900/50 dark:from-fuchsia-950/30 dark:via-pink-950/15",
        )}
      >
        <div className="flex items-center justify-between gap-4 p-3.5 sm:px-5 sm:py-3">
          {/* Lado esquerdo: Próximo passo objetivo alinhado ao padrão da dashboard */}
          <div className="min-w-0 flex-1">
            {nextStep ? (
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fuchsia-600 dark:text-fuchsia-400">
                  <Sparkles className="size-3.5" />
                  <span>
                    {isOnNextStepPage ? "Passo atual" : "Próximo passo"} · Passo {nextStepIndex + 1} de {total}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-base font-semibold text-foreground">
                  {nextStep.label}
                </p>
              </div>
            ) : (
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3.5 stroke-[3]" />
                  <span>Configuração concluída · 100%</span>
                </p>
                <p className="mt-0.5 truncate text-base font-semibold text-foreground">
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
                className="shrink-0 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-xs shadow-fuchsia-600/25 hover:from-fuchsia-700 hover:to-pink-700"
              >
                <Link href={nextStep.href}>
                  Continuar
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="shrink-0">
                <Link href="/">Concluir na Dashboard</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Linha de progresso destacada na borda inferior */}
        <div className="h-1 w-full bg-fuchsia-100/70 dark:bg-fuchsia-950/60">
          <div
            className={cn(
              "h-full transition-all duration-500 ease-out",
              isComplete ? "bg-emerald-600" : "bg-gradient-to-r from-fuchsia-600 to-pink-600",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
