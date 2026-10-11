"use client";

import { Check, X } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const COMPARISONS = [
  {
    before: "Negócio espalhado em vários sistemas, cadernos e planilhas",
    after: "Tudo em um só lugar: financeiro, comunicação e gerenciamento de turmas",
  },
  {
    before: "Perder tempo com prancheta de papel e mensagens no WhatsApp",
    after: "Chamada em 3 segundos no celular e turmas organizadas",
  },
  {
    before: "Mensalidades atrasadas e contas manuais para pagar professores",
    after: "Visão clara de quem pagou e repasse calculado em 1 clique",
  },
];

export function LandingProblems() {
  return (
    <section id="como-funciona" className="py-16 md:py-20 bg-muted/30 border-y border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        <ScrollReveal direction="up" distancePx={16} durationMs={450}>
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Menos dor de cabeça, mais tempo para ensinar
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">
              A rotina desgastante de hoje vs. Com o GestaraHub
            </h2>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Veja as dores reais do seu dia a dia que você elimina da sua rotina:
            </p>
          </div>
        </ScrollReveal>

        <div className="max-w-4xl mx-auto grid grid-cols-1 gap-2.5 sm:gap-3">
          {COMPARISONS.map((item, idx) => (
            <ScrollReveal
              key={idx}
              delayMs={idx * 70}
              direction="up"
              distancePx={16}
              durationMs={450}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs divide-y md:divide-y-0 md:divide-x divide-border/60 hover:border-primary/40 transition-colors">
                {/* Lado Antes (Vermelho suave) */}
                <div className="flex items-center gap-3 p-3.5 sm:p-4 bg-rose-500/[0.03] text-muted-foreground text-xs sm:text-sm">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
                    <X className="size-3 stroke-[3]" />
                  </span>
                  <span>{item.before}</span>
                </div>

                {/* Lado Depois (Verde suave) */}
                <div className="flex items-center gap-3 p-3.5 sm:p-4 bg-emerald-500/[0.03] text-foreground font-medium text-xs sm:text-sm">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Check className="size-3 stroke-[3]" />
                  </span>
                  <span>{item.after}</span>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export { LandingProblems as LandingHowItWorks };
