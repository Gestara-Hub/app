"use client";

import { useState } from "react";
import { setSeenMark, useSeenMark, useSeenMarksReady } from "@/lib/seen-marks";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  CheckCircle2,
  FileText,
  QrCode,
  Settings2,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { competenceLongLabel } from "@/lib/documents/format";
import { FeatureLocked } from "@/components/shared/feature-locked";
import { useCan, useCurrentUser, useHasFeature } from "@/features/auth";
import { useOrganization } from "@/features/settings";
import { cn } from "@/lib/utils";
import { SubaccountPanel } from "./subaccount-panel";
import { OnlinePaymentsOnboarding } from "./online-payments-onboarding";
import { AsaasAccessAfterActivation } from "./asaas-access-guide";
import { OnlinePaymentsSettingsTab } from "./online-payments-settings-tab";
import { ProductTour, type TourStep } from "@/components/shared/product-tour";
import { SubaccountTransferDialog } from "./subaccount-transfer-dialog";
import { OnlinePaymentsRefresh } from "./online-payments-refresh";
import { useSubaccountBalance, useSubaccountOnboarding } from "../hooks/use-online-payments";
import { AccountReadinessCard } from "./account-readiness-card";
import { ApiKeyInvalidCard } from "./api-key-invalid-card";

const BENEFITS = [
  "Pix copia e cola e QR Code dinâmico com baixa automática",
  "Link de pagamento de cartão de crédito para enviar no WhatsApp",
  "Pix Automático: mensalidade cobrada no vencimento pelo banco",
  "Saque do saldo via Pix: 30 grátis por mês",
] as const;

type OnlinePaymentsTab = "carteira" | "configuracoes";

/** O selo "Ativação pendente" só depois de o dono ter começado a ativação (achado 5). */
function showPendingBadge(status: string | undefined): boolean {
  return status === "pending";
}

/** Tour da tela logo depois de ativar a conta (01/11/2026): uma vez por pessoa, na conta desde 25/11/2026. */
const TOUR_SEEN_KEY = "gestarahub_tour_online_payments";

/** Um passo por aba e por funcao da tela, uma frase cada. */
function tourSteps(options: { canWithdraw: boolean; canStatement: boolean }): TourStep[] {
  const steps: TourStep[] = [
    {
      target: '[data-tour="op-tab-wallet"]',
      title: "Carteira & Extrato",
      body: "Saldo, pagamentos recebidos e saques, tudo nesta aba.",
    },
    {
      target: '[data-tour="op-available"]',
      title: "Disponível para saque",
      body: "Dinheiro já liberado. Pix e boleto liberam na hora.",
    },
    {
      target: '[data-tour="op-pending"]',
      title: "A liberar",
      body: "Cartão de crédito cai em até 32 dias e aparece aqui antes.",
    },
    {
      target: '[data-tour="op-received"]',
      title: "Recebido no mês",
      body: "Líquido do período, já sem as taxas.",
    },
    {
      target: '[data-tour="op-history"]',
      title: "Histórico",
      body: "Cada Pix e link pago, com taxas e líquido. Em Saques, as transferências.",
    },
  ];
  if (options.canWithdraw) {
    steps.push({
      target: '[data-tour="op-withdraw"]',
      title: "Sacar via Pix",
      body: "Leva o saldo disponível para a sua conta. 30 saques grátis por mês.",
    });
  }
  if (options.canStatement) {
    steps.push({
      target: '[data-tour="op-statement"]',
      title: "Extrato em PDF",
      body: "Extrato mensal da conta, pronto para a contabilidade.",
    });
  }
  steps.push({
    target: '[data-tour="op-tab-settings"]',
    title: "Configurações",
    body: "Chave Pix do saque, validade do Pix, formas aceitas e repasse das taxas ao aluno.",
  });
  return steps;
}

