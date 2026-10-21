"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Crown,
  Sparkles,
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

export function ProposalAccordion({
  interval,
  currentTier,
  onSelectTier,
  isPending,
}: ProposalProps) {
  // Estado para controlar expansão individual de cada card
  const [expanded, setExpanded] = useState<Record<SubscriptionTier, boolean>>({
    free: false,
    pro: false,
    scale: false,
  });

  const toggle = (tier: SubscriptionTier) => {
    setExpanded((prev) => ({ ...prev, [tier]: !prev[tier] }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start max-w-6xl mx-auto">
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
          <CardHeader className="pb-3">
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
            <p className="text-xs text-muted-foreground">
              O essencial para operar sem mensalidade.
            </p>

            <div className="pt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">R$ 0</span>
                <span className="text-xs text-muted-foreground font-medium">/ mês</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-0.5">
                Grátis para sempre · Sem cartão
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-1 text-xs">
            {/* 3 Recursos Principais */}
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-emerald-500" />
                <span className="text-foreground font-semibold">Alunos e turmas ilimitados</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-emerald-500" />
                <span>Chamada no celular com áudio</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-emerald-500" />
                <span>Pix online integrado (R$ 1,99 por Pix)</span>
              </li>
            </ul>

            {/* Expansão Inline */}
            {expanded.free && (
              <div className="pt-2 border-t border-border/50 space-y-2 animate-in fade-in-50 duration-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Mais recursos inclusos:
                </p>
                <ul className="space-y-1.5 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-emerald-500 shrink-0" />
                    <span>App do Aluno (frequência e faixas)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-emerald-500 shrink-0" />
                    <span>App do Professor no tatame</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-emerald-500 shrink-0" />
                    <span>Trilha de graduação e graus</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-emerald-500 shrink-0" />
                    <span>Controle de fluxo de caixa</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-emerald-500 shrink-0" />
                    <span>Opção de repasse de taxas ao aluno</span>
                  </li>
                </ul>
              </div>
            )}

            {/* Gatilho Ver mais / Ver menos */}
            <button
              type="button"
              onClick={() => toggle("free")}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline pt-1 cursor-pointer"
            >
              <span>{expanded.free ? "Recolher detalhes" : "Ver mais 5 recursos"}</span>
              {expanded.free ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
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
          <CardHeader className="pb-3 pt-6">
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
            <p className="text-xs text-muted-foreground">
              Zere a inadimplência e automatize suas cobranças.
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
                  ? "Sem fidelidade"
                  : "R$ 799/ano à vista (2 meses grátis)"}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-1 text-xs">
            {/* 3 Recursos Principais */}
            <ul className="space-y-2 text-foreground/90">
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-primary" />
                <span>
                  <strong>Taxa Pix: R$ 1,29</strong>{" "}
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">(-35% OFF)</span>
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-primary" />
                <span><strong>WhatsApp 100% Automático</strong> (zero clique)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-primary" />
                <span><strong>Portal do Aluno:</strong> pagamento em 1 clique e reservas</span>
              </li>
            </ul>

            {/* Expansão Inline */}
            {expanded.pro && (
              <div className="pt-2 border-t border-border/50 space-y-2 animate-in fade-in-50 duration-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Mais recursos inclusos no Pro:
                </p>
                <ul className="space-y-1.5 text-foreground/90">
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-primary shrink-0" />
                    <span>Portal do Professor (avaliações e extrato)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-primary shrink-0" />
                    <span>DRE Gerencial Completa (lucro real)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-primary shrink-0" />
                    <span>Taxa de retenção e radar de evasão</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-primary shrink-0" />
                    <span>Certificados de Conclusão em PDF com QR</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-primary shrink-0" />
                    <span>Lembretes e avisos automáticos</span>
                  </li>
                </ul>
              </div>
            )}

            {/* Gatilho Ver mais / Ver menos */}
            <button
              type="button"
              onClick={() => toggle("pro")}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline pt-1 cursor-pointer"
            >
              <span>{expanded.pro ? "Recolher detalhes" : "Ver mais 5 recursos no Pro"}</span>
              {expanded.pro ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
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
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Redes & Presença
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
              Para redes com filiais e captação online.
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
                  : "R$ 1.790/ano à vista (Economize R$ 598)"}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-1 text-xs">
            {/* 3 Recursos Principais */}
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-indigo-500" />
                <span className="text-foreground font-semibold">Página web exclusiva (Link na Bio)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-indigo-500" />
                <span>Multiunidades ilimitadas em 1 login</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-indigo-500" />
                <span>Passe livre do aluno em todas as filiais</span>
              </li>
            </ul>

            {/* Expansão Inline */}
            {expanded.scale && (
              <div className="pt-2 border-t border-border/50 space-y-2 animate-in fade-in-50 duration-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Mais recursos na Expansão:
                </p>
                <ul className="space-y-1.5 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-indigo-500 shrink-0" />
                    <span>BI de ocupação e mapas de calor</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-indigo-500 shrink-0" />
                    <span>Inteligência preditiva de evasão</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-indigo-500 shrink-0" />
                    <span>Taxas negociadas de gateway</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-indigo-500 shrink-0" />
                    <span>Integração com catracas físicas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-indigo-500 shrink-0" />
                    <span>API para alto volume</span>
                  </li>
                </ul>
              </div>
            )}

            {/* Gatilho Ver mais / Ver menos */}
            <button
              type="button"
              onClick={() => toggle("scale")}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline pt-1 cursor-pointer"
            >
              <span>{expanded.scale ? "Recolher detalhes" : "Ver mais 5 recursos"}</span>
              {expanded.scale ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
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
