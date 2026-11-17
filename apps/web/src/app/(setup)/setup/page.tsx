import { Suspense } from "react";
import { BusinessSetupWizard, SetupRouteGuard, SetupRouteSkeleton } from "@/features/onboarding";

export default function SetupPage() {
  return (
    <SetupRouteGuard>
      {/* O passo vem da URL (?passo=2). */}
      <Suspense fallback={<SetupRouteSkeleton />}>
        <BusinessSetupWizard />
      </Suspense>
    </SetupRouteGuard>
  );
}
