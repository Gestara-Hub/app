"use client";

import { useState } from "react";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  CreditCard,
  Landmark,
  QrCode,
  Receipt,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { Organization } from "@gestarahub/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ActivateSubaccountDialog } from "./activate-subaccount-dialog";
import {
  ASAAS_FEES,
  PIX_WITHDRAWAL,
  PLATFORM_SPLIT_CENTS,
  calculateOnlineChargeAmounts,
  platformSplitCents,
} from "@gestarahub/core/payment-fees";
import { useSubscriptionTier } from "@/features/auth";
import { formatCents } from "@gestarahub/core/format";
import { cn } from "@/lib/utils";

interface OnlinePaymentsOnboardingProps {
  organization: Organization;
  canManage: boolean;
}

const TIER_LABEL = { free: "Grátis", pro: "Profissional", scale: "Expansão" } as const;
/** Valores de exemplo da simulacao, em reais. */
const SAMPLE_AMOUNTS = [100, 150, 250];

/**
 * Recebimentos online antes de ativar (revisao de 01/11/2026): a tela que
 * convence o espaco a ligar o Pix. Beneficio concreto e o desenho do fluxo,
 * "Como funciona" em 3 passos, "Quanto voce recebe" com a conta da previa de
 * cobranca (mesmo motor, mesma taxa do plano) e a tabela de taxas compacta.
 * Sem numeros de marketing: so o que o produto faz e o que custa.
 */
