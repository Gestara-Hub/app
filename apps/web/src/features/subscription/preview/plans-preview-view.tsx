"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  Layers,
  LayoutGrid,
  Maximize2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import type { SubscriptionTier } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { subscriptionTierLabel } from "@/lib/labels";
import { useCan } from "@/features/auth";
import { useSetSubscriptionTier, useSubscription } from "@/features/settings";
import { cn } from "@/lib/utils";
import { ProposalCategorized } from "./proposal-categorized";
import { ProposalBento } from "./proposal-bento";
import { ProposalRoi } from "./proposal-roi";
import { ProposalMinimalModal } from "./proposal-minimal-modal";
import { ProposalAccordion } from "./proposal-accordion";

type ProposalId = "minimal_modal" | "accordion" | "categorized" | "bento" | "roi";

const PROPOSALS = [
  {
    id: "minimal_modal" as ProposalId,
    label: "Proposta 4: Minimalista + Modal 'Ver Mais'",
    description: "Zero fadiga: 4 bullets diretos e botão 'Ver detalhes' que abre modal completa",
    icon: Maximize2,
    badge: "Nova ⭐",
  },
  {
    id: "accordion" as ProposalId,
    label: "Proposta 5: Expansão Inline ('Ver Mais')",
    description: "Card compacto com alternador 'Ver mais ⌄' que desdobra a lista no próprio card",
    icon: ChevronDown,
    badge: "Nova ⭐",
  },
  {
    id: "categorized" as ProposalId,
    label: "Proposta 1: Categorias & Destaques",
    description: "Separação por blocos temáticos (Operação, Cobranças, Gestão) com chips visuais",
    icon: Layers,
  },
  {
    id: "bento" as ProposalId,
    label: "Proposta 2: Bento Grid Moderno",
    description: "Estilo Stripe / Linear com cartões modulares e mini-chips de recursos",
    icon: LayoutGrid,
  },
  {
    id: "roi" as ProposalId,
    label: "Proposta 3: Foco em ROI & Papéis",
    description: "Impacto direto para Aluno, Professor e Dono + cálculo de retorno financeiro",
    icon: TrendingUp,
  },
];

export function PlansPreviewView() {
  const can = useCan();
  const canManage = can("subscription:manage");
  const { data: sub } = useSubscription();
  const setTier = useSetSubscriptionTier();
  const { confirm, dialog } = useConfirmAction();

  const [activeProposal, setActiveProposal] = useState<ProposalId>("minimal_modal");
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  const currentTier = sub?.tier ?? "free";

  const handleSelectTier = async (targetTier: SubscriptionTier) => {
    if (!canManage) {
      toast.error("Apenas o proprietário da organização pode alterar o plano.");
      return;
    }
    if (targetTier === currentTier) return;

    const ok = await confirm({
      title:
        targetTier === "pro"
          ? "Ativar o Plano Profissional?"
          : targetTier === "scale"
            ? "Ativar o Plano Expansão?"
            : "Voltar ao Plano Grátis?",
      description:
        targetTier === "pro"
          ? "Demonstração: libera cobranças online com taxa reduzida (R$ 1,29), lembretes automáticos no WhatsApp, relatórios gerenciais e certificados."
          : targetTier === "scale"
            ? "Demonstração: libera multiunidades, página web dedicada e taxas customizadas."
            : "Os recursos do Profissional/Expansão serão bloqueados. Seus dados cadastrados permanecem 100% seguros.",
      confirmLabel:
        targetTier === "free"
          ? "Voltar ao Grátis"
          : `Ativar Plano ${targetTier === "pro" ? "Profissional" : "Expansão"}`,
      variant: targetTier === "free" ? "destructive" : "default",
    });

    if (!ok) return;

    setTier.mutate(targetTier, {
      onSuccess: () => {
        toast.success(`Plano ${subscriptionTierLabel(targetTier)} ativado com sucesso!`);
      },
      onError: (err) => {
        toast.error(getErrorMessage(err, "Não foi possível atualizar o plano."));
      },
    });
  };

  return (
    <>
      <div className="space-y-8 pb-16">
        {/* Barra Superior de Navegação do Laboratório de Preview */}
        <div className="rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-bold text-primary border-primary/30">
                  Laboratório de Design
                </Badge>
                <span className="text-xs text-muted-foreground">· 5 Propostas de Layout</span>
              </div>
              <h2 className="text-lg font-bold text-foreground">
                Escolha a proposta visual que mais te agrada
              </h2>
              <p className="text-xs text-muted-foreground">
                Clique nas abas abaixo para avaliar versões enxutas (com modal ou expansão) e versões ricas.
              </p>
            </div>

            <Button asChild variant="outline" size="sm" className="gap-1.5 self-start sm:self-center">
              <Link href="/plans">
                <ArrowLeft className="size-3.5" />
                <span>Voltar à tela oficial</span>
              </Link>
            </Button>
          </div>

          {/* Abas das 5 Propostas em Grid Responsivo */}
          <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {PROPOSALS.map((p) => {
              const Icon = p.icon;
              const isCurrent = activeProposal === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveProposal(p.id)}
                  className={cn(
                    "flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer",
                    isCurrent
                      ? "border-primary bg-background shadow-xs ring-1 ring-primary/30"
                      : "border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                      <Icon className={cn("size-3.5", isCurrent ? "text-primary" : "text-muted-foreground")} />
                      <span className="truncate">{p.label.split(":")[0]}</span>
                    </div>
                    {"badge" in p && p.badge ? (
                      <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.2 rounded shrink-0">
                        {p.badge}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[11px] font-semibold text-foreground/80 mt-1 line-clamp-1">
                    {p.label.split(":")[1]?.trim()}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-tight">
                    {p.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Header Comercial da Tela com Toggle Mensal / Anual */}
        <div className="text-center space-y-3 pt-2">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
            Escolha o plano ideal para acelerar seu negócio
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl mx-auto">
            Do controle operacional sem custos fixos à automação total de cobranças por Pix,
            WhatsApp e gestão financeira avançada.
          </p>

          {/* Toggle Mensal / Anual */}
          <div className="flex items-center justify-center pt-2">
            <div className="flex items-center rounded-full border border-border/80 bg-muted/40 p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setInterval("monthly")}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                  interval === "monthly"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setInterval("yearly")}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                  interval === "yearly"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>Anual</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  2 meses grátis
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Renderização da Proposta Ativa */}
        <div className="transition-all duration-300">
          {activeProposal === "minimal_modal" && (
            <ProposalMinimalModal
              interval={interval}
              currentTier={currentTier}
              onSelectTier={handleSelectTier}
              isPending={setTier.isPending}
            />
          )}

          {activeProposal === "accordion" && (
            <ProposalAccordion
              interval={interval}
              currentTier={currentTier}
              onSelectTier={handleSelectTier}
              isPending={setTier.isPending}
            />
          )}

          {activeProposal === "categorized" && (
            <ProposalCategorized
              interval={interval}
              currentTier={currentTier}
              onSelectTier={handleSelectTier}
              isPending={setTier.isPending}
            />
          )}

          {activeProposal === "bento" && (
            <ProposalBento
              interval={interval}
              currentTier={currentTier}
              onSelectTier={handleSelectTier}
              isPending={setTier.isPending}
            />
          )}

          {activeProposal === "roi" && (
            <ProposalRoi
              interval={interval}
              currentTier={currentTier}
              onSelectTier={handleSelectTier}
              isPending={setTier.isPending}
            />
          )}
        </div>
      </div>

      {dialog}
    </>
  );
}
