import { isApiError, type ApiError } from "@gestarahub/contracts";
import { networkError } from "@gestarahub/core/api-error";
import { noteActionResult } from "@/lib/breadcrumbs";
import { referenceOf } from "@/lib/error-reference";
import { reportError, withErrorScope } from "@/lib/log";
import { isSessionExpiredError, leaveExpiredSession } from "@/lib/session-expired";

/**
 * Resultado de server action (doc 15, fatia 2). Erro lancado numa action chega
 * ao navegador sem a mensagem em producao, entao o servidor devolve o
 * `ApiError` como valor e o servico do navegador relanca com `unwrap`.
 */
export type ActionResult<T> = { ok: true; data: T; event?: string } | { ok: false; error: ApiError; event?: string };

/**
 * No servidor: roda a action e transforma erro em valor. Erro inesperado (nao
 * e regra de negocio) vai para o registro de erros (doc technical/21) com o
 * espaco e o usuario da sessao, e a mensagem ao usuario leva o codigo do
 * registro: a queixa "deu erro, codigo K7Q2M9XD" leva direto a linha certa.
 */
export async function runAction<T>(fn: () => Promise<T>, event = "action"): Promise<ActionResult<T>> {
  return withErrorScope(async () => {
    try {
      return { ok: true as const, data: await fn(), event };
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
          event,
        };
      }
      const reference = await reportError(event, error);
      const generic = networkError();
      return { ok: false as const, error: { ...generic, message: `${generic.message} Código do erro: ${reference}.` }, event };
    }
  });
}

/** No navegador: devolve o dado ou relanca o `ApiError` da action. */
export async function unwrap<T>(result: Promise<ActionResult<T>>): Promise<T> {
  const settled = await result;
  // Rastro de passos (doc technical/21): anota a ação e, se foi erro com código, manda os passos.
  noteActionResult(settled, settled.ok ? undefined : referenceOf(settled.error.message));
  if (!settled.ok) {
    // Sessao do banco vencida: login com o aviso (antes a tela ficava vazia).
    if (isSessionExpiredError(settled.error)) leaveExpiredSession();
    throw settled.error;
  }
  return settled.data;
}
