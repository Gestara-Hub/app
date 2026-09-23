"use client";

import Link from "next/link";
import { ArrowRight, Check, Compass, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OnboardingStep } from "../hooks/use-onboarding-steps";

// Fases do setup para agendamento individual (Barbearia, Clínica, etc.)
const GROUPS_DEFAULT = [
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

// Fases do setup para turmas e aulas coletivas (Escola de Idiomas, Cursos, Academia, etc.)
const GROUPS_CLASSES = [
  {
    id: "config",
    label: "Configuração",
    description: "Horário de funcionamento, regras de cobrança, modalidades e planos.",
    stepIds: ["hours", "billing", "modalities", "plans"],
  },
  {
    id: "people",
    label: "Pessoas",
    description: "Professores, instrutores e alunos.",
    stepIds: ["team", "clients"],
  },
  {
    id: "ops",
    label: "Turmas & Matrículas",
    description: "Criação de turmas e matrículas de alunos.",
    stepIds: ["classes"],
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
  isClasses = false,
  highlightNextStep = false,
  onStartTour,
}: {
  steps: OnboardingStep[];
  doneCount: number;
  total: number;
  isClasses?: boolean;
  /** Pulsa o "Continuar" do proximo passo. */
  highlightNextStep?: boolean;
  onStartTour: () => void;
}) {
  const groups = isClasses ? GROUPS_CLASSES : GROUPS_DEFAULT;

  const stepShort: Record<string, string> = {
    hours: "horário",
    billing: "regras de cobrança",
    categories: "categorias",
    services: "serviços",
    modalities: "modalidades",
    roles: "cargos",
    team: isClasses ? "professores" : "equipe",
    classes: "turmas",
    plans: "planos",
    clients: isClasses ? "alunos" : "clientes",
    appointment: "agendamento",
  };
  const pct = Math.round((doneCount / total) * 100);
  const doneById = Object.fromEntries(steps.map((s) => [s.id, s.done]));
  const stepById = Object.fromEntries(steps.map((s) => [s.id, s]));
  const numberById = Object.fromEntries(steps.map((s, i) => [s.id, i + 1]));

  const missingOf = (step: OnboardingStep) =>
    (step.requires ?? [])
      .filter((id) => !doneById[id])
      .map((id) => stepShort[id] ?? id);

  // Proximo passo = primeiro disponivel (nao concluido e sem pre-requisito pendente).
  const nextStep = steps.find((s) => !s.done && missingOf(s).length === 0);

  return (
    <div
      data-tour="onboarding-checklist"
      className="mb-8 space-y-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Primeiros passos
          </p>
          <span className="text-xs text-muted-foreground">·</span>
          <p className="text-xs font-medium text-muted-foreground tabular-nums">
            {doneCount}/{total} concluídos
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onStartTour}
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Compass className="size-3.5" />
          Tour
        </Button>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-fuchsia-100/70 dark:bg-fuchsia-950/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {nextStep ? (
        <div className="flex flex-col gap-3 rounded-xl border border-fuchsia-200/90 bg-gradient-to-r from-fuchsia-50/80 via-pink-50/40 to-card p-4 shadow-xs dark:border-fuchsia-900/50 dark:from-fuchsia-950/30 dark:via-pink-950/15 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fuchsia-600 dark:text-fuchsia-400">
              <Sparkles className="size-3.5" />
              Próximo passo
            </p>
            <p className="mt-1 truncate text-lg font-semibold text-foreground">
              {nextStep.label}
            </p>
          </div>
          <Button
            asChild
            className={cn(
              "shrink-0 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-xs shadow-fuchsia-600/25 hover:from-fuchsia-700 hover:to-pink-700",
              highlightNextStep && "motion-safe:animate-attention-loop",
            )}
          >
            <Link href={nextStep.href}>
              Continuar
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="space-y-5">
        {groups.map((group) => (
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
                  "flex items-start gap-3 rounded-xl border bg-card p-3.5 shadow-xs transition-colors",
                  active && "border-fuchsia-300/90 bg-fuchsia-50/40 dark:border-fuchsia-800/60 dark:bg-fuchsia-950/20",
                  step.done && "bg-muted/30",
                  locked && "opacity-70",
                  actionable && "hover:border-fuchsia-300 hover:bg-accent",
                );

                const inner = (
                  <>
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                        step.done
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : active
                            ? "bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white shadow-xs"
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
                            active && "font-semibold text-fuchsia-950 dark:text-fuchsia-200",
                          )}
                        >
                          {step.label}
                        </p>
                        {active ? (
                          <span className="shrink-0 rounded-full border border-fuchsia-300 bg-fuchsia-50/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-700 dark:border-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-300">
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
