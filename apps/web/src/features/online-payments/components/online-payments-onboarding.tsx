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
  PLATFORM_FEE_RULES,
  calculateOnlineChargeAmounts,
  platformFeePercentText,
  platformFeeRangeText,
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
  // Taxa do GestaraHub: percentual do valor, com minimo e teto (doc 13, 26/11/2026).
  const fee = platformFeePercentText(tier);
  const rule = PLATFORM_FEE_RULES[tier];

  return (
    <>
      <div className="space-y-6">
        {/* Hero: o beneficio e o fluxo desenhado */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-card p-6 md:p-8">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <div className="space-y-4">
              {/* O nome da tela vive aqui ate a conta ser ativada (sem cabecalho repetido). */}
              <p className="text-xs font-semibold tracking-wider text-primary uppercase">Recebimentos online</p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Pix e cartão com baixa automática
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                O aluno paga pelo celular; a cobrança baixa sozinha. Sem conferir extrato, sem marcar pago.
              </p>
              <div className="space-y-2 pt-1">
                <Button onClick={() => setDialogOpen(true)} disabled={!canManage} className="gap-2 shadow-md">
                  Ativar conta de recebimento
                  <ArrowRight className="size-4" />
                </Button>
                <p className="text-xs text-muted-foreground">
                  {canManage ? "Sem mensalidade. Só paga quando recebe." : "Apenas o proprietário pode ativar a conta de recebimento."}
                </p>
              </div>
            </div>
            <FlowIllustration />
          </div>
        </div>

        {/* Como funciona, em 3 passos */}
        <section className="space-y-3" aria-labelledby="online-how">
          <h2 id="online-how" className="text-base font-semibold text-foreground">Como funciona</h2>
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Step n={1} title="Ative em 2 minutos" text="CPF ou CNPJ, e-mail e endereço. Sem papelada." />
            <Step n={2} title="Cobre pelo link ou QR" text="Mande pelo WhatsApp. O aluno paga no celular." />
            <Step n={3} title="Recebeu, baixou" text="A cobrança marca paga sozinha. Saque quando quiser." />
          </ol>
        </section>

        {/* Quanto voce recebe: a conta da previa de cobranca, com a taxa do plano */}
        <Simulation tier={tier} />

        {/* Taxas compactas e garantias */}
        <section className="space-y-3 rounded-xl border border-border/80 bg-card p-5" aria-labelledby="online-fees">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="online-fees" className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Receipt className="size-5 text-primary" />
              Taxas
            </h2>
            <span className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
              Seu plano: {TIER_LABEL[tier]} · {fee} por cobrança
            </span>
          </div>
          {/* Tres blocos (26/11/2026): o que o parceiro cobra por forma, a taxa do
              GestaraHub (percentual, minimo, maximo e exemplos) e o que nao custa. */}
          {/* Colunas separadas por linhas, sem cartao dentro do cartao (26/11/2026). */}
          <div className="grid grid-cols-1 divide-y divide-border/60 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            <FeeBlock title="Tarifa do parceiro" subtitle="Por forma de pagamento">
              <FeeRow label="Pix" value={`até ${formatCents(ASAAS_FEES.pix.fixedCents)}`} hint="cai na hora" />
              <FeeRow
                label="Cartão de crédito"
                value={`até 2,99% + ${formatCents(ASAAS_FEES.creditCard.fixedCents)}`}
                hint="cai em até 32 dias"
              />
            </FeeBlock>

            <FeeBlock title="Taxa do GestaraHub" subtitle="Igual no Pix e no cartão" highlight>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-2xl font-bold tabular-nums text-foreground">{fee}</span>
                <span className="text-sm text-muted-foreground">da cobrança</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  mínimo <span className="font-semibold text-foreground">{formatCents(rule.minCents)}</span>
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  máximo <span className="font-semibold text-foreground">{formatCents(rule.maxCents)}</span>
                </span>
              </div>
              <ul className="space-y-1 border-t border-border/50 pt-2 text-xs" data-testid="fee-examples">
                {FEE_EXAMPLES_CENTS.map((amount) => {
                  const split = platformSplitCents(tier, amount);
                  const tag = split === rule.minCents ? "mínimo" : split === rule.maxCents ? "máximo" : null;
                  return (
                    <li key={amount} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Cobrança de {formatCents(amount)}</span>
                      <span className="tabular-nums font-medium text-foreground">
                        {formatCents(split)}
                        {tag ? <span className="ml-1 font-normal text-muted-foreground">({tag})</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {tier === "free" ? (
                <p className="text-[11px] text-muted-foreground">
                  Nos planos pagos: {platformFeePercentText("pro")}, {platformFeeRangeText("pro")}.
                </p>
              ) : null}
            </FeeBlock>

            <FeeBlock title="Sem surpresa" subtitle="O que não custa nada">
              <FeeRow label="Cobrança não paga" value="R$ 0,00" hint="cancelada ou vencida" />
              <FeeRow
                label="Saque via Pix"
                value={`${PIX_WITHDRAWAL.freePerMonth} grátis por mês`}
                hint={`depois, ${formatCents(PIX_WITHDRAWAL.feeCents)} cada`}
                accent
              />
            </FeeBlock>
          </div>
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

/** Exemplos da taxa: abaixo do minimo, no meio e acima do teto. */
const FEE_EXAMPLES_CENTS = [3000, 15000, 100000];

function FeeBlock({
  title,
  subtitle,
  highlight,
  children,
}: {
  title: string;
  subtitle: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 py-4 first:pt-0 last:pb-0 lg:px-6 lg:py-0 lg:first:pl-0 lg:last:pr-0">
      <div>
        <p className={cn("text-sm font-semibold", highlight ? "text-primary" : "text-foreground")}>{title}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function FeeRow({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <span className={cn("shrink-0 text-right text-sm font-semibold tabular-nums", accent ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

function Guarantee({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="text-emerald-700 dark:text-emerald-400">{icon}</span>
      <span>{text}</span>
    </li>
  );
}

/**
 * "Quanto voce recebe": o mesmo calculo da previa de cobranca
 * (`calculateOnlineChargeAmounts`), com a tarifa cheia do parceiro e a taxa do
 * plano. A chave "repassar ao aluno" mostra o valor que ele paga.
 */
function Simulation({ tier }: { tier: "free" | "pro" | "scale" }) {
  const [amount, setAmount] = useState<number | null>(150);
  const [passFee, setPassFee] = useState(false);
  const amountCents = amount && amount > 0 ? Math.round(amount * 100) : 0;
  const split = platformSplitCents(tier, amountCents);
  const pix = calculateOnlineChargeAmounts({ amountCents, method: "pix", splitAmountCents: split, passFee });
  const card = calculateOnlineChargeAmounts({ amountCents, method: "link", splitAmountCents: split, passFee });
  const valid = amountCents > 0;

  return (
    <section className="space-y-4 rounded-xl border border-border/80 bg-card p-5" aria-labelledby="online-simulation">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="online-simulation" className="text-base font-semibold text-foreground">Quanto você recebe</h2>
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
          when="cai em até 32 dias"
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
