"use client";

import {
  ArrowRight,
  Award,
  BarChart3,
  Building2,
  Check,
  CreditCard,
  Crown,
  Globe,
  MessageSquare,
  Percent,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";
import type { SubscriptionTier } from "@gestarahub/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProposalProps {
  interval: "monthly" | "yearly";
  currentTier: SubscriptionTier;
  onSelectTier: (tier: SubscriptionTier) => void;
  isPending: boolean;
}

export function ProposalBento({
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
          "flex flex-col justify-between rounded-3xl border transition-all duration-200 bg-card/60 backdrop-blur-xs shadow-xs p-1",
          currentTier === "free"
            ? "border-primary/50 ring-1 ring-primary/20"
            : "border-border/70 hover:border-border",
        )}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Começo com Custo Zero
            </span>
            {currentTier === "free" ? (
              <Badge variant="secondary" className="text-[10px] font-bold">
                Plano Atual
              </Badge>
            ) : null}
          </div>

          <div>
            <h3 className="text-2xl font-black text-foreground">Grátis</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ideal para quem está abrindo o espaço ou quer operar sem despesas fixas.
            </p>
          </div>

          {/* Preço */}
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-3.5">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-foreground">R$ 0</span>
              <span className="text-xs text-muted-foreground font-semibold">/ mês</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Sem limite de alunos · Grátis para sempre
            </p>
          </div>

          {/* Bento Hero Feature */}
          <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-muted/50 to-muted/10 p-3.5 space-y-1.5">
            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Users className="size-4 text-primary" />
              <span>Operação Completa & Ilimitada</span>
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Cadastre quantos alunos, turmas e professores quiser. Chamada rápida com áudio no celular.
            </p>
          </div>

          {/* Grid de Chips 2x2 */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card p-2.5">
              <Smartphone className="size-4 text-emerald-500 shrink-0" />
              <span className="font-medium text-foreground text-[11px]">App Aluno/Prof</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card p-2.5">
              <CreditCard className="size-4 text-emerald-500 shrink-0" />
              <span className="font-medium text-foreground text-[11px]">Pix a R$ 1,99</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card p-2.5">
              <Check className="size-4 text-emerald-500 shrink-0" />
              <span className="font-medium text-foreground text-[11px]">Repasse Aluno</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card p-2.5">
              <Check className="size-4 text-emerald-500 shrink-0" />
              <span className="font-medium text-foreground text-[11px]">Fluxo de Caixa</span>
            </div>
          </div>
        </div>

        <div className="p-5 pt-0">
          <Button
            variant={currentTier === "free" ? "outline" : "secondary"}
            className="w-full h-10 text-xs font-bold rounded-xl"
            disabled={currentTier === "free" || isPending}
            onClick={() => onSelectTier("free")}
          >
            {currentTier === "free" ? "Plano Atual" : "Voltar ao Grátis"}
          </Button>
        </div>
      </Card>

      {/* 2. PLANO PROFISSIONAL (BENTO HERO) */}
      <Card
        className={cn(
          "flex flex-col justify-between rounded-3xl border-2 transition-all duration-200 relative bg-card shadow-lg p-1",
          "border-primary ring-4 ring-primary/10",
        )}
      >
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1 text-[11px] font-extrabold text-primary-foreground shadow-md">
            <Sparkles className="size-3" />
            Mais Escolhido
          </span>
        </div>

        <div className="p-5 space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              O Motor de Crescimento
            </span>
            {currentTier === "pro" ? (
              <Badge variant="secondary" className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                Plano Atual
              </Badge>
            ) : null}
          </div>

          <div>
            <h3 className="text-2xl font-black text-foreground">Profissional</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Para espaços que querem automatizar cobranças, fidelizar alunos e economizar.
            </p>
          </div>

          {/* Preço com Economia */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-foreground">
                {interval === "monthly" ? "R$ 79,90" : "R$ 58,25"}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">/ mês</span>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              {interval === "monthly"
                ? "Cobrança mensal sem fidelidade"
                : "2 meses grátis (R$ 799/ano à vista)"}
            </p>
          </div>

          {/* Bento Hero Box 1: Economia no Pix */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <Percent className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>Taxa Pix Reduzida: R$ 1,29</span>
              </span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black text-emerald-600 dark:text-emerald-400">
                -35% OFF
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Com apenas 84 Pix recebidos no mês, a economia de taxas cobre 100% da assinatura do Pro.
            </p>
          </div>

          {/* Bento Hero Box 2: WhatsApp Piloto Automático */}
          <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-transparent p-3.5 space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <MessageSquare className="size-4 text-primary" />
              <span>WhatsApp 100% Automático</span>
            </span>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Lembretes antes do vencimento, aviso de confirmação e mensagens sem você tocar no celular.
            </p>
          </div>

          {/* Grid de Chips 2x2 dos Recursos Extras */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-2.5">
              <Smartphone className="size-4 text-primary shrink-0" />
              <span className="font-semibold text-foreground text-[11px]">Pagamento 1 toque</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-2.5">
              <BarChart3 className="size-4 text-primary shrink-0" />
              <span className="font-semibold text-foreground text-[11px]">DRE Gerencial</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-2.5">
              <Award className="size-4 text-primary shrink-0" />
              <span className="font-semibold text-foreground text-[11px]">Certificados QR</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-2.5">
              <Users className="size-4 text-primary shrink-0" />
              <span className="font-semibold text-foreground text-[11px]">Radar de Evasão</span>
            </div>
          </div>
        </div>

        <div className="p-5 pt-0">
          <Button
            variant={currentTier === "pro" ? "outline" : "default"}
            className={cn(
              "w-full h-11 text-xs font-extrabold gap-2 rounded-xl shadow-md",
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
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* 3. PLANO EXPANSÃO (BENTO SCALE) */}
      <Card
        className={cn(
          "flex flex-col justify-between rounded-3xl border transition-all duration-200 bg-card/60 backdrop-blur-xs shadow-xs p-1",
          currentTier === "scale"
            ? "border-indigo-500/60 ring-2 ring-indigo-500/20"
            : "border-border/70 hover:border-border",
        )}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Redes & Presença Digital
            </span>
            {currentTier === "scale" ? (
              <Badge variant="secondary" className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20">
                Plano Atual
              </Badge>
            ) : null}
          </div>

          <div>
            <h3 className="text-2xl font-black text-foreground flex items-center gap-2">
              <span>Expansão</span>
              <Crown className="size-4 text-indigo-500" />
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Para quem opera filiais ou quer captar alunos pela internet com site próprio.
            </p>
          </div>

          {/* Preço */}
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-3.5">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-foreground">
                {interval === "monthly" ? "R$ 199,00" : "R$ 149,17"}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">/ mês</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {interval === "monthly"
                ? "Cobrança mensal sem fidelidade"
                : "Economize R$ 598 (R$ 1.790/ano à vista)"}
            </p>
          </div>

          {/* Bento Hero Box 1: Página Web Dedicada */}
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/15 via-indigo-500/5 to-transparent p-3.5 space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-300">
              <Globe className="size-4 text-indigo-500" />
              <span>Página Web Exclusiva (Link na Bio)</span>
            </span>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Sua academia com site oficial, fotos, grade de horários e matrícula online com fechamento direto.
            </p>
          </div>

          {/* Bento Hero Box 2: Multiunidades */}
          <div className="rounded-2xl border border-indigo-500/20 bg-muted/20 p-3.5 space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Building2 className="size-4 text-indigo-500" />
              <span>Multiunidades Ilimitadas</span>
            </span>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Gerencie matriz e filiais no mesmo painel com consolidação financeira e passe livre para alunos.
            </p>
          </div>

          {/* Grid de Chips 2x2 */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card p-2.5">
              <Check className="size-4 text-indigo-500 shrink-0" />
              <span className="font-medium text-foreground text-[11px]">Passe Livre Rede</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card p-2.5">
              <Check className="size-4 text-indigo-500 shrink-0" />
              <span className="font-medium text-foreground text-[11px]">BI Preditivo</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card p-2.5">
              <Check className="size-4 text-indigo-500 shrink-0" />
              <span className="font-medium text-foreground text-[11px]">Catracas & API</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card p-2.5">
              <Check className="size-4 text-indigo-500 shrink-0" />
              <span className="font-medium text-foreground text-[11px]">Taxas Negociadas</span>
            </div>
          </div>
        </div>

        <div className="p-5 pt-0">
          <Button
            variant={currentTier === "scale" ? "outline" : "secondary"}
            className="w-full h-10 text-xs font-bold rounded-xl"
            disabled={currentTier === "scale" || isPending}
            onClick={() => onSelectTier("scale")}
          >
            {currentTier === "scale" ? "Plano Atual" : "Ativar Plano Expansão"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
