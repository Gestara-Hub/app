import type { Id } from "@gestarahub/contracts";
import { store } from "@/services/world/store";
import { notFoundError } from "@/services/world/ops";
import { dateInSpace } from "@gestarahub/core/date";

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export const NOT_FOUND = "Cliente não encontrado.";

export function todayISO(): string {
  return dateInSpace();
}

export async function ensureClientInStore(id: Id): Promise<number> {
  const idx = store.clients.findIndex((c) => c.id === id);
  if (idx === -1) throw notFoundError(NOT_FOUND);
  return idx;
}
