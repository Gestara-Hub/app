"use client";

import Link from "next/link";
import {
  Briefcase,
  CalendarPlus,
  Check,
  Clock,
  Compass,
  Contact,
  Lock,
  Tag,
  Tags,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OnboardingStep } from "../hooks/use-onboarding-steps";

// Icone e rotulo curto (para o texto "Requer: ...") por passo.
const STEP_ICON: Record<string, LucideIcon> = {
  hours: Clock,
  categories: Tags,
  services: Tag,
  roles: Briefcase,
  team: Contact,
  clients: Users,
  appointment: CalendarPlus,
};
const STEP_SHORT: Record<string, string> = {
  hours: "horário",
  categories: "categorias",
  services: "serviços",
  roles: "cargos",
  team: "equipe",
  clients: "clientes",
  appointment: "agendamento",
};

function StepTile({
  step,
  locked,
  missing,
}: {
  step: OnboardingStep;
  locked: boolean;
  missing: string[];
}) {
  const Icon = STEP_ICON[step.id] ?? Clock;
  const state = step.done ? "done" : locked ? "locked" : "todo";

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-lg border p-4 transition-colors",
        state === "done" && "border-primary/30 bg-primary/5",
        state === "locked" && "bg-muted/30",
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-full",
            state === "done"
              ? "bg-primary/15 text-primary"
              : state === "locked"
                ? "bg-muted text-muted-foreground/70"
                : "bg-secondary text-secondary-foreground",
          )}
        >
          <Icon className="size-5" />
        </div>
        {state === "done" ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3.5" />
          </span>
        ) : state === "locked" ? (
          <Lock className="size-4 text-muted-foreground" />
        ) : null}
      </div>

      <div className="space-y-1">
        <p
          className={cn(
            "text-sm font-semibold",
            state !== "todo" && "text-muted-foreground",
          )}
        >
          {step.label}
        </p>
        <p className="text-xs text-muted-foreground">
          {state === "locked"
            ? `Requer: ${missing.join(", ")}`
            : step.description}
        </p>
      </div>

      <div className="mt-auto pt-1">
        {state === "done" ? (
          <span className="text-xs font-medium text-primary">Concluído</span>
        ) : state === "locked" ? (
          <Button variant="outline" size="sm" className="w-full" disabled>
            <Lock className="size-3.5" />
            Bloqueado
          </Button>
        ) : (
          <Button variant="default" size="sm" className="w-full" asChild>
            <Link href={step.href}>{step.cta}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Card "Primeiros passos": grid de passos com estado concluido / disponivel /
 * bloqueado (cadeado). Um passo fica bloqueado enquanto seus pre-requisitos
 * (`requires`) nao estao concluidos — ex.: agendamento exige serviços, equipe e
 * clientes. Progresso derivado do dado; fica no Dashboard ate concluir/dispensar.
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

  return (
    <Card data-tour="onboarding-checklist" className="mb-4">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Primeiros passos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure seu negócio para começar a agendar · {doneCount} de {total}{" "}
            concluídos
          </p>
        </div>
        <div className="-mt-1 -mr-1 flex shrink-0 items-center gap-0.5">
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
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => {
            const missing = (step.requires ?? [])
              .filter((id) => !doneById[id])
              .map((id) => STEP_SHORT[id] ?? id);
            return (
              <StepTile
                key={step.id}
                step={step}
                locked={missing.length > 0}
                missing={missing}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
