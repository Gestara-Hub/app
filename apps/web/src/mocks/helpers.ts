import { networkError } from "@gestarahub/core/api-error";
import { readOp, setLocalOps, writeOp } from "@/services/world/ops";
import { mockConfig } from "./config";
import { persist, syncFromStorage } from "./store";

/**
 * Comportamento do mundo local (testes de regra e barbearia de demonstracao):
 * latencia simulada, erro de rede opcional e persistencia no localStorage. Os
 * servicos usam `readOp`/`writeOp` de services/world/ops; este modulo os
 * registra (doc 15, fatia 4).
 */

export {
  apiError,
  networkError,
  newId,
  normalizeText,
  notFoundError,
  nowIso,
  phoneIncludes,
  textIncludes,
  validationError,
} from "@/services/world/ops";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

setLocalOps({
  /** Leitura simulada: latencia + chance de erro de rede (readErrorRate). */
  async read(produce) {
    await sleep(mockConfig.latencyMs);
    syncFromStorage();
    if (mockConfig.readErrorRate > 0 && Math.random() < mockConfig.readErrorRate) {
      throw networkError();
    }
    return await produce();
  },
  /** Escrita simulada: latencia e, apos a mutacao, persiste o mundo (no-op no Node). */
  async write(produce) {
    await sleep(mockConfig.latencyMs);
    // Grava por cima do que esta salvo agora (outra aba pode ter gravado).
    syncFromStorage();
    const result = await produce();
    persist();
    return result;
  },
  persist,
});

/** Nomes antigos (servicos do modelo de agenda). */
export const simulateRead = readOp;
export const simulateWrite = writeOp;
