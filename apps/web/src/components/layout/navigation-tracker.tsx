"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordNavigation } from "@/lib/navigation-history";

/** Anota cada rota visitada no app (ver `lib/navigation-history`). */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    recordNavigation(pathname);
  }, [pathname]);
  return null;
}