export function OnlinePaymentsOnboarding({
  organization,
  canManage,
}: OnlinePaymentsOnboardingProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const tier = useSubscriptionTier();
  const split = platformSplitCents(tier);

  return (
    <>
      <div className="space-y-6">
        {/* Hero: o beneficio e o fluxo desenhado */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-card p-6 md:p-8">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Pix e cartão com baixa automática
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                O aluno paga pelo celular; a cobrança baixa sozinha. Sem conferir extrato, sem marcar pago.
              </p>
              <div className="space-y-2 pt-1">
                <Button onClick={() => setDialogOpen(true)} disabled={!canManage} className="gap-2 shadow-md">
                  Ativar conta de recebimento
                  <ArrowRight className="size-4" />
                </Button>
                <p className="text-xs text-muted-foreground">
                  {canManage ? "Sem mensalidade. Só paga quando recebe." : "Só o dono ou o gerente ativa a conta."}
                </p>
              </div>
            </div>
            <FlowIllustration />
          </div>
        </div>

        {/* Como funciona, em 3 passos */}
        <section className="space-y-3" aria-labelledby="online-how">
          <h3 id="online-how" className="text-base font-semibold text-foreground">Como funciona</h3>
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Step n={1} title="Ative em 2 minutos" text="CPF ou CNPJ, e-mail e endereço. Sem papelada." />
            <Step n={2} title="Cobre pelo link ou QR" text="Mande pelo WhatsApp. O aluno paga no celular." />
            <Step n={3} title="Recebeu, baixou" text="A cobrança marca paga sozinha. Saque quando quiser." />
          </ol>
        </section>

        {/* Quanto voce recebe: a conta da previa de cobranca, com a taxa do plano */}
        <Simulation split={split} tier={tier} />

        {/* Taxas compactas e garantias */}
        <section className="space-y-3 rounded-xl border border-border/80 bg-card p-5" aria-labelledby="online-fees">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="online-fees" className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Receipt className="size-5 text-primary" />
              Taxas
            </h3>
            <span className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
              Seu plano: {TIER_LABEL[tier]} · {formatCents(split)} por cobrança
            </span>
          </div>
          <dl className="grid grid-cols-1 gap-x-6 text-sm sm:grid-cols-2">
            <FeeLine label="Pix" value={`até ${formatCents(ASAAS_FEES.pix.fixedCents)} + ${formatCents(split)}`} hint="parceiro + GestaraHub · cai na hora" />
            <FeeLine
              label="Cartão de crédito"
              value={`até 2,99% + ${formatCents(ASAAS_FEES.creditCard.fixedCents)} + ${formatCents(split)}`}
              hint="parceiro + GestaraHub · cai em 32 dias"
            />
            <FeeLine label="Saque via Pix" value={`${PIX_WITHDRAWAL.freePerMonth} grátis por mês`} hint={`depois, ${formatCents(PIX_WITHDRAWAL.feeCents)} cada`} accent />
            <FeeLine label="Cobrança não paga" value="R$ 0,00" hint="cancelada ou vencida" />
          </dl>
          {tier === "free" ? (
            <p className="text-xs text-muted-foreground">
              Nos planos pagos a taxa do GestaraHub cai para {formatCents(PLATFORM_SPLIT_CENTS.pro)} por cobrança.
            </p>
          ) : null}
          <ul className="grid grid-cols-1 gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <Guarantee icon={<Zap className="size-3.5" />} text="Baixa automática no Pix e no cartão" />
            <Guarantee icon={<BellRing className="size-3.5" />} text="Lembrete com o link de pagamento" />
            <Guarantee icon={<Landmark className="size-3.5" />} text="Saque para a sua conta quando quiser" />
            <Guarantee icon={<ShieldCheck className="size-3.5" />} text="Parceiro regulado pelo Banco Central" />
          </ul>
        </section>
      </div>

      <ActivateSubaccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        organization={organization}
      />
    </>
  );
}

/** O fluxo em tres cartoes alinhados, ligados por uma linha vertical: a mensalidade, o Pix pago, a baixa. */
function FlowIllustration() {
  return (
    <div aria-hidden className="hidden lg:block">
      <ol className="relative mx-auto max-w-xs space-y-3 before:absolute before:top-5 before:bottom-5 before:left-[1.35rem] before:w-px before:bg-border">
        <li className="relative flex items-center gap-3 rounded-xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background">
            <Receipt className="size-3.5 text-muted-foreground" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">Mensalidade de novembro</p>
            <p className="text-sm font-semibold text-foreground">R$ 150,00</p>
          </div>
        </li>
        <li className="relative flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 shadow-sm">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-background">
            <QrCode className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Aluno pagou pelo Pix</p>
            <p className="text-[11px] text-muted-foreground">hoje, 19:42</p>
          </div>
        </li>
        <li className="relative flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 shadow-sm">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-background">
            <CheckCircle2 className="size-3.5 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Cobrança baixada</p>
            <p className="text-[11px] text-muted-foreground">sem você fazer nada</p>
          </div>
        </li>
      </ol>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <li className="flex gap-3 rounded-xl border border-border/70 bg-card p-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
    </li>
  );
}

function FeeLine({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">
        <span className={cn("font-semibold tabular-nums", accent ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>{value}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </dd>
    </div>
  );
}

function Guarantee({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="text-emerald-600 dark:text-emerald-400">{icon}</span>
      <span>{text}</span>
    </li>
  );
}

/**
 * "Quanto voce recebe": o mesmo calculo da previa de cobranca
 * (`calculateOnlineChargeAmounts`), com a tarifa cheia do parceiro e a taxa do
 * plano. A chave "repassar ao aluno" mostra o valor que ele paga.
 */
function Simulation({ split, tier }: { split: number; tier: "free" | "pro" | "scale" }) {
  const [amount, setAmount] = useState<number | null>(150);
  const [passFee, setPassFee] = useState(false);
  const amountCents = amount && amount > 0 ? Math.round(amount * 100) : 0;
  const pix = calculateOnlineChargeAmounts({ amountCents, method: "pix", splitAmountCents: split, passFee });
  const card = calculateOnlineChargeAmounts({ amountCents, method: "link", splitAmountCents: split, passFee });
  const valid = amountCents > 0;

  return (
    <section className="space-y-4 rounded-xl border border-border/80 bg-card p-5" aria-labelledby="online-simulation">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="online-simulation" className="text-base font-semibold text-foreground">Quanto você recebe</h3>
          <p className="text-xs text-muted-foreground">Com a taxa do seu plano ({TIER_LABEL[tier]}). A prévia de cada cobrança mostra o mesmo.</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="online-pass-fee" checked={passFee} onCheckedChange={setPassFee} />
          <Label htmlFor="online-pass-fee" className="text-sm font-normal">Repassar as taxas ao aluno</Label>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40 space-y-1.5">
          <Label htmlFor="online-sample-amount">Valor da cobrança</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">R$</span>
            <Input
              id="online-sample-amount"
              type="number"
              inputMode="decimal"
              min={1}
              step={1}
              value={amount ?? ""}
              onChange={(e) => setAmount(e.target.value === "" ? null : Number(e.target.value))}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1 pb-1" aria-label="Valores de exemplo">
          {SAMPLE_AMOUNTS.map((reais) => (
            <button
              key={reais}
              type="button"
              aria-pressed={amount === reais}
              onClick={() => setAmount(reais)}
              className="inline-flex cursor-pointer items-center rounded-md border bg-muted/60 px-2 py-1 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground aria-pressed:border-primary aria-pressed:bg-primary/10"
            >
              {formatCents(reais * 100)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Outcome
          icon={<QrCode className="size-4 text-emerald-600 dark:text-emerald-400" />}
          title="No Pix"
          when="cai na hora"
          amounts={pix}
          passFee={passFee}
          valid={valid}
        />
        <Outcome
          icon={<CreditCard className="size-4 text-sky-600 dark:text-sky-400" />}
          title="No cartão de crédito"
          when="cai em 32 dias"
          amounts={card}
          passFee={passFee}
          valid={valid}
        />
      </div>
    </section>
  );
}

function Outcome({
  icon,
  title,
  when,
  amounts,
  passFee,
  valid,
}: {
  icon: React.ReactNode;
  title: string;
  when: string;
  amounts: ReturnType<typeof calculateOnlineChargeAmounts>;
  passFee: boolean;
  valid: boolean;
}) {
  const { chargedAmountCents, netAmountCents, gatewayFeeCents, splitAmountCents } = amounts;
  return (
    <div className="space-y-1 rounded-lg border border-border/70 bg-background/60 p-4">
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        {title}
        <span className="text-xs font-normal text-muted-foreground">· {when}</span>
      </p>
      <p className="pt-1 text-xs text-muted-foreground">Você recebe</p>
      <p className="text-2xl font-bold tabular-nums text-foreground">{valid ? formatCents(netAmountCents) : "R$ 0,00"}</p>
      <p className="text-xs text-muted-foreground">
        {!valid
          ? "Informe um valor para ver a conta."
          : passFee
            ? `O aluno paga ${formatCents(chargedAmountCents)} (parceiro ${formatCents(gatewayFeeCents)} + GestaraHub ${formatCents(splitAmountCents)}).`
            : `Saem ${formatCents(gatewayFeeCents)} do parceiro e ${formatCents(splitAmountCents)} do GestaraHub.`}
      </p>
    </div>
  );
}
