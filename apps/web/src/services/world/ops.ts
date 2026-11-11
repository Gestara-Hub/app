import type { DateTimeISO } from "@gestarahub/contracts";
import { inServerWorld } from "./store";

/**
 * Ferramentas dos servicos (doc 15, fatia 4): id, data, erros, busca de texto
 * e as operacoes de leitura e gravacao. No servidor, `readOp`/`writeOp` so
 * rodam a regra (quem grava e o `runWorld`). Fora dele, o mundo local do mock
 * (testes de regra, barbearia de demonstracao) registra latencia e
 * persistencia em `setLocalOps`.
 */

export { apiError, networkError, notFoundError, validationError } from "@gestarahub/core/api-error";
export { normalizeText, phoneIncludes, textIncludes } from "@/lib/text";

export { newId } from "@/lib/new-id";

export function nowIso(): DateTimeISO {
  return new Date().toISOString();
}

type Op = <T>(produce: () => T | Promise<T>) => Promise<T>;

let localRead: Op | null = null;
let localWrite: Op | null = null;
let localPersist: (() => void) | null = null;

export function setLocalOps(ops: { read: Op; write: Op; persist: () => void }): void {
  localRead = ops.read;
  localWrite = ops.write;
  localPersist = ops.persist;
}

/**
 * Leitura que corrigiu algo no espaco (expirou um codigo, gerou mensalidade):
 * no mundo local, grava no navegador. No servidor nao faz nada: o `runWorld`
 * grava a diferenca ao fim da action.
 */
export function persistLocal(): void {
  if (!inServerWorld()) localPersist?.();
}

/** Leitura de servico. */
export async function readOp<T>(produce: () => T | Promise<T>): Promise<T> {
  if (inServerWorld() || !localRead) return await produce();
  return localRead(produce);
}

/** Gravacao de servico (no servidor, o `runWorld` grava a diferenca no banco). */
export async function writeOp<T>(produce: () => T | Promise<T>): Promise<T> {
  if (inServerWorld() || !localWrite) return await produce();
  return localWrite(produce);
}
