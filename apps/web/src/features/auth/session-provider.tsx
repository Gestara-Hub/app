"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { can as canFn } from "@/lib/permissions";
import { setCurrentActor } from "@/mocks/currentActor";
import { setActiveOrganization } from "@/mocks/store";
import type {
  OperationalModel,
  Permission,
  UserView,
} from "@gestarahub/contracts";

interface SessionContextValue {
  user: UserView;
  can: (permission: Permission) => boolean;
  /** Modelo operacional do tenant atual — a nav/shell derivam dele. */
  model: OperationalModel;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Prove o usuario logado (resolvido no server) e um `can()` vinculado ao perfil
 * dele. Seedado por `app/(app)/layout.tsx` via prop — o client NUNCA le o cookie
 * (httpOnly). Substitui o antigo `MOCK_USER`.
 */
export function SessionProvider({
  user,
  model,
  children,
}: {
  user: UserView;
  model: OperationalModel;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const prevOrgRef = useRef(user.organizationId);

  // Sincrono (nao em effect) para valer ja no 1o render, antes das queries.
  if (typeof window !== "undefined") {
    setActiveOrganization(user.organizationId);
  }

  // Se a organização mudou, limpa o cache de queries para não vazar dados
  useEffect(() => {
    if (prevOrgRef.current !== user.organizationId) {
      prevOrgRef.current = user.organizationId;
      queryClient.clear();
    }
  }, [user.organizationId, queryClient]);
  const value = useMemo<SessionContextValue>(
    () => ({ user, can: (permission) => canFn(user, permission), model }),
    [user, model],
  );
  // Publica o ator ambiente lido pela camada de services (auditoria carimba o
  // autor de cada mutacao sem receber o ator por parametro). Espelha o principal
  // do request que o backend real resolveria do token.
  useEffect(() => {
    setCurrentActor({ userId: user.id, name: user.name, profile: user.profile });
    return () => setCurrentActor(null);
  }, [user]);
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

export function useModel(): OperationalModel {
  return useSession().model;
}
