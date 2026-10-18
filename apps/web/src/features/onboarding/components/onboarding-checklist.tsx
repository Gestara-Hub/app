"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Compass,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionSpotlight } from "@/components/shared/section-spotlight";
import { useAttentionUntilInteraction } from "@/lib/use-attention-until-interaction";
import { cn } from "@/lib/utils";
import { isStepSatisfied, type OnboardingStep } from "../onboarding-steps";

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

// Itens da fase 1 das turmas, na ordem dos passos (so os que existem entram no texto).
const CONFIG_PARTS: [string, string][] = [
  ["hours", "Horário de funcionamento"],
  ["billing", "regras da mensalidade"],
  ["modalities", "modalidades"],
  ["plans", "planos"],
  ["packages", "pacotes"],
];

function joinParts(parts: string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}` : parts[0] ?? "";
}

// Fases do setup para turmas e aulas. A fase 1 cita so o que a area usa
// (mensalidade e planos, pacotes); area de curso fecha com curso e matricula.
function classesGroups(steps: OnboardingStep[], isCourseArea: boolean) {
  const present = new Set(steps.map((s) => s.id));
  // Area de mensalidade: o passo dos planos aceita pacote tambem ("Criar planos ou pacotes").
  const plansOrPackages = /pacotes/.test(steps.find((s) => s.id === "plans")?.label ?? "");
  const configParts = CONFIG_PARTS.filter(([id]) => present.has(id)).map(([id, part]) =>
    id === "plans" && plansOrPackages ? "planos ou pacotes" : part,
  );
  return [
    {
      id: "config",
      label: "Fase 1: Configuração",
      description: `${joinParts(configParts)}.`,
      stepIds: CONFIG_PARTS.map(([id]) => id),
    },
    {
      id: "people",
      label: "Fase 2: Pessoas",
      description: "Professores, instrutores e alunos.",
      stepIds: ["team", "clients"],
    },
    isCourseArea
      ? {
          id: "ops",
          label: "Fase 3: Cursos e matrículas",
          description: "Criação do curso e matrícula dos alunos.",
          stepIds: ["classes", "enroll"],
        }
      : {
          id: "ops",
          label: "Fase 3: Turmas e matrículas",
          description: "Criação de turmas e matrículas de alunos.",
          stepIds: ["classes"],
        },
  ];
}

/**
 * Checklist de primeiros passos no padrão Setup Guide unificado:
 * - Layout em coluna contínua (sem o zigue-zague e sem cards órfãos).
 * - Fases 100% concluídas ficam recolhidas por padrão (expansíveis sob demanda)
 *   para não empurrar o passo atual para fora da tela no mobile.
 * - Auto-scroll suave até o card do Passo Atual caso esteja fora da área visível.
 */
export function OnboardingChecklist({
  steps,
  doneCount,
  total,
  isClasses = false,
  isCourseArea = false,
  highlightNextStep = false,
  spotlightNextStep = false,
  onSpotlightDone,
  onStartTour,
}: {
  steps: OnboardingStep[];
  doneCount: number;
  total: number;
  isClasses?: boolean;
  /** Area de curso fechado (fase 3 de cursos, mensalidade so se alguma turma cobrar). */
  isCourseArea?: boolean;
  highlightNextStep?: boolean;
  /**
   * Logo depois de fechar as boas-vindas (uma vez): destaca o cartao do passo
   * atual com o resto da tela escuro ("Comece por aqui."). Enquanto aberto, o
   * "Continuar" nao pulsa.
   */
  spotlightNextStep?: boolean;
  onSpotlightDone?: () => void;
  onStartTour: () => void;
}) {
  const groups = !isClasses ? GROUPS_DEFAULT : classesGroups(steps, isCourseArea);
  const activeStepRef = useRef<HTMLElement | null>(null);
  const spotlightRefs = useMemo(() => [activeStepRef], []);
  const [expandedCompletedGroups, setExpandedCompletedGroups] = useState<
    Record<string, boolean>
  >({});

  const stepShort: Record<string, string> = {
    hours: "horário",
    billing: "regras da mensalidade",
    categories: "categorias",
    services: "serviços",
    modalities: "modalidades",
    roles: "cargos",
    team: isClasses ? "professores" : "equipe",
    classes: isCourseArea ? "curso" : "turmas",
    enroll: "matrículas",
    plans: "planos",
    packages: "pacotes",
    clients: isClasses ? "alunos" : "clientes",
    appointment: "agendamento",
  };

  const pct = Math.round((doneCount / total) * 100);
  const satisfiedById = Object.fromEntries(steps.map((s) => [s.id, isStepSatisfied(s)]));
  const stepById = Object.fromEntries(steps.map((s) => [s.id, s]));
  const numberById = Object.fromEntries(steps.map((s, i) => [s.id, i + 1]));

  const missingOf = (step: OnboardingStep) =>
    (step.requires ?? [])
      .filter((id) => !satisfiedById[id])
      .map((id) => stepShort[id] ?? id);

  // Próximo passo ativo = primeiro não concluído e sem pré-requisito pendente
  const nextStep = steps.find((s) => !s.done && missingOf(s).length === 0);
  // "Continuar" do passo atual pulsa sem parar ate ser clicado.
  const spotlightOn = spotlightNextStep && highlightNextStep && Boolean(nextStep);
  const nextStepAttention = useAttentionUntilInteraction(
    highlightNextStep && Boolean(nextStep) && !spotlightOn,
    nextStep?.id ?? null,
  );

  // Garante que o passo atual (com o botão pulsante) fique visível em telas pequenas
  useEffect(() => {
    if (!nextStep?.id || !highlightNextStep) return;
    const timer = window.setTimeout(() => {
      const el = activeStepRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const isOutOfViewport =
        rect.bottom > window.innerHeight - 24 || rect.top < 72;
      if (isOutOfViewport) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [nextStep?.id, highlightNextStep]);

  return (
    <div
      data-tour="onboarding-checklist"
      className="mb-8 w-full space-y-6"
    >
      <SectionSpotlight
        active={spotlightOn}
        targetRefs={spotlightRefs}
        onDismiss={() => onSpotlightDone?.()}
        hint="Comece por aqui."
      />
      {/* Cabeçalho do Setup Guide com Progresso e Estimativa */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Primeiros passos
              </h2>
              <span className="text-muted-foreground/40 hidden sm:inline">·</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">
                  {doneCount} de {total} concluídos
                </span>
                <Badge
                  variant="secondary"
                  className="gap-1 text-[11px] font-medium py-0 px-2 bg-muted text-muted-foreground border-transparent"
                >
                  <Clock className="size-3" />
                  ~5 minutos
                </Badge>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Complete as etapas abaixo para preparar o funcionamento da sua unidade.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={onStartTour}
            className="gap-1.5 text-xs self-start sm:self-center shrink-0"
          >
            <Compass className="size-3.5" />
            Fazer tour guiado
          </Button>
        </div>

        {/* Linha de progresso */}
        <div className="h-2 overflow-hidden rounded-full bg-primary/10">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Lista contínua de passos agrupados por fase */}
      <div className="space-y-6 pt-1">
        {groups.map((group) => {
          const groupSteps = group.stepIds
            .map((id) => stepById[id])
            .filter((s): s is OnboardingStep => Boolean(s));
          const groupDoneCount = groupSteps.filter((s) => s.done).length;
          const isGroupComplete =
            groupSteps.length > 0 && groupDoneCount === groupSteps.length;
          const isExpanded = !isGroupComplete || Boolean(expandedCompletedGroups[group.id]);

          return (
            <section key={group.id} className="space-y-2.5">
              {isGroupComplete ? (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedCompletedGroups((prev) => ({
                      ...prev,
                      [group.id]: !prev[group.id],
                    }))
                  }
                  aria-expanded={isExpanded}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-3.5 py-2.5 text-left transition-colors hover:bg-emerald-500/[0.08] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                      <Check className="size-3.5 stroke-[3]" />
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        {group.label}
                      </span>
                      <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                        {groupDoneCount}/{groupSteps.length} concluídas
                      </span>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground shrink-0">
                    {isExpanded ? "Ocultar" : "Ver etapas"}
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform duration-200",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </span>
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-1 border-b border-border/50">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </h3>
                  <p className="text-xs text-muted-foreground/70">
                    {group.description}
                  </p>
                </div>
              )}

              {isExpanded ? (
                <div className="space-y-2">
                  {group.stepIds.map((id) => {
                    const step = stepById[id];
                    if (!step) return null;
                    const missing = missingOf(step);
                    const locked = missing.length > 0;
                    const active = nextStep?.id === step.id;
                    const actionable = !step.done && !locked;
                    const num = String(numberById[id]).padStart(2, "0");

                    const cardClasses = cn(
                      "group relative flex items-center justify-between gap-4 rounded-xl border p-3.5 sm:px-4 sm:py-3.5 transition-all duration-200 scroll-mt-24",
                      active
                        ? "border-primary/50 bg-primary/[0.04] dark:bg-primary/[0.08] shadow-xs"
                        : step.done
                          ? "border-border/60 bg-muted/20 opacity-85"
                          : locked
                            ? "border-border/50 bg-muted/10 opacity-60 cursor-not-allowed"
                            : "border-border/80 bg-card hover:border-foreground/20 hover:bg-accent/40 cursor-pointer",
                    );

                    const cardContent = (
                      <>
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                          {/* Indicador numérico ou de conclusão */}
                          <span
                            className={cn(
                              "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums mt-0.5 sm:mt-0 transition-colors",
                              step.done
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : step.needsReview && !active
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                  : active
                                  ? "bg-primary text-primary-foreground shadow-xs"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {step.done ? <Check className="size-4 stroke-[3]" /> : num}
                          </span>

                          {/* Título e descrição */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p
                                className={cn(
                                  "text-sm font-medium",
                                  active
                                    ? "font-semibold text-foreground"
                                    : step.done
                                      ? "text-muted-foreground"
                                      : "text-foreground",
                                )}
                              >
                                {step.label}
                              </p>
                              {step.needsReview ? (
                                <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                                  Falta revisar
                                </span>
                              ) : active ? (
                                <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                                  Passo Atual
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                              {locked ? (
                                <span className="font-medium text-amber-700 dark:text-amber-400">
                                  Requer: {missing.join(", ")}
                                </span>
                              ) : (
                                step.description
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Ação à direita */}
                        <div className="shrink-0 flex items-center gap-2">
                          {step.done ? (
                            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hidden sm:inline">
                              Concluído
                            </span>
                          ) : active ? (
                            <Button
                              className={cn(
                                "gap-1.5 font-semibold text-xs shadow-xs",
                                nextStepAttention.attention &&
                                  "motion-safe:animate-attention-loop-infinite",
                              )}
                              asChild
                            >
                              <span>
                                {step.needsReview ? "Revisar" : "Continuar"}
                                <ArrowRight className="size-3.5" />
                              </span>
                            </Button>
                          ) : locked ? (
                            <Lock className="size-4 text-muted-foreground/60" />
                          ) : (
                            <ArrowRight className="size-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                          )}
                        </div>
                      </>
                    );

                    return actionable ? (
                      <Link
                        key={id}
                        ref={(node) => {
                          if (active) activeStepRef.current = node;
                        }}
                        href={step.href}
                        onClick={active ? nextStepAttention.stop : undefined}
                        className={cardClasses}
                      >
                        {cardContent}
                      </Link>
                    ) : (
                      <div
                        key={id}
                        ref={(node) => {
                          if (active) activeStepRef.current = node;
                        }}
                        className={cardClasses}
                      >
                        {cardContent}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
