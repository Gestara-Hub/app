"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Dumbbell,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ClassSegment {
  id: "martial-arts" | "pilates" | "functional" | "schools";
  shortTitle: string;
  title: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  features: string[];
}

const CLASS_SEGMENTS: ClassSegment[] = [
  {
    id: "martial-arts",
    shortTitle: "Lutas & Artes Marciais",
    title: "Lutas & Artes Marciais",
    badge: "Especialidade do GestaraHub",
    icon: Award,
    description:
      "Perfeito para academias de Jiu-Jitsu, Muay Thai, Judô, Boxe, Karatê e Taekwondo que precisam de controle rigoroso de faixas, presenças e histórico no tatame.",
    features: [
      "Sistema de graduação por tempo de treino ou presenças mínimas",
      "Controle de graus, faixas com pontas pretas e faixas infantis",
      "Chamada digital no celular em 3 segundos direto no tatame",
      "Separação de turmas por nível (Iniciantes, Avançado, Kids, No-Gi)",
      "Histórico de treinos e graduações registrado para sempre",
      "Gestão de reposições e alunos avulsos na mesma grade",
    ],
  },
  {
    id: "pilates",
    shortTitle: "Pilates & Yoga",
    title: "Estúdios de Pilates & Yoga",
    badge: "Controle Estrito de Sessão",
    icon: Activity,
    description:
      "Ideal para studios de Pilates (aparelhos e solo), Yoga e postura que trabalham com turmas reduzidas e regras claras de cancelamento e reposição.",
    features: [
      "Limite estrito de alunos por aparelho (ex: 3 a 4 alunos por horário)",
      "Regras claras de reposição com controle de prazo de cancelamento",
      "Planos mensais recorrentes, pacotes de sessões e aulas avulsas",
      "Visão rápida de horários vagos para preencher e faturar mais",
      "Histórico de frequência e evolução postural do aluno",
      "Controle de faltas justificadas sem bagunça no WhatsApp",
    ],
  },
  {
    id: "functional",
    shortTitle: "Boxes & Funcional",
    title: "Boxes de Treino & Funcional",
    badge: "Alta Demanda & Lotação",
    icon: Dumbbell,
    description:
      "Feito para boxes de CrossFit, Treinamento Funcional e HIIT com horários concorridos e necessidade de controle rigoroso de vagas por treino.",
    features: [
      "Capacidade máxima por turma com bloqueio automático ao lotar",
      "Fila de espera inteligente que avisa o próximo aluno na desistência",
      "Controle de planos recorrentes, diárias e passes de treino",
      "Relatório de ocupação média por dia e faixa de horário",
      "Check-in ágil para os alunos direto pelo smartphone",
      "Gestão de múltiplos coaches e horários simultâneos",
    ],
  },
  {
    id: "schools",
    shortTitle: "Dança & Escolas",
    title: "Dança, Natação & Escolas",
    badge: "Turmas por Faixa Etária",
    icon: Sparkles,
    description:
      "Para escolas de dança, natação infantil e juvenil, ginástica e modalidades esportivas divididas por faixas etárias ou níveis técnicos.",
    features: [
      "Turmas divididas por nível técnico (Iniciante, Intermediário, Avançado)",
      "Gestão de alunos menores com cadastro completo de responsáveis",
      "Controle de mensalidades familiares e múltiplos alunos por responsável",
      "Quadro de avisos e lista de chamada rápida por turma",
      "Acompanhamento de frequência e evolução técnica das turmas",
      "Comunicação direta com os pais sobre frequência e avisos",
    ],
  },
];

export function LandingSegments() {
  const [activeTab, setActiveTab] = useState<ClassSegment["id"]>("martial-arts");
  const activeSegment =
    CLASS_SEGMENTS.find((s) => s.id === activeTab) ?? CLASS_SEGMENTS[0];

  return (
    <section id="modalidades" className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Feito para quem ensina em grupo
          </span>
          <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground">
            A plataforma moldada para a sua modalidade
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Seja no tatame de luta, nos aparelhos de pilates ou no box de treino:
            o GestaraHub tem as regras exatas para organizar suas turmas.
          </p>
        </div>

        {/* Balanced Segment Switcher Tabs */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-2 max-w-4xl mx-auto p-1.5 rounded-2xl bg-muted/50 border border-border/80">
          {CLASS_SEGMENTS.map((seg) => {
            const TabIcon = seg.icon;
            const isSelected = seg.id === activeTab;
            return (
              <button
                key={seg.id}
                type="button"
                onClick={() => setActiveTab(seg.id)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl py-3 px-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer text-center",
                  isSelected
                    ? "bg-card text-foreground shadow-sm border border-border/80 font-bold scale-[1.01]"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40",
                )}
              >
                <TabIcon
                  className={cn(
                    "size-4 shrink-0",
                    isSelected ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="truncate">{seg.shortTitle}</span>
              </button>
            );
          })}
        </div>

        {/* Standardized Height Showcase Card (Zero Layout Shift) */}
        <div className="mt-8 max-w-4xl mx-auto rounded-3xl border border-border/80 bg-card p-6 sm:p-10 shadow-lg flex flex-col justify-between min-h-[520px] md:min-h-[448px]">
          {/* Top Section with standardized min-height */}
          <div className="space-y-3 min-h-[145px] sm:min-h-[125px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <CheckCircle2 className="size-3.5" />
              <span>{activeSegment.badge}</span>
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {activeSegment.title}
            </h3>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-2xl">
              {activeSegment.description}
            </p>
          </div>

          {/* Features in a clean 2-column grid with standardized min-height */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5 pt-4 border-t border-border/40 min-h-[160px] md:min-h-[110px]">
            {activeSegment.features.map((feat) => (
              <div key={feat} className="flex items-start gap-3 text-sm">
                <div className="rounded-full bg-emerald-500/15 p-1 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0">
                  <Check className="size-3.5 stroke-[3]" />
                </div>
                <span className="text-foreground/90">{feat}</span>
              </div>
            ))}
          </div>

          {/* Footer Bar pinned to the bottom */}
          <div className="pt-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Button asChild size="lg" className="h-11 w-full sm:w-auto gap-2 font-semibold shadow-xs">
              <Link href="/login">
                <span>Começar grátis nesta modalidade</span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground text-center sm:text-right">
              Alunos e turmas ilimitados • Sem cartão de crédito
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
