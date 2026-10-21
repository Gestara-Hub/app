"use client";

import { HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const FAQS = [
  {
    q: "Posso mudar de plano ou cancelar a qualquer momento?",
    a: "Sim! Não há nenhuma cláusula de fidelidade ou multa rescisória. Você pode fazer upgrade para o Profissional ou voltar ao Grátis quando quiser com apenas um clique.",
  },
  {
    q: "Como funciona a economia da taxa Pix no Plano Profissional?",
    a: "No plano Grátis, a taxa de intermediação por Pix pago é de R$ 1,99. Ao assinar o plano Profissional, essa taxa é reduzida para R$ 1,29. Se a sua academia recebe 115 mensalidades por mês via Pix, a economia de taxas de R$ 80,50 já paga integralmente a mensalidade de R$ 79,90 do plano Profissional! No plano anual (R$ 58,25/mês), apenas 84 alunos pagando por Pix já cobrem todo o custo do sistema.",
  },
  {
    q: "O plano Grátis exige cartão de crédito ou tem prazo de validade?",
    a: "Não! O plano Grátis do GestaraHub é gratuito de verdade, sem pegadinhas. Você pode cadastrar quantos alunos, turmas e professores quiser, fazer chamadas e controlar seu caixa sem pagar mensalidade.",
  },
  {
    q: "O que acontece com meus dados se eu fizer downgrade para o Grátis?",
    a: "Todos os seus cadastros, turmas, cobranças e históricos financeiros continuam 100% seguros e preservados. Apenas os recursos exclusivos do Profissional (como automações e relatórios de DRE) ficam em pausa até você reativar o Profissional.",
  },
  {
    q: "Como funciona o repasse de taxa ao aluno?",
    a: "Tanto no plano Grátis quanto no Profissional, você pode ativar a opção 'Repassar taxa ao aluno'. O sistema calcula e inclui o acréscimo no valor do QR Code ou link, garantindo que você receba o valor integral da mensalidade (custo zero de processamento para você).",
  },
];

export function PlansFaq() {
  return (
    <div className="space-y-6 pt-4 border-t border-border/50">
      <div className="text-center space-y-1">
        <Badge variant="outline" className="text-xs font-medium text-primary border-primary/20">
          Dúvidas Frequentes
        </Badge>
        <h3 className="text-xl font-bold text-foreground">
          Perguntas Frequentes sobre os Planos
        </h3>
        <p className="text-xs text-muted-foreground">
          Transparência total para você tomar a melhor decisão.
        </p>
      </div>

      <div className="mx-auto max-w-3xl grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FAQS.map((item) => (
          <div
            key={item.q}
            className="rounded-xl border border-border/70 bg-card p-4 space-y-1.5 shadow-2xs hover:border-primary/30 transition-colors"
          >
            <p className="flex items-start gap-2 text-xs font-bold text-foreground">
              <HelpCircle className="size-4 shrink-0 text-primary mt-0.5" />
              <span>{item.q}</span>
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed pl-6">
              {item.a}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
