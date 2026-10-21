import type {
  DateTimeISO,
  Id,
} from "@gestarahub/contracts";
import {
  apiError,
  networkError,
  notFoundError,
  validationError,
} from "@gestarahub/core/api-error";
import { mockConfig } from "./config";
import { persist, syncFromStorage } from "./store";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function newId(): Id {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r =
      typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
        ? crypto.getRandomValues(new Uint8Array(1))[0] & 15
        : (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowIso(): DateTimeISO {
  return new Date().toISOString();
}

// --- Fabrica de erros (formato unico, imita erro de API) -------------------

// Os construtores vivem no core, para o servidor usar os mesmos (doc 15, fatia 2).
export { apiError, networkError, notFoundError, validationError };

// --- Simulacao de latencia e erro de leitura -------------------------------

/** Leitura simulada: latencia + chance de erro de rede (readErrorRate). */
export async function simulateRead<T>(produce: () => T | Promise<T>): Promise<T> {
  await sleep(mockConfig.latencyMs);
  syncFromStorage();
  if (
    mockConfig.readErrorRate > 0 &&
    Math.random() < mockConfig.readErrorRate
  ) {
    throw networkError();
  }
  return await produce();
}

/**
 * Escrita simulada: latencia (erros de negocio/validacao vem das regras) e,
 * apos a mutacao, persiste o store (no-op no server/Node).
 */
export async function simulateWrite<T>(produce: () => T | Promise<T>): Promise<T> {
  await sleep(mockConfig.latencyMs);
  // Grava por cima do que esta salvo agora (outra aba pode ter gravado).
  syncFromStorage();
  const result = await produce();
  persist();
  return result;
}

// --- Busca textual tolerante a acentos/caixa -------------------------------
// Vive em `@/lib/text`, para o servidor usar a mesma (doc 15, fatia 2).
export { normalizeText, phoneIncludes, textIncludes } from "@/lib/text";
