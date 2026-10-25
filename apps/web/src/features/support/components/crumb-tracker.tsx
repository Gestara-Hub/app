"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { normalizePath, pushCrumb } from "@/lib/breadcrumbs";

/** Anota cada tela aberta no rastro de passos (doc technical/21). Não desenha nada. */
export function CrumbTracker() {
  const pathname = usePathname();
  useEffect(() => {
    pushCrumb("nav", normalizePath(pathname));
  }, [pathname]);
  return null;
}
