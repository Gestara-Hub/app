import { BusinessSetupWizard, SetupRouteGuard } from "@/features/onboarding";

export default function SetupPage() {
  return (
    <SetupRouteGuard>
      <BusinessSetupWizard />
    </SetupRouteGuard>
  );
}
