import type { Id } from "@gestarahub/contracts";
import { format } from "date-fns";
import { store } from "@/mocks/store";
import { notFoundError } from "@/mocks/helpers";

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export const NOT_FOUND = "Cliente não encontrado.";

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export async function ensureClientInStore(id: Id): Promise<number> {
  const idx = store.clients.findIndex((c) => c.id === id);
  if (idx === -1) throw notFoundError(NOT_FOUND);
  return idx;
}
