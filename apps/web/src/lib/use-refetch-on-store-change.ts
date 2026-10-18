"use client";

import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { STORE_CHANGED_EVENT } from "./store-events";

/** Rebusca as consultas desta aba quando outra aba grava (lib/store-events). */
export function useRefetchOnStoreChange(client: QueryClient): void {
  useEffect(() => {
    const refresh = () => void client.invalidateQueries();
    window.addEventListener(STORE_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(STORE_CHANGED_EVENT, refresh);
  }, [client]);
}
