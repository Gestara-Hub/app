import { Suspense } from "react";
import { BusinessSetupWizard, SetupRouteGuard } from "@/features/onboarding";

export default function SetupPage() {
  return (
    <SetupRouteGuard>
      {/* O passo vem da URL (?passo=2). */}
      <Suspense fallback={null}>
        <BusinessSetupWizard />
      </Suspense>
    </SetupRouteGuard>
  );
}
