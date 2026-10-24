"use client";

import { useState } from "react";
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
import { useCan, useHasFeature } from "@/features/auth";
import { useOrganization } from "@/features/settings";
import { cn } from "@/lib/utils";
import { SubaccountPanel } from "./subaccount-panel";
import { OnlinePaymentsOnboarding } from "./online-payments-onboarding";
import { OnlinePaymentsSettingsTab } from "./online-payments-settings-tab";
import { SubaccountTransferDialog } from "./subaccount-transfer-dialog";
import { OnlinePaymentsRefresh } from "./online-payments-refresh";
import { useSubaccountBalance } from "../hooks/use-online-payments";

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
  const orgQuery = useOrganization();
  const [quickTransferOpen, setQuickTransferOpen] = useState(false);

  const org = orgQuery.data;
  const balanceQuery = useSubaccountBalance(org?.id);
  const availableCents = balanceQuery.data?.availableForTransferCents ?? 0;

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

  if (orgQuery.isLoading) {
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

  return (
    <>
      <PageHeader
        title="Recebimentos online"
        description="Saldos das mensalidades, histórico de cobranças e saques via Pix."
      >
        <div className="flex flex-wrap items-center gap-2">
          {isSubaccountActive ? (
            <>
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
              >
                <CheckCircle2 className="size-3.5" />
                Conta ativa
              </Badge>

              {can("finance:view") ? <StatementMenu /> : null}

              {canManage ? (
                <Button
                  size="sm"
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
        </div>
      </PageHeader>

      {!isSubaccountActive ? (
        <OnlinePaymentsOnboarding
          organization={org}
          canManage={canManage}
        />
      ) : (
        <div className="space-y-5">
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
        <Button variant="outline" className="gap-1.5">
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
