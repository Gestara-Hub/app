"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    question: "O GestaraHub é realmente gratuito? Tem limite de alunos ou turmas?",
    answer:
      "Sim! Toda a gestão operacional de turmas — cadastro ilimitado de alunos, criação de turmas, grade semanal, chamada digital, esteira de graduação e controle de mensalidades — é 100% gratuita para sempre. Sua academia pode crescer de 20 para 300 alunos sem pagar nada e sem pegadinhas.",
  },
  {
    question: "O professor consegue fazer a lista de chamada pelo celular no tatame?",
    answer:
      "Sim! O GestaraHub é 100% otimizado para celulares e tablets. O professor abre a turma do horário, registra as presenças com apenas 1 toque, marca faltas e adiciona reposições ou alunos de aula experimental na hora, em poucos segundos.",
  },
  {
    question: "Como funciona o controle de faixas e graduação dos alunos?",
    answer:
      "Você cadastra a esteira de faixas da sua modalidade (cores, pontas e graus) e define os critérios mínimos (tempo de carência ou número de presenças). O sistema contabiliza as aulas assistidas pelo aluno e avisa automaticamente quando ele está apto ao próximo exame.",
  },
  {
    question: "Consigo controlar reposições de aulas e alunos em aula experimental?",
    answer:
      "Com certeza. O sistema permite agendar reposições respeitando o limite máximo de vagas do horário e identificar alunos em primeira aula experimental, sem desorganizar a contagem regular da turma.",
  },
  {
    question: "Como funciona o cálculo de comissão e repasse de professores?",
    answer:
      "Você configura a regra de remuneração de cada instrutor (valor por aula ministrada, percentual por aluno ou valor fixo mensal). O sistema consolida as aulas dadas no mês e gera o fechamento financeiro pronto para quitação.",
  },
  {
    question: "Preciso cadastrar cartão de crédito para criar minha conta?",
    answer:
      "Não! Você cria sua conta em menos de 2 minutos apenas com seu e-mail. Não solicitamos dados de cartão de crédito nem geramos nenhuma cobrança automática.",
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className="py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4 mb-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Tire suas dúvidas
          </span>
          <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground">
            Perguntas Frequentes sobre o GestaraHub
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Tudo o que você precisa saber sobre a gestão das suas turmas antes de começar.
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {FAQS.map((faq, idx) => (
            <AccordionItem
              key={idx}
              value={`faq-${idx}`}
              className="rounded-xl border border-border/80 bg-card px-5 border-b-border"
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
      </div>
    </section>
  );
}
