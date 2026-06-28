import type {
  ApiError,
  ApiErrorCampo,
  ApiErrorCodigo,
  DateTimeISO,
  Id,
} from "@/types";
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
  codigo: ApiErrorCodigo,
  mensagem: string,
  options?: { campos?: ApiErrorCampo[]; statusHttp?: number },
): ApiError {
  return {
    codigo,
    mensagem,
    campos: options?.campos,
    statusHttp: options?.statusHttp,
  };
}

export function networkError(): ApiError {
  return apiError(
    "NETWORK",
    "Não foi possível concluir a operação. Tente novamente.",
    { statusHttp: 500 },
  );
}

export function notFoundError(mensagem = "Registro não encontrado."): ApiError {
  return apiError("NOT_FOUND", mensagem, { statusHttp: 404 });
}

export function validationError(campos: ApiErrorCampo[]): ApiError {
  return apiError("VALIDATION", "Verifique os campos destacados.", {
    campos,
    statusHttp: 422,
  });
}

// --- Simulacao de latencia e erro de leitura -------------------------------

/** Leitura simulada: latencia + chance de erro de rede (taxaErroLeitura). */
export async function simulateRead<T>(produce: () => T): Promise<T> {
  await sleep(mockConfig.latenciaMs);
  if (
    mockConfig.taxaErroLeitura > 0 &&
    Math.random() < mockConfig.taxaErroLeitura
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
  await sleep(mockConfig.latenciaMs);
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
