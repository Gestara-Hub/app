"use client";

import Link from "next/link";
import { ArrowRight, Crown, Sparkles } from "lucide-react";
import { formatCents } from "@gestarahub/core/format";
import { platformSplitCents } from "@gestarahub/core/payment-fees";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/features/settings";

export function SidebarSubscriptionCard() {
  const { data } = useSubscription();
  const tier = data?.tier ?? "free";

  if (tier === "pro") {
    return (
      <div className="w-full">
        {/* Visual expandido */}
        <Link
          href="/plans"
          className="group flex flex-col gap-1.5 rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-2.5 transition-all hover:bg-sidebar-accent hover:border-sidebar-foreground/25 group-data-[collapsible=icon]:hidden shadow-2xs"
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-400/20 text-emerald-400">
                <Sparkles className="size-3.5" />
              </div>
              <span className="text-xs font-bold text-sidebar-foreground">
                Plano Profissional
              </span>
            </div>
            <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
              Ativo
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-sidebar-foreground/75 pt-0.5">
            <span>Taxa online {formatCents(platformSplitCents("pro"))}</span>
            <span className="font-semibold text-sidebar-foreground group-hover:underline inline-flex items-center gap-0.5">
              Gerenciar <ArrowRight className="size-2.5" />
            </span>
          </div>
        </Link>

        {/* Visual colapsado */}
        <div className="hidden group-data-[collapsible=icon]:flex justify-center py-0.5">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title="Plano Profissional Ativo · Ver planos"
          >
            <Link href="/plans">
              <Sparkles className="size-4 text-emerald-400" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (tier === "scale") {
    return (
      <div className="w-full">
        <Link
          href="/plans"
          className="group flex flex-col gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-2.5 transition-all hover:bg-indigo-500/15 hover:border-indigo-500/40 group-data-[collapsible=icon]:hidden shadow-2xs"
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/25 text-indigo-300">
                <Crown className="size-3.5" />
              </div>
              <span className="text-xs font-bold text-sidebar-foreground">
                Plano Expansão
              </span>
            </div>
            <span className="inline-flex items-center rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300">
              Ativo
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-sidebar-foreground/75 pt-0.5">
            <span>Multiunidades ativas</span>
            <span className="font-semibold text-sidebar-foreground group-hover:underline inline-flex items-center gap-0.5">
              Gerenciar <ArrowRight className="size-2.5" />
            </span>
          </div>
        </Link>

        <div className="hidden group-data-[collapsible=icon]:flex justify-center py-0.5">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title="Plano Expansão Ativo · Ver planos"
          >
            <Link href="/plans">
              <Crown className="size-4 text-indigo-400" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Plano Grátis (Free)
  return (
    <div className="w-full">
      <Link
        href="/plans"
        className="group flex flex-col gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-2.5 transition-all hover:bg-sidebar-accent hover:border-sidebar-foreground/25 group-data-[collapsible=icon]:hidden shadow-2xs"
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-400/20 text-amber-400 dark:text-amber-300">
              <Sparkles className="size-3.5" />
            </div>
            <span className="text-xs font-bold text-sidebar-foreground">
              Plano Grátis
            </span>
          </div>
          <span className="inline-flex items-center gap-0.5 rounded-md bg-sidebar-foreground/10 px-2 py-0.5 text-[10px] font-bold text-sidebar-foreground group-hover:bg-sidebar-foreground/20 transition-colors">
            Evoluir
            <ArrowRight className="size-2.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
        <p className="text-[11px] text-sidebar-foreground/75 leading-snug">
          Automatize o WhatsApp e reduza sua taxa Pix para R$ 1,29.
        </p>
      </Link>

      <div className="hidden group-data-[collapsible=icon]:flex justify-center py-0.5">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="size-8 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          title="Plano Grátis · Ver planos"
        >
          <Link href="/plans">
            <Sparkles className="size-4 text-amber-400" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
