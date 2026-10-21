import { isApiError, type ApiError, type ApiErrorCode, type ApiErrorField } from "@gestarahub/contracts";

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

/** Erro de servico no formato do contrato (objeto simples: atravessa a server action). */
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

export function notFoundError(message = "Registro não encontrado."): ApiError {
  return apiError("NOT_FOUND", message, { httpStatus: 404 });
}

export function validationError(fields: ApiErrorField[]): ApiError {
  return apiError("VALIDATION", "Verifique os campos destacados.", {
    fields,
    httpStatus: 422,
  });
}

export function forbiddenError(message = "Você não tem permissão para esta ação."): ApiError {
  return apiError("FORBIDDEN", message, { httpStatus: 403 });
}

export function networkError(): ApiError {
  return apiError(
    "NETWORK",
    "Não foi possível concluir a operação. Tente novamente.",
    { httpStatus: 500 },
  );
}
