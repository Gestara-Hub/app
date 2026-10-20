"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  QrCode,
  Receipt,
  Sparkles,
  Zap,
} from "lucide-react";
import type { Organization } from "@gestarahub/contracts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ActivateSubaccountDialog } from "./activate-subaccount-dialog";

interface OnlinePaymentsOnboardingProps {
  organization: Organization;
  canManage: boolean;
}

export function OnlinePaymentsOnboarding({
  organization,
  canManage,
}: OnlinePaymentsOnboardingProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="space-y-6">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-card p-6 md:p-8">
          <div className="max-w-2xl space-y-4">
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/10 text-primary"
            >
              <Sparkles className="mr-1.5 size-3.5" />
              Ecossistema Financeiro GestaraHub
            </Badge>

            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Receba pagamentos com baixa automática e repasse direto no seu Pix
            </h2>

            <p className="text-sm text-muted-foreground sm:text-base leading-relaxed">
              Diga adeus ao envio manual de comprovantes e conferência bancária.
              Com a conta de recebimento ativa, suas cobranças geram Pix com QR Code
              e links de cartão que baixam a fatura do aluno no mesmo instante em que ele paga.
            </p>

            <div className="pt-2">
              <Button
                size="lg"
                onClick={() => setDialogOpen(true)}
                disabled={!canManage}
                className="gap-2 text-sm font-semibold shadow-md"
              >
                Ativar conta de recebimento
                <ArrowRight className="size-4" />
              </Button>
              {!canManage ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Apenas proprietários e administradores podem ativar a conta.
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
              <CardTitle className="text-base font-semibold">
                Pix Dinâmico e Automático
              </CardTitle>
              <CardDescription className="text-xs">
                QR Code e copia-e-cola únicos por cobrança. O aluno paga pelo app do banco e a mensalidade dá baixa sozinha.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/60 bg-card/60 transition-colors hover:border-primary/30">
            <CardHeader className="pb-3">
              <div className="w-fit rounded-lg bg-blue-500/10 p-2.5 text-blue-600 dark:text-blue-400">
                <CreditCard className="size-5" />
              </div>
              <CardTitle className="text-base font-semibold">
                Link de Cartão de Crédito
              </CardTitle>
              <CardDescription className="text-xs">
                Compartilhe o link pelo WhatsApp ou e-mail. Seu aluno paga com comodidade e segurança antifraude.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/60 bg-card/60 transition-colors hover:border-primary/30">
            <CardHeader className="pb-3">
              <div className="w-fit rounded-lg bg-purple-500/10 p-2.5 text-purple-600 dark:text-purple-400">
                <Zap className="size-5" />
              </div>
              <CardTitle className="text-base font-semibold">
                Saque Pix Grátis (R$ 0,00)
              </CardTitle>
              <CardDescription className="text-xs">
                Transfira o saldo disponível da sua carteira para qualquer chave Pix do titular, sem tarifa de transferência.
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
                <CardTitle className="text-base">
                  Transparência de Tarifas
                </CardTitle>
                <CardDescription className="text-xs">
                  Sem pegadinhas: você só paga taxa quando o aluno efetivamente pagar.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border/70 bg-card p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground">Pix Dinâmico</span>
                <p className="text-lg font-bold text-foreground">
                  R$ 1,99 <span className="text-xs font-normal text-muted-foreground">no Free</span>
                </p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  R$ 1,29 no Plano Pro
                </p>
              </div>

              <div className="rounded-lg border border-border/70 bg-card p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground">Cartão de Crédito</span>
                <p className="text-lg font-bold text-foreground">
                  2,99% + taxa
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Recebimento em 30 dias (D+30)
                </p>
              </div>

              <div className="rounded-lg border border-border/70 bg-card p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground">Transferência para o banco</span>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  Grátis (R$ 0,00)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Saque via Pix direto na sua chave
                </p>
              </div>

              <div className="rounded-lg border border-border/70 bg-card p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground">Cobrança não paga</span>
                <p className="text-lg font-bold text-foreground">
                  R$ 0,00
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Custo zero em canceladas ou expiradas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span>
                Processamento oficial via infraestrutura bancária autorizada pelo Banco Central (Asaas I.P. S.A.).
              </span>
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
