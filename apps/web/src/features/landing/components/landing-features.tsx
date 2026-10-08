"use client";

import {
  Award,
  CalendarCheck2,
  CreditCard,
  Handshake,
  Smartphone,
  Users,
} from "lucide-react";

const FEATURES = [
  {
    icon: CalendarCheck2,
    title: "Grade Semanal & Lotação",
    description:
      "Horários por sala, controle de vagas em tempo real e fila de espera automática.",
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: Users,
    title: "Chamada no Celular",
    description:
      "Presenças, faltas e reposições registradas em 3 segundos direto pelo smartphone.",
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: Award,
    title: "Evolução & Graduações",
    description:
      "Níveis, módulos e esteira de faixas com alertas de quem está pronto para avançar.",
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: CreditCard,
    title: "Mensalidades & Cobranças",
    description:
      "Gere cobranças do mês, veja quem está em atraso e dê baixas sem taxas de software.",
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  },
  {
    icon: Handshake,
    title: "Repasse de Professores",
    description:
      "Fechamento automático por valor de aula, comissão por aluno ou salário fixo.",
    color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
  },
  {
    icon: Smartphone,
    title: "App do Aluno e Professor",
    description:
      "Horários, presenças e status das aulas direto na mão de quem treina e ensina.",
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
  },
];

export function LandingFeatures() {
  return (
    <section id="recursos" className="py-20 bg-muted/20 border-t border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            O coração operacional completo
          </span>
          <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground">
            Tudo o que sua turma precisa para funcionar no piloto automático
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Recursos essenciais para organizar a rotina do seu espaço com simplicidade e rapidez.
          </p>
        </div>

        {/* Features Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="group relative rounded-2xl border border-border/80 bg-card p-6 shadow-2xs hover:shadow-md transition-all hover:border-primary/40 space-y-3"
              >
                <div
                  className={`inline-flex rounded-xl p-3 border ${feat.color}`}
                >
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
