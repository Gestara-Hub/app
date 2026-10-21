"use client";

import { Check, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MatrixCategory {
  title: string;
  rows: {
    feature: string;
    description?: string;
    free: boolean | string;
    pro: boolean | string;
    scale: boolean | string;
  }[];
}

const MATRIX_CATEGORIES: MatrixCategory[] = [
  {
    title: "Operação e Gestão de Alunos",
    rows: [
      {
        feature: "Alunos e Matrículas",
        description: "Cadastro completo com dados médicos e responsáveis",
        free: "Ilimitado",
        pro: "Ilimitado",
        scale: "Ilimitado",
      },
      {
        feature: "Grade de Aulas e Turmas",
        description: "Controle por modalidades, salas e níveis",
        free: "Ilimitado",
        pro: "Ilimitado",
        scale: "Ilimitado",
      },
      {
        feature: "Lista de Presença no Celular",
        description: "Chamada rápida em tempo real para os professores",
        free: true,
        pro: true,
        scale: true,
      },
      {
        feature: "Graduação e Faixas",
        description: "Histórico e trilha de evolução do aluno",
        free: true,
        pro: true,
        scale: true,
      },
      {
        feature: "App e Portal do Aluno",
        description: "Frequência, evolução, pagamentos e reservas",
        free: "Básico (Histórico)",
        pro: "Pagamento em 1 toque & Reservas",
        scale: "Passe Livre na Rede",
      },
      {
        feature: "App do Professor no Tatame",
        description: "Chamada, notas, graduações e controle de repasses",
        free: "Chamada e Turmas",
        pro: "Avaliações & Extrato de Aulas",
        scale: "Multiunidades Unificado",
      },
    ],
  },
  {
    title: "Cobranças Online e Pagamentos",
    rows: [
      {
        feature: "Pix Dinâmico com QR Code",
        description: "Disponibilidade imediata (D+0) na conta bancária",
        free: true,
        pro: true,
        scale: true,
      },
      {
        feature: "Taxa por Cobrança Pix",
        description: "Sem mensalidade de gateway: só paga quando o aluno pagar",
        free: "R$ 1,99",
        pro: "R$ 1,29 (Economia de 35%)",
        scale: "R$ 1,29 ou Negociada",
      },
      {
        feature: "Link de Cartão de Crédito",
        description: "Recebimento no crédito com antecipação",
        free: true,
        pro: true,
        scale: true,
      },
      {
        feature: "Pix Automático no Vencimento",
        description: "Débito direto autorizado pelo aluno",
        free: true,
        pro: true,
        scale: true,
      },
      {
        feature: "Repasse de Taxa ao Aluno",
        description: "Opção de custo zero real para a sua academia",
        free: true,
        pro: true,
        scale: true,
      },
      {
        feature: "Baixa e Conciliação Automática",
        description: "O sistema confere o pagamento e dá baixa sozinho",
        free: true,
        pro: true,
        scale: true,
      },
    ],
  },
  {
    title: "Comunicação e Automações WhatsApp",
    rows: [
      {
        feature: "Envio Manual pelo WhatsApp",
        description: "Abre o app e envia mensagens prontas com 1 clique",
        free: true,
        pro: true,
        scale: true,
      },
      {
        feature: "Lembretes Automáticos no Vencimento",
        description: "Robô dispara lembretes antes e no dia do vencimento",
        free: false,
        pro: true,
        scale: true,
      },
      {
        feature: "Confirmação Automática de Pagamento",
        description: "Avisa o aluno e envia recibo assim que liquidado",
        free: false,
        pro: true,
        scale: true,
      },
      {
        feature: "API Dedicada e Tráfego em Escala",
        description: "Para grandes volumes com linha corporativa",
        free: false,
        pro: false,
        scale: true,
      },
    ],
  },
  {
    title: "Financeiro e Relatórios Gerenciais",
    rows: [
      {
        feature: "Livro Caixa e Entradas/Saídas",
        description: "Previsão, controle de caixa e inadimplentes",
        free: true,
        pro: true,
        scale: true,
      },
      {
        feature: "Repasse e Comissão de Professores",
        description: "Cálculo por percentual, valor fixo ou por aluno",
        free: true,
        pro: true,
        scale: true,
      },
      {
        feature: "DRE Gerencial Completa",
        description: "Demonstrativo do resultado do exercício e lucro real",
        free: false,
        pro: true,
        scale: true,
      },
      {
        feature: "Taxa de Retenção e Churn de Alunos",
        description: "Métricas de entrada, saída e fidelização",
        free: false,
        pro: true,
        scale: true,
      },
      {
        feature: "BI e Ocupação Preditiva",
        description: "Modelagem analítica de horários de pico e expansão",
        free: false,
        pro: false,
        scale: true,
      },
    ],
  },
  {
    title: "Certificados e Estrutura",
    rows: [
      {
        feature: "Certificados de Conclusão",
        description: "Emissão oficial em PDF para cursos e workshops",
        free: false,
        pro: true,
        scale: true,
      },
      {
        feature: "Unidades Gerenciadas",
        description: "Filiais e unidades físicas integradas",
        free: "1 Unidade",
        pro: "1 Unidade",
        scale: "Multiunidades",
      },
      {
        feature: "Página Web Comercial (Link na Bio)",
        description: "Presença online própria com grade de horários e matrícula",
        free: false,
        pro: false,
        scale: true,
      },
    ],
  },
];

export function FeatureMatrix() {
  const renderCell = (val: boolean | string) => {
    if (typeof val === "string") {
      return (
        <span className="text-xs font-semibold text-foreground">{val}</span>
      );
    }
    if (val) {
      return (
        <div className="flex items-center justify-center">
          <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center">
        <Minus className="size-4 text-muted-foreground/40" />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <Badge variant="outline" className="text-xs font-medium text-primary border-primary/20">
          Comparação Detalhada
        </Badge>
        <h3 className="text-xl font-bold text-foreground">
          Matriz Completa de Recursos
        </h3>
        <p className="text-xs text-muted-foreground">
          Veja com clareza tudo o que está incluso em cada plano.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="p-4 font-semibold text-foreground w-[40%]">
                Recursos
              </th>
              <th className="p-4 font-bold text-foreground text-center w-[20%]">
                Grátis
              </th>
              <th className="p-4 font-bold text-primary text-center w-[20%] bg-primary/5 border-x border-primary/10">
                Profissional
              </th>
              <th className="p-4 font-bold text-foreground text-center w-[20%]">
                Expansão
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {MATRIX_CATEGORIES.map((cat) => (
              <>
                <tr key={cat.title} className="bg-muted/40 font-semibold text-foreground">
                  <td colSpan={4} className="px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                    {cat.title}
                  </td>
                </tr>
                {cat.rows.map((row) => (
                  <tr key={row.feature} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3.5">
                      <p className="font-medium text-foreground">{row.feature}</p>
                      {row.description ? (
                        <p className="text-[11px] text-muted-foreground">
                          {row.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3.5 text-center">{renderCell(row.free)}</td>
                    <td className="p-3.5 text-center bg-primary/5 border-x border-primary/10">
                      {renderCell(row.pro)}
                    </td>
                    <td className="p-3.5 text-center">{renderCell(row.scale)}</td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
