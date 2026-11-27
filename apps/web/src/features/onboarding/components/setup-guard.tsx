"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAppRouter } from "@/lib/use-app-router";
import { startNavigationProgress } from "@/lib/unsaved-changes";
import { useCurrentUser } from "@/features/auth";
import { useOrganization } from "@/features/settings";

/**
 * Guarda de rota do onboarding inicial:
 * Se o proprietário do espaço ainda não concluiu o setup inicial
 * (onboardingCompleted !== true), redireciona imediatamente para /setup,
 * impedindo o acesso ao painel principal até a conclusão das etapas.
 */
export function SetupGuard({ children }: { children: React.ReactNode }) {
  const router = useAppRouter();
  const pathname = usePathname();
  const user = useCurrentUser();
  const { data: organization, isSuccess } = useOrganization();

  useEffect(() => {
    if (
      isSuccess &&
      user.profile === "owner" &&
      !organization?.settings?.onboardingCompleted &&
      pathname !== "/setup"
    ) {
      startNavigationProgress({ immediate: true });
      router.replace("/setup");
    }
  }, [isSuccess, user.profile, organization, pathname, router]);

  // Se o proprietário ainda não concluiu o setup, não renderiza as telas operacionais
  // enquanto o redirecionamento para /setup está em curso
  if (isSuccess && user.profile === "owner" && !organization?.settings?.onboardingCompleted) {
    return null;
  }

  return <>{children}</>;
}
