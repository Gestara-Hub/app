"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { markHistoryPop, recordNavigation } from "@/lib/navigation-history";

/** Anota cada rota visitada no app no painel (ver `lib/navigation-history`). */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    // O popstate chega antes da troca de rota: marca que ela veio do historico.
    window.addEventListener("popstate", markHistoryPop);
    return () => window.removeEventListener("popstate", markHistoryPop);
  }, []);
  useEffect(() => {
    recordNavigation(pathname);
  }, [pathname]);
  return null;
}
