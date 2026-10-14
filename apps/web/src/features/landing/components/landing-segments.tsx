"use client";

import { PlusCircle } from "lucide-react";
import { getAllSegmentPresets } from "@/lib/business-segment-presets";
import { SEGMENT_ICONS } from "@/lib/business-segment-icons";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "./scroll-reveal";

interface SegmentCard {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  examples: string;
  isOther?: boolean;
}

// As 10 areas vem dos presets (mesmo nome e exemplos do setup); o card
// "Outra área" fecha a grade convidando quem nao achou a sua.
const SEGMENT_CARDS: SegmentCard[] = [
  ...getAllSegmentPresets()
    .filter((preset) => preset.id !== "custom")
    .map((preset) => ({
      key: preset.id,
      icon: SEGMENT_ICONS[preset.id],
      title: preset.label,
      examples: preset.examples,
    })),
  {
    key: "custom",
    icon: PlusCircle,
    title: "Sua área não está aqui?",
    examples: "Também serve: teatro, xadrez, autoescola",
    isOther: true,
  },
];

export function LandingSegments() {
  return (
    <section id="modalidades" className="py-20 border-t border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <ScrollReveal direction="up" distancePx={16} durationMs={450}>
          <div className="text-center max-w-2xl mx-auto space-y-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Em grupo ou individual
            </span>
            <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground tracking-tight">
              Para quem ensina, em qualquer área
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Turmas coletivas ou aulas particulares (1 a 1) no mesmo sistema.
            </p>
          </div>
        </ScrollReveal>

        {/* 10 areas + "Outra área" ocupando 2 colunas: a grade fecha sem buraco em 2, 3 ou 4 colunas. */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 max-w-5xl mx-auto">
          {SEGMENT_CARDS.map((seg, idx) => {
            const Icon = seg.icon;
            return (
              <ScrollReveal
                key={seg.key}
                delayMs={idx * 40}
                direction="up"
                distancePx={18}
                durationMs={450}
                className={cn("h-full", seg.isOther && "col-span-2")}
              >
                <div
                  className={cn(
                    "group h-full rounded-2xl border p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md",
                    seg.isOther
                      ? "border-dashed border-border/90 bg-muted/20 hover:border-primary/50 flex flex-col sm:flex-row sm:items-center gap-3"
                      : "border-border/80 bg-card/60 hover:border-primary/40 hover:bg-card space-y-3",
                  )}
                >
                  <div className="size-9 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="size-4.5" />
                  </div>
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors">
                      {seg.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">{seg.examples}</p>
                  </div>
                  {seg.isOther ? (
                    <a
                      href="#cadastro"
                      className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      <span>Criar conta gratuita</span>
                      <span>&rarr;</span>
                    </a>
                  ) : null}
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
