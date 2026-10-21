"use client";

import {
  ArrowRight,
  Briefcase,
  Crown,
  DollarSign,
  GraduationCap,
  Sparkles,
  TrendingUp,
  UserCheck,
} from "lucide-react";
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

export function ProposalRoi({
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
                Custo Zero
              </span>
              {currentTier === "free" ? (
                <Badge variant="secondary" className="text-[10px] font-bold">
                  Plano Atual
                </Badge>
              ) : null}
            </div>
            <CardTitle className="text-2xl font-bold">Grátis</CardTitle>
            <p className="text-xs text-muted-foreground">
              Ideal para quem está no início e precisa de controle básico sem arriscar capital.
            </p>

            <div className="pt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">R$ 0</span>
                <span className="text-xs text-muted-foreground font-medium">/ mês</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-0.5">
                Sem surpresas · Ilimitado
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-2 text-xs">
            {/* Impacto por Papel */}
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-2.5">
                <GraduationCap className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-foreground text-[11px]">Seu Aluno</p>
                  <p className="text-[11px] text-muted-foreground">
                    Acompanha faltas, presenças, faixas e faturas pelo celular.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-2.5">
                <UserCheck className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-foreground text-[11px]">Seu Professor</p>
                  <p className="text-[11px] text-muted-foreground">
                    Faz a chamada com áudio pelo celular em segundos.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-2.5">
                <Briefcase className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-foreground text-[11px]">Você (Dono)</p>
                  <p className="text-[11px] text-muted-foreground">
                    Fluxo de caixa básico, cálculo de repasse e Pix online a R$ 1,99.
                  </p>
                </div>
              </div>
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

      {/* 2. PLANO PROFISSIONAL (DESTAQUE ROI) */}
      <Card
        className={cn(
          "flex flex-col justify-between rounded-2xl border-2 transition-all duration-200 relative bg-card shadow-md",
          "border-primary ring-2 ring-primary/20",
        )}
      >
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-sm">
            <Sparkles className="size-3" />
            Melhor Custo-Benefício
          </span>
        </div>

        <div>
          <CardHeader className="pb-4 pt-6">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Mais Tempo & Menos Perdas
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
            <p className="text-xs text-muted-foreground">
              Zera a inadimplência com automação e se paga sozinho com a economia de taxas.
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
                  ? "Sem fidelidade ou multa"
                  : "R$ 799/ano à vista (2 meses grátis)"}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-2 text-xs">
            {/* Box de Retorno Financeiro Garantido */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300 text-xs">
                <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>O Plano que se Paga Sozinho</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Recebendo 84 cobranças Pix/mês com a taxa reduzida de R$ 1,29, você economiza R$ 58,80 — cobrindo o custo da anuidade integralmente.
              </p>
            </div>

            {/* Impacto por Papel */}
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-2.5">
                <GraduationCap className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-foreground text-[11px]">Seu Aluno</p>
                  <p className="text-[11px] text-muted-foreground">
                    Paga em 1 toque no app (Pix e Cartão), reserva vagas e emite certificados.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-2.5">
                <UserCheck className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-foreground text-[11px]">Seu Professor</p>
                  <p className="text-[11px] text-muted-foreground">
                    Lança notas no celular, indica graduações e confere extrato de repasses.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-2.5">
                <Briefcase className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-foreground text-[11px]">Você (Dono)</p>
                  <p className="text-[11px] text-muted-foreground">
                    WhatsApp cobra clientes no automático, DRE gerencial e radar de evasão.
                  </p>
                </div>
              </div>
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
                Captação & Multiunidades
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
            <p className="text-xs text-muted-foreground">
              Para negócios com filiais ou que querem captar alunos pela internet de forma automática.
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
                  ? "Sem fidelidade"
                  : "R$ 1.790/ano à vista (Economia de R$ 598)"}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-2 text-xs">
            {/* Box de Retorno de Captação */}
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-300 text-xs">
                <DollarSign className="size-4 text-indigo-500" />
                <span>Novas Matrículas pela Web</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Sua página oficial na bio do Instagram converte visitantes em matrículas pagas direto no Pix, sem intermediação manual.
              </p>
            </div>

            {/* Impacto por Papel */}
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-2.5">
                <GraduationCap className="size-4 text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-foreground text-[11px]">Seu Aluno</p>
                  <p className="text-[11px] text-muted-foreground">
                    Treina em qualquer filial da sua rede com o mesmo cadastro.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-2.5">
                <UserCheck className="size-4 text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-foreground text-[11px]">Seu Professor</p>
                  <p className="text-[11px] text-muted-foreground">
                    Atuação unificada entre filiais com registro centralizado.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-2.5">
                <Briefcase className="size-4 text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-foreground text-[11px]">Você (Dono)</p>
                  <p className="text-[11px] text-muted-foreground">
                    Multiunidades ilimitadas, taxas negociadas e BI de ocupação.
                  </p>
                </div>
              </div>
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
