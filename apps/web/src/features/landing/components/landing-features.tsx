"use client";

import {
  Award,
  CalendarCheck2,
  CheckCircle2,
  MessageSquare,
  Wallet,
} from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const FEATURES = [
  {
    icon: Wallet,
    title: "Gestão Financeira",
    description:
      "Mensalidades sob controle, visão clara de quem pagou e fechamento de repasse aos professores sem calculadora.",
    points: ["Cobrança sem constrangimento", "Fechamento em 1 clique"],
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: CalendarCheck2,
    title: "Turmas & Aulas Particulares",
    description:
      "Grade flexível para turmas em grupo ou aulas individuais (particulares). Presença em 3 segundos no celular e limite de vagas.",
    points: ["Em grupo ou individual", "Chamada com 1 toque"],
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: Award,
    title: "Controle de Progresso",
    description:
      "Configure a trilha de evolução dos alunos (faixas, níveis ou fases) com critérios automáticos de presença e tempo de treino.",
    points: ["Trilhas 100% personalizáveis", "Critérios automáticos de avanço"],
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: MessageSquare,
    title: "Comunicação & Vagas",
    description:
      "Agendamento de reposições, alunos em aula experimental e avisos importantes sem a bagunça do WhatsApp.",
    points: ["Reposições na grade", "Alunos experimentais"],
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  },
];

export function LandingFeatures() {
  return (
    <section id="recursos" className="py-20 bg-muted/20 border-t border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <ScrollReveal direction="up" distancePx={16} durationMs={450}>
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Tudo em um só lugar
            </span>
            <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground">
              Os 4 pilares da gestão do seu espaço
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              Esqueça sistemas separados e planilhas desconexas. Tudo o que você
              precisa está reunido de forma simples.
            </p>
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
                <div className="group relative rounded-2xl border border-border/80 bg-card p-6 shadow-2xs hover:shadow-md transition-all duration-200 hover:border-primary/40 hover:-translate-y-1 flex flex-col justify-between space-y-4 h-full">
                  <div className="space-y-3">
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
                  </div>

                  <div className="pt-3 border-t border-border/40 space-y-1.5">
                    {feat.points.map((point) => (
                      <div
                        key={point}
                        className="flex items-center gap-1.5 text-xs text-foreground/80 font-medium"
                      >
                        <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
