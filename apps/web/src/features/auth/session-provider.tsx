"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { can as canFn } from "@/lib/permissions";
import type { Permission, UserView } from "@/types";

interface SessionContextValue {
  user: UserView;
  can: (permission: Permission) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Prove o usuario logado (resolvido no server) e um `can()` vinculado ao perfil
 * dele. Seedado por `app/(app)/layout.tsx` via prop — o client NUNCA le o cookie
 * (httpOnly). Substitui o antigo `MOCK_USER`.
 */
export function SessionProvider({
  user,
  children,
}: {
  user: UserView;
  children: ReactNode;
}) {
  const value = useMemo<SessionContextValue>(
    () => ({ user, can: (permission) => canFn(user, permission) }),
    [user],
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession deve ser usado dentro de <SessionProvider>.");
  }
  return ctx;
}

export function useCurrentUser(): UserView {
  return useSession().user;
}

export function useCan(): (permission: Permission) => boolean {
  return useSession().can;
}
