"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  QueryClientProvider,
  useQuery,
  type QueryClient,
} from "@tanstack/react-query";
import { can as canFn } from "@/lib/permissions";
import { createQueryClient } from "@/lib/providers";
import { queryKeys } from "@/lib/queryKeys";
import { setCurrentActor } from "@/mocks/currentActor";
import { setActiveOrganization } from "@/mocks/store";
import { usersService } from "@/services/usersService";
import { refreshSession, signOut } from "@/app/(auth)/actions";
import {
  isApiError,
  type OperationalModel,
  type Permission,
  type UserView,
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
 *
 * Cache de queries POR SESSAO (org + usuario): ao trocar de usuario/organizacao
 * o QueryClient e trocado no mesmo render, antes da arvore nova montar — a org
 * nova nunca enxerga dados da anterior (as keys nao carregam o tenant).
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
  // Sincrono (nao em effect) para valer ja no 1o render, antes das queries.
  if (typeof window !== "undefined") {
    setActiveOrganization(user.organizationId);
  }

  const sessionKey = `${user.organizationId}:${user.id}`;
  const [session, setSession] = useState<{ key: string; client: QueryClient }>(
    () => ({ key: sessionKey, client: createQueryClient() }),
  );
  // Estado derivado: sessao nova -> QueryClient novo ja neste render.
  let current = session;
  if (session.key !== sessionKey) {
    current = { key: sessionKey, client: createQueryClient() };
    setSession(current);
  }
  const queryClient = current.client;

  // Descarta o cache da sessao anterior (nao no cleanup: o StrictMode roda
  // mount/cleanup/mount e limparia o cache vivo).
  const prevClientRef = useRef(queryClient);
  useEffect(() => {
    const prev = prevClientRef.current;
    if (prev !== queryClient) {
      prev.clear();
      prevClientRef.current = queryClient;
    }
  }, [queryClient]);

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
    <QueryClientProvider client={queryClient}>
      <SessionContext.Provider value={value}>
        <SessionSync user={user} />
        {children}
      </SessionContext.Provider>
    </QueryClientProvider>
  );
}

// Campos das claims que, se mudarem no store, exigem regravar o cookie.
function sessionSignature(u: UserView): string {
  return JSON.stringify([
    u.name,
    u.email,
    u.profile,
    u.status,
    u.professionalId ?? "",
    u.professional?.name ?? "",
  ]);
}

/**
 * Mantem o cookie alinhado ao registro do usuario no store (client-side,
 * localStorage). O cookie e um snapshot do login: se o proprio registro mudou
 * (nome, perfil, vinculo), regrava as claims e recarrega o layout server; se foi
 * inativado ou sumiu (ex.: "Zerar mocks"), encerra a sessao em vez de agir com
 * claims velhas. Refaz a checagem sempre que `users` e invalidado.
 */
function SessionSync({ user }: { user: UserView }) {
  const router = useRouter();
  const handledRef = useRef<string | null>(null);
  const { data, error } = useQuery({
    queryKey: queryKeys.users.detail(user.id),
    queryFn: () => usersService.getById(user.id),
  });

  useEffect(() => {
    const notFound = isApiError(error) && error.code === "NOT_FOUND";
    const inactive = data?.status === "inactive";
    if (notFound || inactive) {
      if (handledRef.current === "signout") return;
      handledRef.current = "signout";
      void signOut();
      return;
    }
    if (!data) return;
    const signature = sessionSignature(data);
    if (signature === sessionSignature(user)) return;
    if (handledRef.current === signature) return;
    handledRef.current = signature;
    void refreshSession(data).then(() => router.refresh());
  }, [data, error, user, router]);

  return null;
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
