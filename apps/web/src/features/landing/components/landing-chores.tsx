"use client";

import {
  Award,
  Calculator,
  MessageCircle,
  ReceiptText,
  Ticket,
  UserX,
} from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

// So tarefas que o produto ja resolve no plano gratis (doc 08, secao 3.2).
// Reposicao, contrato e nota fiscal ficam de fora ate existirem.
const CHORES = [
  {
    icon: MessageCircle,
    chore: "Cobrar aluno atrasado",
    solution: "Lembrete pronto no WhatsApp, você só envia.",
  },
  {
    icon: ReceiptText,
    chore: "Saber quem já pagou",
    solution: "Mensalidades lançadas sozinhas. Quem atrasou aparece em vermelho.",
  },
  {
    icon: Calculator,
    chore: "Calcular o pagamento",
    solution: "O sistema faz a conta pela regra de cada professor.",
  },
  {
    icon: UserX,
    chore: "Perceber aluno sumindo",
    solution: "O painel avisa quem faltou várias aulas seguidas.",
  },
  {
    icon: Ticket,
    chore: "Controlar pacotes de aulas",
    solution: "A chamada desconta cada aula do pacote.",
  },
  {
    icon: Award,
    chore: "Saber quem sobe de nível",
    solution: "O sistema conta as presenças e avisa.",
  },
];

export function LandingChores() {
  return (
    <section id="parte-chata" className="scroll-mt-16 py-16 md:py-20 bg-muted/30 border-y border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <ScrollReveal direction="up" distancePx={16} durationMs={450}>
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Menos dor de cabeça, mais tempo para ensinar
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground text-balance">
              A parte chata, a gente resolve
            </h2>
          </div>
        </ScrollReveal>

        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {CHORES.map((item, idx) => {
            const Icon = item.icon;
            return (
              <ScrollReveal
                key={item.chore}
                delayMs={idx * 60}
                direction="up"
                distancePx={16}
                durationMs={450}
                className="h-full"
              >
                <div className="group flex h-full items-start gap-3 rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-4.5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors">
                      {item.chore}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">{item.solution}</p>
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
