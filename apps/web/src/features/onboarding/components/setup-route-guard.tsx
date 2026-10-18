"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { firstAllowedRoute } from "@/components/layout/nav";
import { useCurrentUser, useModel } from "@/features/auth";
import { useOrganization } from "@/features/settings";

/**
 * /setup so para a dona que ainda nao concluiu a configuracao inicial. Ja
 * concluida (ou outro perfil), vai para o painel, sem refazer nem sobrescrever
 * o espaco. Decide no navegador, onde esta o dado real (o servidor so ve o
 * mundo semeado).
 */
export function SetupRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useCurrentUser();
  const model = useModel();
  const { data: organization, isSuccess } = useOrganization();
  const done =
    isSuccess && (user.profile !== "owner" || Boolean(organization?.settings?.onboardingCompleted));

  useEffect(() => {
    if (done) router.replace(firstAllowedRoute(user, model));
  }, [done, router, user, model]);

  if (!isSuccess || done) return null;
  return <>{children}</>;
}
