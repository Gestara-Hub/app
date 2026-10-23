import { isApiError, type ApiError } from "@gestarahub/contracts";
import { networkError } from "@gestarahub/core/api-error";
import { reportError, withErrorScope } from "@/lib/log";

/**
 * Resultado de server action (doc 15, fatia 2). Erro lancado numa action chega
 * ao navegador sem a mensagem em producao, entao o servidor devolve o
 * `ApiError` como valor e o servico do navegador relanca com `unwrap`.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/**
 * No servidor: roda a action e transforma erro em valor. Erro inesperado (nao
 * e regra de negocio) vai para o registro de erros (doc technical/21) com o
 * espaco e o usuario da sessao, e a mensagem ao usuario leva o codigo do
 * registro: a queixa "deu erro, codigo K7Q2M9XD" leva direto a linha certa.
 */
export async function runAction<T>(fn: () => Promise<T>, event = "action"): Promise<ActionResult<T>> {
  return withErrorScope(async () => {
    try {
      return { ok: true as const, data: await fn() };
    } catch (error) {
      if (isApiError(error)) {
        return {
          ok: false as const,
          error: {
            code: error.code,
            message: error.message,
            fields: error.fields,
            httpStatus: error.httpStatus,
          },
        };
      }
      const reference = await reportError(event, error);
      const generic = networkError();
      return { ok: false as const, error: { ...generic, message: `${generic.message} Código do erro: ${reference}.` } };
    }
  });
}

/** No navegador: devolve o dado ou relanca o `ApiError` da action. */
export async function unwrap<T>(result: Promise<ActionResult<T>>): Promise<T> {
  const settled = await result;
  if (!settled.ok) throw settled.error;
  return settled.data;
}
