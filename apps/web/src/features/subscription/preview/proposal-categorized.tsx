"use client";

import { ArrowRight, Check, Crown, MessageSquare, QrCode, Sparkles, Users } from "lucide-react";
import type { SubscriptionTier } from "@gestarahub/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProposalProps {
  interval: "monthly" | "yearly";
  currentTier: SubscriptionTier;
  onSelectTier: (tier: SubscriptionTier) => void;
  isPending: boolean;
}

export function ProposalCategorized({
  interval,
  currentTier,
  onSelectTier,
  isPending,
}: ProposalProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch max-w-6xl mx-auto">
      {/* 1. PLANO GRÁTIS */}
      <Card
        className={cn(
          "flex flex-col justify-between rounded-2xl border transition-all duration-200 bg-card shadow-xs",
          currentTier === "free"
            ? "border-primary/50 ring-1 ring-primary/20"
            : "border-border/70 hover:border-border",
        )}
      >
        <div>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Base Operacional
              </span>
              {currentTier === "free" ? (
                <Badge variant="secondary" className="text-[10px] font-bold">
                  Plano Atual
                </Badge>
              ) : null}
            </div>
            <CardTitle className="text-2xl font-bold">Grátis</CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tudo o que seu espaço precisa para o dia a dia, sem mensalidade fixa para sempre.
            </p>

            <div className="pt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">R$ 0</span>
                <span className="text-xs text-muted-foreground font-medium">/ mês</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-0.5">
                Sem cartão de crédito · Ilimitado
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-2 text-xs">
            {/* Bloco 1: Alunos & Tatame */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
              <p className="flex items-center gap-1.5 font-bold text-foreground text-[11px] uppercase tracking-wider">
                <Users className="size-3.5 text-primary" />
                <span>Operação & Alunos</span>
              </p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-500 shrink-0" />
                  <span>Alunos e turmas ilimitados</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-500 shrink-0" />
                  <span>Chamada no celular com áudio e fotos</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-500 shrink-0" />
                  <span>Trilha de graduação e faixas</span>
                </li>
              </ul>
            </div>

            {/* Bloco 2: Financeiro */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
              <p className="flex items-center gap-1.5 font-bold text-foreground text-[11px] uppercase tracking-wider">
                <QrCode className="size-3.5 text-primary" />
                <span>Cobranças & Caixa</span>
              </p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-500 shrink-0" />
                  <span>Pix online integrado (R$ 1,99 por Pix)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-500 shrink-0" />
                  <span>Opção de repasse de taxas ao aluno</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-500 shrink-0" />
                  <span>Controle de fluxo de caixa e repasses</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </div>

        <CardFooter className="pt-2">
          <Button
            variant={currentTier === "free" ? "outline" : "secondary"}
            className="w-full text-xs font-semibold"
            disabled={currentTier === "free" || isPending}
            onClick={() => onSelectTier("free")}
          >
            {currentTier === "free" ? "Plano Atual" : "Voltar ao Grátis"}
          </Button>
        </CardFooter>
      </Card>

      {/* 2. PLANO PROFISSIONAL (DESTAQUE) */}
      <Card
        className={cn(
          "flex flex-col justify-between rounded-2xl border-2 transition-all duration-200 relative bg-card shadow-md",
          "border-primary ring-2 ring-primary/20",
        )}
      >
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-sm">
            <Sparkles className="size-3" />
            Mais Escolhido
          </span>
        </div>

        <div>
          <CardHeader className="pb-4 pt-6">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Automação & Escala
              </span>
              {currentTier === "pro" ? (
                <Badge variant="secondary" className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                  Plano Atual
                </Badge>
              ) : null}
            </div>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <span>Profissional</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Zere a inadimplência com robô no WhatsApp e economize dezenas de horas por mês.
            </p>

            <div className="pt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">
                  {interval === "monthly" ? "R$ 79,90" : "R$ 58,25"}
                </span>
                <span className="text-xs text-muted-foreground font-medium">/ mês</span>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-0.5">
                {interval === "monthly"
                  ? "Faturamento mensal sem fidelidade"
                  : "Faturado anualmente (R$ 799/ano · 2 meses grátis)"}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-2 text-xs">
            {/* Super Destaque 1: Economia Pix */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                  ⚡ Taxa Pix Reduzida: R$ 1,29
                </span>
                <Badge variant="outline" className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                  -35% no Pix
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Com 84 mensalidades no Pix/mês, a economia cobre 100% da assinatura.
              </p>
            </div>

            {/* Super Destaque 2: WhatsApp Piloto Automático */}
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-foreground text-xs">
                <MessageSquare className="size-3.5 text-primary" />
                <span>WhatsApp 100% Automático</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Lembretes antes do vencimento, aviso de pagamento e parabéns sem você clicar em nada.
              </p>
            </div>

            {/* Bloco de Recursos de Gestão e Aluno */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
              <p className="font-bold text-foreground text-[11px] uppercase tracking-wider">
                Recursos Inclusos no Pro
              </p>
              <ul className="space-y-1.5 text-foreground/90">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-primary shrink-0" />
                  <span><strong>Portal do Aluno:</strong> pagamento em 1 clique e reservas</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-primary shrink-0" />
                  <span><strong>Portal do Professor:</strong> avaliações e extrato de aulas</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-primary shrink-0" />
                  <span><strong>DRE Gerencial Completa</strong> (lucro líquido real)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-primary shrink-0" />
                  <span><strong>Taxa de Retenção e Churn</strong> de alunos</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-primary shrink-0" />
                  <span><strong>Certificados em PDF oficial</strong> com QR Code</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </div>

        <CardFooter className="pt-2">
          <Button
            variant={currentTier === "pro" ? "outline" : "default"}
            className={cn(
              "w-full text-xs font-bold gap-1.5 shadow-sm",
              currentTier !== "pro" && "bg-primary hover:bg-primary/90",
            )}
            disabled={currentTier === "pro" || isPending}
            onClick={() => onSelectTier("pro")}
          >
            {currentTier === "pro" ? (
              "Plano Atual"
            ) : (
              <>
                <span>Ativar Plano Profissional</span>
                <ArrowRight className="size-3.5" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* 3. PLANO EXPANSÃO */}
      <Card
        className={cn(
          "flex flex-col justify-between rounded-2xl border transition-all duration-200 bg-card shadow-xs",
          currentTier === "scale"
            ? "border-indigo-500/60 ring-1 ring-indigo-500/20"
            : "border-border/70 hover:border-border",
        )}
      >
        <div>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Franquias & Redes
              </span>
              {currentTier === "scale" ? (
                <Badge variant="secondary" className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20">
                  Plano Atual
                </Badge>
              ) : null}
            </div>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <span>Expansão</span>
              <Crown className="size-4 text-indigo-500" />
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Para espaços com filiais que exigem controle unificado e presença digital própria.
            </p>

            <div className="pt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">
                  {interval === "monthly" ? "R$ 199,00" : "R$ 149,17"}
                </span>
                <span className="text-xs text-muted-foreground font-medium">/ mês</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-0.5">
                {interval === "monthly"
                  ? "Faturamento mensal sem fidelidade"
                  : "Faturado anualmente (R$ 1.790/ano · Economize R$ 598)"}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-2 text-xs">
            {/* Destaque 1: Página Web */}
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                <span>🌐 Página Web Exclusiva (Link na Bio)</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Sua academia com site oficial, fotos, grade de horários e matrícula online direta pelo Instagram.
              </p>
            </div>

            {/* Destaque 2: Multiunidades */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
              <p className="font-bold text-foreground text-[11px] uppercase tracking-wider">
                Estrutura para Redes
              </p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-500 shrink-0" />
                  <span><strong>Multiunidades ilimitadas</strong> em um único login</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-500 shrink-0" />
                  <span><strong>Passe livre do aluno</strong> em qualquer filial da rede</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-500 shrink-0" />
                  <span>Taxas de gateway customizadas para alto volume</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-500 shrink-0" />
                  <span>BI de ocupação e inteligência preditiva de churn</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-500 shrink-0" />
                  <span>Integração de catracas e API dedicada</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </div>

        <CardFooter className="pt-2">
          <Button
            variant={currentTier === "scale" ? "outline" : "secondary"}
            className="w-full text-xs font-semibold"
            disabled={currentTier === "scale" || isPending}
            onClick={() => onSelectTier("scale")}
          >
            {currentTier === "scale" ? "Plano Atual" : "Ativar Plano Expansão"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
