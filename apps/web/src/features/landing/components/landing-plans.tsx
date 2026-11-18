"use client";

import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "./scroll-reveal";

// FORA DA PAGINA (17/10/2026): preco do Pro e cobranca do WhatsApp e do
// pagamento online ainda em aberto (doc 08, secao 3.5; doc 13). Volta para a
// LandingView quando isso for definido; revisar os itens dos dois cards antes.
// O que cada plano cobre segue o doc 13 (2.1 e 2.2).
const FREE_POINTS = [
  "Alunos e turmas sem limite",
  "Chamada no celular e evolução",
  "Mensalidade, curso e pacote de aulas",
  "Financeiro e repasse dos professores",
  "Lembrete no WhatsApp, enviado por você",
];

// Lado a lado, mesma altura do topo nos dois cards: as listas comecam na mesma linha (o
// espaco do Pro recebe o preco quando ele for definido).
const PLAN_HEADER = "space-y-1 md:min-h-17";
const PLAN_CARD = "flex h-full flex-col gap-6 rounded-2xl border bg-card p-6 sm:p-8 transition-all duration-200 hover:-translate-y-1 hover:shadow-md";

const PRO_POINTS = [
  "Pagamento online com baixa automática",
  "Lembretes automáticos no WhatsApp",
  "Mensagens pagas por você, direto à Meta",
  "Relatórios avançados",
  "Certificado de conclusão de curso",
  "Inscrição em evento por link, com ingresso",
];

export function LandingPlans() {
  return (
    <section id="planos" className="scroll-mt-16 py-20 border-t border-border/40">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
        <ScrollReveal direction="up" distancePx={16} durationMs={450}>
          <div className="text-center space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Planos
            </span>
            <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground text-balance">
              Grátis para o dia a dia
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Pague só se quiser automatizar.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <ScrollReveal direction="up" distancePx={20} durationMs={450} className="h-full">
            <div className={cn(PLAN_CARD, "border-primary/40 shadow-sm")}>
              <div className={PLAN_HEADER}>
                <h3 className="text-lg font-bold text-foreground">Grátis</h3>
                <p className="text-3xl font-extrabold text-foreground">
                  R$ 0 <span className="text-sm font-medium text-muted-foreground">por mês</span>
                </p>
              </div>
              <ul className="flex-1 space-y-2.5">
                {FREE_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-foreground/90">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full gap-2 font-semibold">
                <a href="#cadastro">
                  <span>Criar conta grátis</span>
                  <ArrowRight className="size-4" />
                </a>
              </Button>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="up" distancePx={20} durationMs={450} delayMs={80} className="h-full">
            <div className={cn(PLAN_CARD, "border-border/80 shadow-2xs hover:border-primary/40")}>
              <div className={PLAN_HEADER}>
                <h3 className="inline-flex items-center gap-2 text-lg font-bold text-foreground">
                  Pro
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    <Sparkles className="size-3" />
                    Opcional
                  </span>
                </h3>
              </div>
              <ul className="flex-1 space-y-2.5">
                <li className="flex items-start gap-2 text-sm font-semibold text-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>Tudo do Grátis</span>
                </li>
                {PRO_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-foreground/90">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              {/* Mesma altura do botao do Gratis: os dois cards fecham na mesma base. */}
              <p className="flex min-h-11 items-center justify-center rounded-md border border-dashed border-border px-3 py-2 text-center text-sm text-muted-foreground">
                Ative quando precisar, dentro do sistema.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
