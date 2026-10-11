"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollReveal } from "./scroll-reveal";

const FAQS = [
  {
    question: "O GestaraHub é realmente gratuito? Tem limite de alunos ou turmas?",
    answer:
      "Sim! Toda a gestão operacional — cadastro ilimitado de alunos, criação de turmas e horários particulares, grade semanal, chamada digital, esteira de evolução e controle de mensalidades — é 100% gratuita para sempre. Seu espaço pode crescer sem pagar nada e sem pegadinhas.",
  },
  {
    question: "Funciona para aulas individuais (particulares) ou só turmas em grupo?",
    answer:
      "Funciona perfeitamente para ambos! Você pode gerenciar turmas coletivas ou agendar aulas particulares (individuais / 1 a 1) — como aulas VIP de idiomas, instrumentos musicais ou sessões particulares. Você define o limite de vagas de cada horário como 1 aluno ou turmas completas.",
  },
  {
    question: "Posso usar em aulas de música, instrumentos ou escolas de línguas (idiomas)?",
    answer:
      "Com certeza! O sistema é ideal para aulas de inglês, espanhol, violão, piano, teclado, técnica vocal e canto. Você consegue organizar turmas por níveis ou módulos, controlar reposições de aulas sem bagunça no WhatsApp e acompanhar o pagamento das mensalidades.",
  },
  {
    question: "O professor consegue fazer a lista de chamada pelo celular?",
    answer:
      "Sim! O GestaraHub é 100% otimizado para celulares e tablets. O professor abre o horário da aula, registra presenças com 1 toque, marca faltas e adiciona reposições ou alunos de aula experimental em poucos segundos.",
  },
  {
    question: "Como funciona o controle de evolução e trilhas de progresso?",
    answer:
      "Você configura a trilha de evolução de acordo com a sua modalidade — seja por faixas e graus em lutas, níveis técnicos no pilates, módulos na dança e idiomas ou fases esportivas. O sistema contabiliza as aulas de cada aluno e avisa automaticamente quando ele cumpre os critérios para avançar.",
  },
  {
    question: "Como funciona o cálculo de comissão e repasse de professores?",
    answer:
      "Você configura a regra de remuneração de cada instrutor (valor por aula ministrada, percentual por aluno ou valor fixo mensal). O sistema consolida as aulas dadas no mês e gera o fechamento financeiro pronto para quitação em 1 clique.",
  },
  {
    question: "Preciso cadastrar cartão de crédito para criar minha conta?",
    answer:
      "Não! Você cria sua conta em menos de 30 segundos apenas com seu nome e e-mail. Não solicitamos dados de cartão de crédito nem geramos nenhuma cobrança automática.",
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className="py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
        <ScrollReveal direction="up" distancePx={16} durationMs={450}>
          <div className="text-center space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Tire suas dúvidas
            </span>
            <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground">
              Perguntas Frequentes sobre o GestaraHub
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Tudo o que você precisa saber sobre a gestão das suas aulas antes de começar.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" distancePx={20} durationMs={500} delayMs={100}>
          <Accordion type="single" collapsible className="space-y-3">
            {FAQS.map((faq, idx) => (
              <AccordionItem
                key={idx}
                value={`faq-${idx}`}
                className="rounded-xl border border-border/80 bg-card px-5 border-b-border hover:border-primary/30 transition-colors"
              >
                <AccordionTrigger className="py-4 text-left text-sm font-semibold hover:no-underline text-foreground cursor-pointer">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollReveal>
      </div>
    </section>
  );
}
