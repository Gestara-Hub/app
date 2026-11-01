"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  QrCode,
  Receipt,
  Zap,
} from "lucide-react";
import type { Organization } from "@gestarahub/contracts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ActivateSubaccountDialog } from "./activate-subaccount-dialog";
import { ASAAS_FEES, PIX_WITHDRAWAL, PLATFORM_SPLIT_CENTS, platformSplitCents } from "@gestarahub/core/payment-fees";
import { useSubscriptionTier } from "@/features/auth";
import { formatCents } from "@gestarahub/core/format";

interface OnlinePaymentsOnboardingProps {
  organization: Organization;
  canManage: boolean;
}

/** "Parceiro + GestaraHub (seu plano)" no Pro; no Gratis, com o valor dos planos pagos. */
function feeNoteFor(tier: ReturnType<typeof useSubscriptionTier>): string {
  return tier === "free"
    ? `parceiro + GestaraHub (${formatCents(PLATFORM_SPLIT_CENTS.pro)} nos planos pagos)`
    : "parceiro + GestaraHub";
}

export function OnlinePaymentsOnboarding({
  organization,
  canManage,
}: OnlinePaymentsOnboardingProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const tier = useSubscriptionTier();
  const platformFee = formatCents(platformSplitCents(tier));
  const feeNote = feeNoteFor(tier);

  return (
    <>
      <div className="space-y-6">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-card p-6 md:p-8">
          <div className="max-w-2xl space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Pix e cartão com baixa automática
            </h2>

            <p className="text-sm text-muted-foreground sm:text-base leading-relaxed">
              O aluno paga; a cobrança baixa sozinha.
            </p>

            <div className="pt-2">
              <Button
                onClick={() => setDialogOpen(true)}
                disabled={!canManage}
                className="gap-2 shadow-md"
              >
                Ativar conta de recebimento
                <ArrowRight className="size-4" />
              </Button>
              {!canManage ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Só o dono ou o gerente ativa a conta.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* 3 Pilares de Vantagens */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-border/60 bg-card/60 transition-colors hover:border-primary/30">
            <CardHeader className="pb-3">
              <div className="w-fit rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
                <QrCode className="size-5" />
              </div>
              <CardTitle className="text-base font-semibold">Pix</CardTitle>
              <CardDescription className="text-xs">QR Code por cobrança. Baixa na hora.</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/60 bg-card/60 transition-colors hover:border-primary/30">
            <CardHeader className="pb-3">
              <div className="w-fit rounded-lg bg-blue-500/10 p-2.5 text-blue-600 dark:text-blue-400">
                <CreditCard className="size-5" />
              </div>
              <CardTitle className="text-base font-semibold">Link de cartão</CardTitle>
              <CardDescription className="text-xs">Mande pelo WhatsApp. O aluno paga no celular.</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/60 bg-card/60 transition-colors hover:border-primary/30">
            <CardHeader className="pb-3">
              <div className="w-fit rounded-lg bg-purple-500/10 p-2.5 text-purple-600 dark:text-purple-400">
                <Zap className="size-5" />
              </div>
              <CardTitle className="text-base font-semibold">Saque via Pix</CardTitle>
              <CardDescription className="text-xs">
                {PIX_WITHDRAWAL.freePerMonth} grátis por mês; depois, {formatCents(PIX_WITHDRAWAL.feeCents)} cada.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Tabela de Tarifas Transparentes */}
        <Card className="border-border/80">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="size-5 text-primary" />
              <div>
                <CardTitle className="text-base">Taxas</CardTitle>
                <CardDescription className="text-xs">Só quando o aluno paga.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* A taxa do GestaraHub e a do plano atual (01/11/2026), como na tabela do dialogo de ativar. */}
              <div className="rounded-lg border border-border/70 bg-card p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground">Pix</span>
                <p className="text-lg font-bold text-foreground">
                  até {formatCents(ASAAS_FEES.pix.fixedCents)} + {platformFee}
                </p>
                <p className="text-[11px] text-muted-foreground">{feeNote} · na hora</p>
              </div>

              <div className="rounded-lg border border-border/70 bg-card p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground">Cartão de crédito</span>
                <p className="text-lg font-bold text-foreground">
                  até 2,99% + {formatCents(ASAAS_FEES.creditCard.fixedCents)} + {platformFee}
                </p>
                <p className="text-[11px] text-muted-foreground">{feeNote} · em 32 dias</p>
              </div>

              <div className="rounded-lg border border-border/70 bg-card p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground">Transferência para o banco</span>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {PIX_WITHDRAWAL.freePerMonth} grátis por mês
                </p>
                <p className="text-[11px] text-muted-foreground">depois, {formatCents(PIX_WITHDRAWAL.feeCents)} cada</p>
              </div>

              <div className="rounded-lg border border-border/70 bg-card p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground">Cobrança não paga</span>
                <p className="text-lg font-bold text-foreground">
                  R$ 0,00
                </p>
                <p className="text-[11px] text-muted-foreground">cancelada ou vencida</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span>Parceiro de pagamentos regulado pelo Banco Central.</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <ActivateSubaccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        organization={organization}
      />
    </>
  );
}
