import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PlansView } from "@/features/subscription";
import { requirePermission } from "@/features/auth/require-permission";

export const metadata: Metadata = {
  title: "Planos e Assinatura",
  description: "Conheça os planos do GestaraHub e impulsione sua gestão.",
};

export default async function PlansPage() {
  await requirePermission("dashboard:view", "/plans");

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Planos e Assinatura"
        description="Escolha o plano ideal para a escala e o crescimento do seu espaço."
      />
      <PlansView />
    </div>
  );
}
