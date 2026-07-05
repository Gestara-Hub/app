"use client";

import Link from "next/link";
import { ArrowRight, Check, Compass, Lock, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OnboardingStep } from "../hooks/use-onboarding-steps";

// Rotulo curto por passo, para o texto "Requer: ...".
const STEP_SHORT: Record<string, string> = {
  hours: "horário",
  categories: "categorias",
  services: "serviços",
  roles: "cargos",
  team: "equipe",
  clients: "clientes",
  appointment: "agendamento",
};

// Fases do setup: agrupam os passos e dao hierarquia (evita a "parede" de cards).
const GROUPS = [
  {
    id: "config",
    label: "Configuração",
    description: "Horário de funcionamento e serviços.",
    stepIds: ["hours", "services"],
  },
  {
    id: "team",
    label: "Equipe",
    description: "Profissionais e disponibilidade.",
    stepIds: ["team"],
  },
  {
    id: "ops",
    label: "Operação",
    description: "Clientes e primeiro agendamento.",
    stepIds: ["clients", "appointment"],
  },
] as const;

/**
 * "Primeiros passos" no estilo setup guiado: um "próximo passo" em destaque no
 * topo, progresso geral, e os passos agrupados por fase em cartões numerados
 * (concluido / disponivel / bloqueado). Progresso derivado do dado.
 */
export function OnboardingChecklist({
  steps,
  doneCount,
  total,
  onDismiss,
  onStartTour,
}: {
  steps: OnboardingStep[];
  doneCount: number;
  total: number;
  onDismiss: () => void;
  onStartTour: () => void;
}) {
  const pct = Math.round((doneCount / total) * 100);
  const doneById = Object.fromEntries(steps.map((s) => [s.id, s.done]));
  const stepById = Object.fromEntries(steps.map((s) => [s.id, s]));
  const numberById = Object.fromEntries(steps.map((s, i) => [s.id, i + 1]));

  const missingOf = (step: OnboardingStep) =>
    (step.requires ?? [])
      .filter((id) => !doneById[id])
      .map((id) => STEP_SHORT[id] ?? id);

  // Proximo passo = primeiro disponivel (nao concluido e sem pre-requisito pendente).
  const nextStep = steps.find((s) => !s.done && missingOf(s).length === 0);

  return (
    <div
      data-tour="onboarding-checklist"
      className="mb-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="mb-3 flex items-center justify-end gap-0.5">
        <Button variant="ghost" size="sm" onClick={onStartTour}>
          <Compass className="size-4" />
          Tour
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ocultar primeiros passos"
          onClick={onDismiss}
        >
          <X className="size-4" />
        </Button>
      </div>

      {nextStep ? (
        <div className="mb-5 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="size-3.5" />
              Próximo passo
            </p>
            <p className="mt-1 truncate text-lg font-semibold">
              {nextStep.label}
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href={nextStep.href}>
              Continuar
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Primeiros passos
        </p>
        <p className="text-xs font-medium text-muted-foreground tabular-nums">
          {doneCount}/{total} concluídos
        </p>
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-5">
        {GROUPS.map((group) => (
          <section key={group.id}>
            <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {group.description}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.stepIds.map((id) => {
                const step = stepById[id];
                if (!step) return null;
                const missing = missingOf(step);
                const locked = missing.length > 0;
                const active = nextStep?.id === step.id;
                const actionable = !step.done && !locked;
                const num = String(numberById[id]).padStart(2, "0");

                const classes = cn(
                  "flex items-start gap-3 rounded-lg border p-3.5 transition-colors",
                  active && "border-primary/40 bg-primary/5",
                  step.done && "bg-muted/30",
                  locked && "opacity-70",
                  actionable && "hover:border-primary/40 hover:bg-accent",
                );

                const inner = (
                  <>
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                        step.done
                          ? "bg-primary/15 text-primary"
                          : active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {step.done ? <Check className="size-4" /> : num}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "truncate text-sm font-medium",
                            active && "text-primary",
                          )}
                        >
                          {step.label}
                        </p>
                        {active ? (
                          <span className="shrink-0 rounded-full border border-primary/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            Atual
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {locked ? `Requer: ${missing.join(", ")}` : step.description}
                      </p>
                    </div>
                    <span className="mt-0.5 shrink-0 text-muted-foreground">
                      {step.done ? null : locked ? (
                        <Lock className="size-4" />
                      ) : (
                        <ArrowRight className="size-4" />
                      )}
                    </span>
                  </>
                );

                return actionable ? (
                  <Link key={id} href={step.href} className={classes}>
                    {inner}
                  </Link>
                ) : (
                  <div key={id} className={classes}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
