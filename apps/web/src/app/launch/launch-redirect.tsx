"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LaunchSplashContent, markLaunchSplash } from "@/components/layout/launch-splash";

const HOME = "/dashboard";

/**
 * Pede o Painel assim que a abertura aparece: a logo fica na tela enquanto os
 * dados chegam (sem sessao, o proxy leva a entrada). Rede lenta: depois de
 * alguns segundos, um link para tentar de novo.
 */
export function LaunchRedirect() {
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    // O painel segue com a logo ate a primeira tela ter os dados.
    markLaunchSplash();
    router.replace(HOME);
    const timer = setTimeout(() => setSlow(true), 8_000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <LaunchSplashContent>
      {slow ? (
        <Link href={HOME} replace className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Demorando? Toque para abrir
        </Link>
      ) : null}
    </LaunchSplashContent>
  );
}
