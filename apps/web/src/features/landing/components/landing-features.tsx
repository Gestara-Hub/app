"use client";

import {
  Award,
  CalendarCheck2,
  MessageSquare,
  Wallet,
} from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

// Chips com o que existe no produto; nao repetem a descricao nem a secao
// "A parte chata" (doc 08, secao 3.4).
const FEATURES = [
  {
    icon: Wallet,
    title: "Financeiro e Pix",
    description: "Mensalidades, Pix e o resultado do mês.",
    chips: ["Mensalidade", "Pix e cartão", "Curso fechado", "Pacote de aulas"],
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: CalendarCheck2,
    title: "Turmas e aulas particulares",
    description: "Grade da semana, em grupo ou 1 a 1.",
    chips: ["Chamada no celular", "Limite de vagas", "Aula experimental", "Lista de espera"],
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: Award,
    title: "Evolução dos alunos",
    description: "Faixas, níveis, módulos ou fases, do seu jeito.",
    chips: ["Trilha por modalidade", "Graduação", "Registro de aula", "Metas"],
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: MessageSquare,
    title: "Comunicação",
    description: "Mensagens prontas, enviadas do seu número.",
    chips: ["Cobrança", "Lembrete", "Aniversário"],
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  },
];

export function LandingFeatures() {
  return (
    <section id="recursos" className="scroll-mt-16 py-20 bg-muted/20 border-t border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <ScrollReveal direction="up" distancePx={16} durationMs={450}>
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Recursos
            </span>
            <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground text-balance">
              Os 4 pilares da gestão do seu espaço
            </h2>
          </div>
        </ScrollReveal>

        {/* Features Grid: 4 pilares limpos e objetivos com entrada em cascata */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <ScrollReveal
                key={feat.title}
                delayMs={idx * 80}
                direction="up"
                distancePx={20}
                durationMs={450}
                className="h-full"
              >
                <div className="group relative rounded-2xl border border-border/80 bg-card p-6 shadow-2xs hover:shadow-md transition-all duration-200 hover:border-primary/40 hover:-translate-y-1 space-y-4 h-full">
                  <div className={`inline-flex rounded-xl p-3 border ${feat.color}`}>
                    <Icon className="size-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                      {feat.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {feat.chips.map((chip) => (
                      <li
                        key={chip}
                        className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {chip}
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
