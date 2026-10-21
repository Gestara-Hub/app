import { isApiError, type ApiError } from "@gestarahub/contracts";
import { networkError } from "@gestarahub/core/api-error";

/**
 * Resultado de server action (doc 15, fatia 2). Erro lancado numa action chega
 * ao navegador sem a mensagem em producao, entao o servidor devolve o
 * `ApiError` como valor e o servico do navegador relanca com `unwrap`.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** No servidor: roda a action e transforma erro em valor. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (isApiError(error)) {
      return {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          fields: error.fields,
          httpStatus: error.httpStatus,
        },
      };
    }
    console.error("[runAction] Erro inesperado:", error);
    return { ok: false, error: networkError() };
  }
}

/** No navegador: devolve o dado ou relanca o `ApiError` da action. */
export async function unwrap<T>(result: Promise<ActionResult<T>>): Promise<T> {
  const settled = await result;
  if (!settled.ok) throw settled.error;
  return settled.data;
}
