import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { SubscriptionCheckoutView } from "@/features/subscription";
import { requirePermission } from "@/features/auth/require-permission";

export const metadata: Metadata = {
  title: "Checkout de Assinatura | GestaraHub",
  description: "Conclua a assinatura do seu plano GestaraHub com cobrança via Asaas.",
};

export default async function SubscriptionCheckoutPage() {
  await requirePermission("dashboard:view", "/plans");

  return (
    <div className="py-2">
      <Suspense
        fallback={
          <div className="max-w-6xl mx-auto space-y-6 py-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <Skeleton className="lg:col-span-7 h-[500px] rounded-2xl" />
              <Skeleton className="lg:col-span-5 h-[400px] rounded-2xl" />
            </div>
          </div>
        }
      >
        <SubscriptionCheckoutView />
      </Suspense>
    </div>
  );
}
