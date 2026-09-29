import { WalletCards } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { FeatureLocked } from "@/components/shared/feature-locked";
import { requirePermission } from "@/features/auth/require-permission";
import { sessionHasFeature } from "@/features/auth/get-subscription-tier";
import { FINANCE_BENEFITS, FinanceView } from "@/features/finance";
import { can } from "@/lib/permissions";

export default async function FinancePage() {
  const user = await requirePermission("finance:view", "/finance");
  // Permissao ok; sem o recurso do plano, mostra o upsell em vez de redirecionar.
  if (!(await sessionHasFeature(user, "finance"))) {
    return (
      <>
        <PageHeader title="Financeiro" />
        <FeatureLocked
          title="Financeiro"
          description="Controle o dinheiro do seu negócio em um só lugar."
          benefits={FINANCE_BENEFITS}
          icon={<WalletCards className="size-7" aria-hidden />}
          canManagePlan={can(user, "subscription:manage")}
        />
      </>
    );
  }
  return <FinanceView />;
}
