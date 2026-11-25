"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    router.replace(HOME);
    const timer = setTimeout(() => setSlow(true), 8_000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex h-10 flex-col items-center gap-3" role="status" aria-live="polite">
      <div className="h-1 w-24 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full w-1/3 rounded-full bg-primary motion-safe:animate-[launch-bar_1.2s_ease-in-out_infinite]" />
      </div>
      <span className="sr-only">Abrindo o GestaraHub</span>
      {slow ? (
        <Link href={HOME} replace className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Demorando? Toque para abrir
        </Link>
      ) : null}
    </div>
  );
}
