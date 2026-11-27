"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAppRouter } from "@/lib/use-app-router";
import { markHistoryPop, recordNavigation } from "@/lib/navigation-history";
import { rememberRoute, takeRestoredOwner } from "@/lib/last-route";

/**
 * Anota cada rota visitada no app (ver `lib/navigation-history`) e guarda a
 * ultima tela da conta para o app instalado reabrir nela (`lib/last-route`).
 */
export function NavigationTracker({ owner }: { owner: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const router = useAppRouter();
  useEffect(() => {
    // O popstate chega antes da troca de rota: marca que ela veio do historico.
    window.addEventListener("popstate", markHistoryPop);
    return () => window.removeEventListener("popstate", markHistoryPop);
  }, []);
  useEffect(() => {
    // Abertura que reabriu a tela de outra conta (outra pessoa entrou neste
    // aparelho, ou trocou de espaco): vai para o Painel.
    const restoredOwner = takeRestoredOwner();
    if (restoredOwner && restoredOwner !== owner) router.replace("/dashboard");
  }, [owner, router]);
  useEffect(() => {
    recordNavigation(pathname);
  }, [pathname]);
  useEffect(() => {
    rememberRoute(owner, pathname, search);
  }, [owner, pathname, search]);
  return null;
}
