"use server";

import { forbiddenError } from "@gestarahub/core/api-error";
import { runAction, type ActionResult } from "../server/action";
import { requireTenant } from "../server/tenant";
import { resolveServiceMethod } from "./registry";
import { isConflict, runInWorld } from "./runWorld";
import { decodeArgs } from "./transport";

/** Tentativas quando outra gravacao entrou no meio (doc 15, fatia 3). */
const ATTEMPTS = 3;

/**
 * Porta unica da conta real para os servicos migrados (doc 15, fatia 2): o
 * metodo roda no servidor sobre o espaco da sessao, carregado do banco, e so
 * o que ele mudou e gravado. Metodo fora do registro e recusado.
 */
export async function serviceAction(method: string, args: unknown[]): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    // Sessao primeiro: sem login, nem resolve o metodo (revisao geral de 31/10/2026, achado S10).
    const ctx = await requireTenant();
    const resolved = await resolveServiceMethod(method);
    if (!resolved) throw forbiddenError();
    if (resolved.permissions.length > 0) ctx.require(...resolved.permissions);
    const callArgs = Array.isArray(args) ? (decodeArgs(args) as unknown[]) : [];
    // Conflito de versao: roda de novo sobre o banco atual, para a regra
    // (vaga, horario, parcelas) valer sobre o estado mais novo. Metodo com
    // efeito externo antes da gravacao (gerar codigo no Asaas, enviar
    // WhatsApp) nao repete sozinho: devolve o conflito para a tela.
    for (let attempt = 1; ; attempt++) {
      try {
        return await runInWorld(
          ctx,
          () => resolved.run(...callArgs),
          // Sem recorte, o nome so serve ao log de tempo.
          resolved.slice ? { fn: resolved.slice, args: callArgs, name: method } : { name: method },
        );
      } catch (error) {
        if (!isConflict(error) || resolved.noRetry || attempt >= ATTEMPTS) throw error;
        console.warn(`[world] ${method}: conflito na tentativa ${attempt}; tentando de novo`);
      }
    }
  }, method);
}
