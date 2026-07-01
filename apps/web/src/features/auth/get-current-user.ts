import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { store } from "@/mocks/store";
import type { UserView } from "@/types";

/**
 * Resolve o usuario logado no SERVER: le o `userId` do cookie e busca no store.
 * Server-only (usa `next/headers`) — e a unica ponte permitida a tocar o store
 * fora dos services (infra de sessao). O seed determinístico garante que este
 * lookup case com o `SessionProvider` no client.
 */
export async function getCurrentUser(): Promise<UserView | null> {
  const userId = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!userId) return null;

  const user = store.users.find((u) => u.id === userId);
  if (!user) return null;

  const professional = user.professionalId
    ? store.professionals.find((p) => p.id === user.professionalId)
    : undefined;

  return {
    ...user,
    professional: professional
      ? { id: professional.id, name: professional.name, status: professional.status }
      : undefined,
  };
}
