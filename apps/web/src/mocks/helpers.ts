import type {
  ApiError,
  ApiErrorCode,
  ApiErrorField,
  DateTimeISO,
  Id,
} from "@gestarahub/contracts";
import { mockConfig } from "./config";
import { persist } from "./store";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function newId(): Id {
  return crypto.randomUUID();
}

export function nowIso(): DateTimeISO {
  return new Date().toISOString();
}

// --- Fabrica de erros (formato unico, imita erro de API) -------------------

export function apiError(
  code: ApiErrorCode,
  message: string,
  options?: { fields?: ApiErrorField[]; httpStatus?: number },
): ApiError {
  return {
    code,
    message,
    fields: options?.fields,
    httpStatus: options?.httpStatus,
  };
}

export function networkError(): ApiError {
  return apiError(
    "NETWORK",
    "Não foi possível concluir a operação. Tente novamente.",
    { httpStatus: 500 },
  );
}

export function notFoundError(message = "Registro não encontrado."): ApiError {
  return apiError("NOT_FOUND", message, { httpStatus: 404 });
}

export function validationError(fields: ApiErrorField[]): ApiError {
  return apiError("VALIDATION", "Verifique os campos destacados.", {
    fields,
    httpStatus: 422,
  });
}

// --- Simulacao de latencia e erro de leitura -------------------------------

/** Leitura simulada: latencia + chance de erro de rede (readErrorRate). */
export async function simulateRead<T>(produce: () => T): Promise<T> {
  await sleep(mockConfig.latencyMs);
  if (
    mockConfig.readErrorRate > 0 &&
    Math.random() < mockConfig.readErrorRate
  ) {
    throw networkError();
  }
  return produce();
}

/**
 * Escrita simulada: latencia (erros de negocio/validacao vem das regras) e,
 * apos a mutacao, persiste o store (no-op no server/Node).
 */
export async function simulateWrite<T>(produce: () => T): Promise<T> {
  await sleep(mockConfig.latencyMs);
  const result = produce();
  persist();
  return result;
}

// --- Busca textual tolerante a acentos/caixa -------------------------------

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function textIncludes(haystack: string, needle: string): boolean {
  return normalizeText(haystack).includes(normalizeText(needle));
}
