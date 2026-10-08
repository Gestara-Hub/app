"use client";

import {
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileCheck2,
  Smartphone,
  TrendingUp,
} from "lucide-react";

const STEPS = [
  {
    step: "01",
    icon: Calendar,
    title: "Monte sua grade de turmas",
    description:
      "Cadastre os horários da semana, salas ou espaços, limite de vagas e professores responsáveis em poucos minutos.",
    highlight: "Controle de vagas em tempo real",
  },
  {
    step: "02",
    icon: Smartphone,
    title: "Faça a chamada no celular",
    description:
      "O professor abre a turma do horário e marca presenças, faltas e reposições em 3 segundos direto no celular, sem papel.",
    highlight: "Sincronizado na nuvem na hora",
  },
  {
    step: "03",
    icon: TrendingUp,
    title: "Deixe a rotina no piloto automático",
    description:
      "O sistema acompanha a frequência dos alunos, gerencia reposições e organiza as mensalidades e cobranças do mês.",
    highlight: "Zero contas e controles manuais",
  },
];

const METRICS = [
  {
    value: "0",
    label: "Pranchetas ou listas de papel",
    description:
      "Chamada 100% digital, presenças seguras e histórico do aluno salvo para sempre na nuvem.",
    icon: FileCheck2,
    color: "text-blue-500",
  },
  {
    value: "+15h",
    label: "Economizadas por semana",
    description:
      "Fim do tempo perdido conferindo comprovantes de Pix e calculando repasse de professor na calculadora.",
    icon: Clock,
    color: "text-emerald-500",
  },
  {
    value: "R$ 0",
    label: "De mensalidade de sistema",
    description:
      "Alunos e turmas ilimitados para sempre. Sem pegadinhas, sem taxas surpresa e sem cartão de crédito.",
    icon: Coins,
    color: "text-amber-500",
  },
];

export function LandingProblems() {
  return (
    <section id="como-funciona" className="py-20 bg-muted/30 border-y border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Part 1: How it Works (3 Simple Steps) */}
        <div className="space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Simples e Rápido
            </span>
            <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground">
              Como funciona na prática
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              Do cadastro inicial à rotina das suas aulas em 3 passos descomplicados:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="relative rounded-2xl border border-border/80 bg-card p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <Icon className="size-5" />
                      </div>
                      <span className="text-2xl font-black text-muted-foreground/30 font-mono">
                        {item.step}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-base font-bold text-foreground">
                        {item.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/40 flex items-center gap-1.5 text-xs text-primary font-medium">
                    <CheckCircle2 className="size-3.5" />
                    <span>{item.highlight}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Part 2: Impact Metrics (Numbers that speak) */}
        <div className="rounded-3xl border border-border/80 bg-card/60 p-8 sm:p-10 shadow-lg backdrop-blur-sm space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Resultados Reais
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground">
              O impacto direto na gestão do seu espaço
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-border/60">
            {METRICS.map((metric, idx) => (
              <div
                key={metric.label}
                className={`space-y-2 text-center ${idx > 0 ? "pt-6 md:pt-0 md:pl-8" : ""}`}
              >
                <div className={`text-4xl sm:text-5xl font-black ${metric.color} tracking-tight`}>
                  {metric.value}
                </div>
                <h4 className="text-sm font-bold text-foreground">
                  {metric.label}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {metric.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Re-export alias for semantic clarity
export { LandingProblems as LandingHowItWorks };
