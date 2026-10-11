"use client";

import {
  Activity,
  Award,
  Dumbbell,
  Languages,
  PlusCircle,
  Sparkles,
} from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

interface MinimalSegment {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  examples: string;
  description: string;
  tag: string;
}

const MINIMAL_SEGMENTS: MinimalSegment[] = [
  {
    icon: Award,
    title: "Lutas & Artes Marciais",
    examples: "Jiu-Jitsu • Muay Thai • Judô • Boxe",
    description: "Chamada no tatame e esteira de faixas.",
    tag: "Turmas e Personal",
  },
  {
    icon: Activity,
    title: "Pilates & Yoga",
    examples: "Reformer • Solo • Studio VIP",
    description: "Turmas pequenas e aulas particulares.",
    tag: "Grupos ou 1 a 1",
  },
  {
    icon: Languages,
    title: "Música & Idiomas",
    examples: "Inglês • Espanhol • Violão • Piano • Canto",
    description: "Aulas particulares ou turmas por módulos.",
    tag: "VIP ou em Grupo",
  },
  {
    icon: Sparkles,
    title: "Dança & Movimento",
    examples: "Ballet • Salão • Ritmos • Ginástica",
    description: "Turmas por nível e aulas particulares.",
    tag: "Coletivo ou VIP",
  },
  {
    icon: Dumbbell,
    title: "Boxes & Funcional",
    examples: "CrossFit • Funcional • HIIT • Calistenia",
    description: "Bloqueio ao lotar e fila de espera automática.",
    tag: "Lotação e Fila",
  },
  {
    icon: PlusCircle,
    title: "Outra modalidade?",
    examples: "Natação • Tênis • Cursos Livres",
    description: "Regras flexíveis para o seu jeito de ensinar.",
    tag: "Personalizado",
  },
];

export function LandingSegments() {
  return (
    <section id="modalidades" className="py-20 border-t border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header minimalista com texto ultra-conciso */}
        <ScrollReveal direction="up" distancePx={16} durationMs={450}>
          <div className="text-center max-w-2xl mx-auto space-y-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Em grupo ou individual
            </span>
            <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground tracking-tight">
              Feito para o formato da sua aula
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Turmas coletivas ou aulas particulares (1 a 1) no mesmo sistema.
            </p>
          </div>
        </ScrollReveal>

        {/* Grid minimalista: 6 cards alinhados com micro-copy e entrada escalonada */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {MINIMAL_SEGMENTS.map((seg, idx) => {
            const Icon = seg.icon;
            const isLast = idx === MINIMAL_SEGMENTS.length - 1;
            return (
              <ScrollReveal
                key={seg.title}
                delayMs={idx * 60}
                direction="up"
                distancePx={18}
                durationMs={450}
                className="h-full"
              >
                <div
                  className={`group rounded-2xl border p-5 shadow-2xs transition-all duration-200 flex flex-col justify-between space-y-3.5 h-full hover:-translate-y-1 hover:shadow-md ${
                    isLast
                      ? "border-dashed border-border/90 bg-muted/20 hover:border-primary/50"
                      : "border-border/80 bg-card/60 hover:border-primary/40 hover:bg-card"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <Icon className="size-4.5" />
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-full">
                        {seg.tag}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                        {seg.title}
                      </h3>
                      <p className="text-xs font-medium text-primary/80">
                        {seg.examples}
                      </p>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {seg.description}
                    </p>
                  </div>

                  {isLast && (
                    <a
                      href="#cadastro"
                      className="text-xs font-semibold text-primary hover:underline pt-1 inline-flex items-center gap-1"
                    >
                      <span>Criar conta gratuita</span>
                      <span>&rarr;</span>
                    </a>
                  )}
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