export function OnlinePaymentsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: OnlinePaymentsTab =
    rawTab === "configuracoes" ? "configuracoes" : "carteira";

  const setTab = (newTab: OnlinePaymentsTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const hasFeature = useHasFeature();
  const can = useCan();
  const canManage = can("finance:manage");
  const user = useCurrentUser();
  const isOwner = user.profile === "owner";
  const orgQuery = useOrganization();
  const [quickTransferOpen, setQuickTransferOpen] = useState(false);
  // Tour: marca na conta (lib/seen-marks); so depois de a conta responder, para nao
  // abrir de novo num aparelho onde a pessoa ainda nao entrou.
  const tourMarked = useSeenMark(TOUR_SEEN_KEY);
  const marksReady = useSeenMarksReady();
  const tourSeen = !marksReady || tourMarked;
  const [tourClosed, setTourClosed] = useState(false);
  const closeTour = () => {
    setSeenMark(TOUR_SEEN_KEY);
    setTourClosed(true);
  };

  const org = orgQuery.data;
  const balanceQuery = useSubaccountBalance(org?.id);
  const availableCents = balanceQuery.data?.availableForTransferCents ?? 0;
  // Analise da conta no Asaas (25/11/2026): so com a conta criada.
  const onboardingQuery = useSubaccountOnboarding(org?.settings?.onlinePayments?.gatewayStatus === "approved");

  if (!hasFeature("online_payments")) {
    return (
      <FeatureLocked
        title="Recebimentos online"
        description="Receba pagamentos com baixa automática e repasses diretos na sua conta via Pix."
        benefits={BENEFITS}
        icon={<QrCode className="size-7" aria-hidden />}
        canManagePlan={can("subscription:manage")}
      />
    );
  }

  // Conta criada e ainda sem aprovacao conhecida: espera a situacao do Asaas antes
  // de mostrar a tela (25/11/2026: a carteira aparecia e o cartao "Deixe sua conta
  // pronta" surgia depois, empurrando tudo para baixo). Ja aprovada: nao espera.
  const awaitingAsaasStatus =
    org?.settings?.onlinePayments?.gatewayStatus === "approved" &&
    org.settings.onlinePayments.asaasStatus?.general !== "APPROVED" &&
    onboardingQuery.isPending;

  if (orgQuery.isLoading || awaitingAsaasStatus) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-60" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card>
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (orgQuery.isError || !org) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar as informações de pagamento online.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void orgQuery.refetch()}
          >
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const onlineSettings = org.settings?.onlinePayments;
  const isSubaccountActive = onlineSettings?.gatewayStatus === "approved";
  // Situacao no Asaas: a lida agora vale mais que a gravada. Sem nenhuma (conta
  // de antes de 25/11/2026 ou demonstracao), fica "Conta ativa" como antes.
  const onboarding = onboardingQuery.data ?? null;
  const asaasGeneral = onboarding?.status.general ?? onlineSettings?.asaasStatus?.general;
  const asaasApproved = !asaasGeneral || asaasGeneral === "APPROVED";

  return (
    <>
      {/* Antes de ativar, o titulo mora no hero (01/11/2026); o cabecalho so entra com a conta ativa ou em analise (traz a etiqueta). */}
      {isSubaccountActive || showPendingBadge(onlineSettings?.gatewayStatus) ? (
      <PageHeader
        title="Recebimentos online"
        description={isSubaccountActive ? "Saldos das mensalidades, histórico de cobranças e saques via Pix." : undefined}
      >
        {isSubaccountActive ? (
          <>
            {asaasApproved ? (
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
              >
                <CheckCircle2 className="size-3.5" />
                Conta ativa
              </Badge>
            ) : asaasGeneral === "REJECTED" ? (
              <Badge
                variant="outline"
                className="gap-1.5 border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive"
              >
                Conta recusada no Asaas
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1.5 border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
              >
                Em análise no Asaas
              </Badge>
            )}

            {can("finance:view") ? <StatementMenu /> : null}

            {isOwner ? (
              <Button
                data-tour="op-withdraw"
                onClick={() => setQuickTransferOpen(true)}
                disabled={availableCents <= 0}
                className="gap-1.5 shadow-xs"
              >
                <ArrowUpRight className="size-4" />
                Sacar via Pix
              </Button>
            ) : null}
          </>
        ) : showPendingBadge(onlineSettings?.gatewayStatus) ? (
          <Badge
            variant="outline"
            className="gap-1.5 border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
          >
            Ativação pendente
          </Badge>
        ) : null}
      </PageHeader>
      ) : null}

      <AsaasAccessAfterActivation />

      {!isSubaccountActive ? (
        <OnlinePaymentsOnboarding
          organization={org}
          canManage={isOwner}
        />
      ) : (
        <div className="space-y-5">
          {/* Chave da conta sem valer (27/11/2026): o Pix e o link param ate a troca. */}
          {org.settings?.onlinePayments?.apiKeyStatus?.state === "invalid" ? <ApiKeyInvalidCard canManage={canManage} /> : null}
          {onboarding && onboarding.status.general !== "APPROVED" ? (
            <AccountReadinessCard
              organizationId={org.id}
              onboarding={onboarding}
              refreshing={onboardingQuery.isFetching}
              onRefresh={() => void onboardingQuery.refetch()}
            />
          ) : null}
          {/* Abas e, na Carteira, "Atualizado ha X · Atualizar" na mesma linha */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div
              role="tablist"
              aria-label="Navegação de Recebimentos online"
              className="flex w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1 text-muted-foreground sm:w-fit"
            >
              <button
                type="button"
                role="tab"
                data-tour="op-tab-wallet"
                aria-selected={tab === "carteira"}
                onClick={() => setTab("carteira")}
                className={cn(
                  "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                  tab === "carteira"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Wallet className="size-4 shrink-0" />
                Carteira & Extrato
              </button>

              <button
                type="button"
                role="tab"
                data-tour="op-tab-settings"
                aria-selected={tab === "configuracoes"}
                onClick={() => setTab("configuracoes")}
                className={cn(
                  "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                  tab === "configuracoes"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Settings2 className="size-4 shrink-0" />
                Configurações
              </button>
            </div>
            {tab === "carteira" ? <OnlinePaymentsRefresh organizationId={org.id} /> : null}
          </div>

          {/* Tab Content */}
          {tab === "carteira" ? (
            <SubaccountPanel organizationId={org.id} />
          ) : (
            <OnlinePaymentsSettingsTab
              organization={org}
              settings={onlineSettings}
              canManage={canManage}
            />
          )}

          {/* Logo depois de ativar: um passo por aba e por funcao, uma vez por navegador. */}
          {tab === "carteira" && !tourSeen && !tourClosed ? (
            <ProductTour
              steps={tourSteps({ canWithdraw: isOwner, canStatement: can("finance:view") })}
              onClose={closeTour}
              mobileMenuStep={false}
            />
          ) : null}

          {/* Quick Transfer Dialog from header */}
          <SubaccountTransferDialog
            open={quickTransferOpen}
            onOpenChange={setQuickTransferOpen}
            organizationId={org.id}
            availableCents={availableCents}
            defaultPixKey={onlineSettings?.pixKey}
          />
        </div>
      )}
    </>
  );
}

/** Ultimos 6 meses ("2026-10", "2026-09"...), do atual para tras. */
function recentCompetences(count = 6): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

/** Extrato da conta de recebimento em PDF, por mes (gerado no servidor). */
function StatementMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-1.5" data-tour="op-statement">
          <FileText className="size-4" />
          Extrato em PDF
          {/* A seta mostra que ha escolha de mes (achado 63). */}
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {recentCompetences().map((competence) => (
          <DropdownMenuItem key={competence} asChild>
            <a href={`/api/documents/online-payments?competencia=${competence}`} target="_blank" rel="noopener">
              {competenceLongLabel(competence)}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
