import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PlansPreviewView } from "@/features/subscription";
import { requirePermission } from "@/features/auth/require-permission";

export const metadata: Metadata = {
  title: "Preview de Layouts de Planos",
  description: "Laboratório de design com propostas modernas para os cards de planos.",
};

export default async function PlansPreviewPage() {
  await requirePermission("dashboard:view", "/plans/preview");

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Laboratório de Planos & Assinaturas"
        description="Avalie diferentes propostas visuais para a apresentação e venda dos planos."
      />
      <PlansPreviewView />
    </div>
  );
}
