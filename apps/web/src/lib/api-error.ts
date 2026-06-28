import { isApiError, type ApiErrorCampo } from "@/types";

/** Extrai a mensagem amigavel de um erro de service, com fallback. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.mensagem;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Erros por campo (validacao do "servidor"), se houver. */
export function getFieldErrors(error: unknown): ApiErrorCampo[] | undefined {
  return isApiError(error) ? error.campos : undefined;
}
