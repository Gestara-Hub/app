import { isApiError, type ApiErrorField } from "@/types";

/** Extrai a mensagem amigavel de um erro de service, com fallback. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Erros por campo (validacao do "servidor"), se houver. */
export function getFieldErrors(error: unknown): ApiErrorField[] | undefined {
  return isApiError(error) ? error.fields : undefined;
}
