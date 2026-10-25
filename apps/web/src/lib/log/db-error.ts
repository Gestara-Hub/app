/**
 * Erro de banco com o detalhe que o Supabase/Postgres devolve (código, detalhe e
 * dica), em vez de só a mensagem: o registro de erros guarda a causa
 * (doc technical/21), e é o que diz POR QUE a consulta falhou (violação de
 * regra, coluna que falta, permissão). Uso:
 *
 *   if (error) throw dbError("world: leitura da versão", error);
 */
interface DatabaseErrorLike {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

export function dbError(where: string, error: DatabaseErrorLike): Error {
  // O código vai DENTRO da causa, não no `Error`: um `Error` com `.code` passa por
  // erro de regra em `isApiError` e a ação o devolveria cru, sem registrar.
  const cause: Record<string, string> = {};
  if (error.code) cause.code = error.code;
  if (error.details) cause.details = error.details;
  if (error.hint) cause.hint = error.hint;
  return new Error(`${where}: ${error.message}`, Object.keys(cause).length > 0 ? { cause } : undefined);
}
