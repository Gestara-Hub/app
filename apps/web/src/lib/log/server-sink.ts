import { AsyncLocalStorage } from "node:async_hooks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ErrorEntry } from "./index";

/**
 * Destino dos erros no servidor (doc technical/21): a tabela `error_logs`
 * (migracao 47), agrupada por impressao digital. Modulo so do servidor, ligado
 * no `instrumentation.ts`.
 *
 * Escopo da requisicao: `runAction` abre um escopo e `requireTenant` anota nele
 * o espaco e o usuario da sessao. Assim qualquer `logError` dentro da acao
 * grava com o espaco certo, sem passar o contexto de mao em mao. O espaco vem
 * sempre da sessao ou de quem chama no servidor (rotina), nunca do navegador.
 */

interface ErrorScope {
  organizationId?: string;
  userId?: string;
}

const scope = new AsyncLocalStorage<ErrorScope>();

/** Roda `fn` num escopo de erro novo (uma acao, uma rota). */
export function runWithErrorScope<T>(fn: () => Promise<T>): Promise<T> {
  return scope.run({}, fn);
}

/** Anota o espaco e o usuario da sessao no escopo da requisicao (se houver). */
export function setErrorScope(values: ErrorScope): void {
  const current = scope.getStore();
  if (current) Object.assign(current, values);
}

export async function recordErrorToDb(entry: ErrorEntry): Promise<void> {
  const current = scope.getStore();
  const { error } = await createSupabaseAdminClient().rpc("record_error", {
    p_organization_id: entry.organizationId ?? current?.organizationId ?? null,
    p_fingerprint: entry.fingerprint,
    p_source: entry.source,
    p_level: entry.level,
    p_event: entry.event,
    p_message: entry.message,
    p_stack: entry.stack ?? null,
    p_context: entry.context ?? {},
    p_reference: entry.reference,
    p_user_id: entry.userId ?? current?.userId ?? null,
  });
  // Sem logError aqui: falhar ao gravar o erro nao pode gerar outro registro.
  if (error) console.error(`[log] erro não gravado no banco (código ${entry.reference}): ${error.message}`);
}
