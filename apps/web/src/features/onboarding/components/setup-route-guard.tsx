"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { firstAllowedRoute } from "@/components/layout/nav";
import { useRouteLoadingBar } from "@/components/layout/navigation-progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { startNavigationProgress } from "@/lib/unsaved-changes";
import { useCurrentUser, useModel } from "@/features/auth";
import { useOrganization } from "@/features/settings";

/** Skeleton neutro no formato do assistente de /setup. */
export function SetupRouteSkeleton() {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col" aria-busy>
      <div className="h-1 w-full bg-muted" />
      <div className="mx-auto w-full max-w-xl px-4 pt-6 sm:pt-8">
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <div className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:py-14 space-y-6">
        <div className="flex justify-end">
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}

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
  const { data: organization, isSuccess, isError, refetch } = useOrganization();
  const done =
    isSuccess && (user.profile !== "owner" || Boolean(organization?.settings?.onboardingCompleted));

  useRouteLoadingBar((!isSuccess && !isError) || done);

  useEffect(() => {
    if (!done) return;
    startNavigationProgress({ immediate: true });
    router.replace(firstAllowedRoute(user, model));
  }, [done, router, user, model]);

  if (isError && !isSuccess) {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar as informações do seu espaço.
          </p>
          <Button type="button" variant="outline" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!isSuccess || done) return <SetupRouteSkeleton />;
  return <>{children}</>;
}
