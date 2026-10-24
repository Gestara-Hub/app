import type { DateISO, Id, Plan } from "@gestarahub/contracts";
import { store } from "@/services/world/store";
import { dateInSpace } from "@gestarahub/core/date";

/**
 * Modelo 3 (financeiro). Registro/status, sem gateway. As mensalidades seguem
 * as Regras de Cobranca (antecipado/depois do uso x proporcional/mes cheio),
 * calculadas pelo motor unico em @gestarahub/core/billing. Assinatura pausada
 * ou cancelada nao gera cobranca.
 */

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function todayISO(): DateISO {
  return dateInSpace();
}

export function studentName(id: Id): string {
  return store.clients.find((c) => c.id === id)?.name ?? "";
}
export function planOf(id?: Id): Plan | undefined {
  return id ? store.plans.find((p) => p.id === id) : undefined;
}
export function className(id?: Id): string | undefined {
  return id ? store.classGroups.find((t) => t.id === id)?.name : undefined;
}

/** "2026-10" -> "10/2026". */
export function competenceLabel(competence: string): string {
  const [year, month] = competence.split("-");
  return `${month}/${year}`;
}
