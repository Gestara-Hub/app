"use client";

import { useEffect, useRef, useState } from "react";
import { useAppRouter } from "@/lib/use-app-router";
import { LaunchSplashContent, markLaunchSplash } from "@/components/layout/launch-splash";
import { Button } from "@/components/ui/button";
import { markRestoredOwner, restorableRoute } from "@/lib/last-route";

const HOME = "/dashboard";

/**
 * Pede a primeira tela assim que a abertura aparece: a ultima tela vista nesta
 * conta (ate 7 dias, `lib/last-route`) ou o Painel. A logo fica na tela
 * enquanto os dados chegam (sem sessao, o proxy leva a entrada). Rede lenta:
 * depois de alguns segundos, um botao para tentar de novo.
 */
export function LaunchRedirect() {
  const router = useAppRouter();
  const [slow, setSlow] = useState(false);
  const targetRef = useRef(HOME);

  useEffect(() => {
    const last = restorableRoute();
    if (last) {
      targetRef.current = last.path;
      // O app confere se a conta da sessao e a mesma que viu a tela.
      markRestoredOwner(last.owner);
    }
    // A primeira tela segue com a logo ate ter os dados.
    markLaunchSplash();
    router.replace(targetRef.current);
    const timer = setTimeout(() => setSlow(true), 8_000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <LaunchSplashContent>
      {slow ? (
        <Button
          type="button"
          variant="link"
          className="text-sm font-normal text-muted-foreground"
          onClick={() => router.replace(targetRef.current)}
        >
          Demorando? Toque para abrir
        </Button>
      ) : null}
    </LaunchSplashContent>
  );
}
