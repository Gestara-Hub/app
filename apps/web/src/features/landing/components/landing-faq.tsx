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
      "Sim. O dia a dia é grátis, sem limite de alunos ou turmas: grade, chamada, evolução, mensalidades e financeiro básico.",
  },
  {
    question: "Funciona para aulas particulares ou só para turmas?",
    answer:
      "Para os dois. Cada horário tem o limite de vagas que você quiser: 1 aluno na aula particular ou a turma inteira.",
  },
  {
    question: "Serve para aulas de música ou de idiomas?",
    answer:
      "Sim. Organize por níveis ou módulos, em grupo ou 1 a 1, e acompanhe as mensalidades.",
  },
  {
    question: "O professor faz a chamada pelo celular?",
    answer:
      "Sim. Ele abre a aula no celular e marca presença com um toque. Aluno avulso ou experimental entra na hora.",
  },
  {
    question: "Meus professores podem usar?",
    answer:
      "Sim. Cada professor entra pelo mesmo link, com o próprio acesso: vê as turmas e faz a chamada, sem ver o financeiro.",
  },
  {
    question: "Meus alunos precisam baixar algum app?",
    answer: "Não. Os avisos chegam pelo seu WhatsApp, sem instalar nada.",
  },
  {
    question: "Como funciona a evolução dos alunos?",
    answer:
      "Você escolhe a trilha de cada modalidade: faixas, níveis, módulos ou fases. O sistema conta as aulas e avisa quem já pode avançar.",
  },
  {
    question: "Dá para vender curso com valor fechado ou pacote de aulas?",
    answer:
      "Sim. O curso tem valor fechado e pode ser dividido em parcelas. O pacote tem um número de aulas, e a chamada desconta do saldo do aluno.",
  },
  {
    question: "Como funciona o repasse dos professores?",
    answer:
      "Você define a regra de cada professor: valor fixo no mês, por aula dada, por aluno ativo ou percentual do que os alunos pagaram. No fim do mês, o fechamento sai pronto.",
  },
  {
    question: "Preciso cadastrar cartão de crédito?",
    answer:
      "Não. Você cria a conta com nome e e-mail, sem cartão e sem cobrança automática.",
  },
  {
    question: "Como funciona o pagamento online? Tem custo?",
    answer:
      "É opcional, também no plano grátis. Você ativa uma conta de recebimento e gera Pix ou link de cartão em cada cobrança. Quando o aluno paga, a cobrança baixa sozinha. Há uma taxa só quando o aluno paga; sem pagamento, nada é cobrado.",
  },
  {
    question: "Para onde vai o dinheiro?",
    answer:
      "Para a conta de recebimento do seu espaço, aberta em seu nome com um parceiro de pagamentos regulado. Você saca para o seu Pix quando quiser.",
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className="scroll-mt-16 py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
        <ScrollReveal direction="up" distancePx={16} durationMs={450}>
          <div className="text-center space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Tire suas dúvidas
            </span>
            <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground">
              Perguntas frequentes
            </h2>
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
