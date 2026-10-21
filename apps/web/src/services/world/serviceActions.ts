"use server";

import { forbiddenError } from "@gestarahub/core/api-error";
import { runAction, type ActionResult } from "../server/action";
import { requireTenant } from "../server/tenant";
import { resolveServiceMethod } from "./registry";
import { isConflict, runInWorld } from "./runWorld";

/** Tentativas quando outra gravacao entrou no meio (doc 15, fatia 3). */
const ATTEMPTS = 3;

/**
 * Porta unica da conta real para os servicos migrados (doc 15, fatia 2): o
 * metodo roda no servidor sobre o espaco da sessao, carregado do banco, e so
 * o que ele mudou e gravado. Metodo fora do registro e recusado.
 */
export async function serviceAction(method: string, args: unknown[]): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const resolved = await resolveServiceMethod(method);
    if (!resolved) throw forbiddenError();
    const ctx = await requireTenant();
    if (resolved.permissions.length > 0) ctx.require(...resolved.permissions);
    const callArgs = Array.isArray(args) ? args : [];
    // Conflito de versao: roda de novo sobre o banco atual, para a regra
    // (vaga, horario, parcelas) valer sobre o estado mais novo. Metodo com
    // efeito externo antes da gravacao (gerar codigo no Asaas, enviar
    // WhatsApp) nao repete sozinho: devolve o conflito para a tela.
    for (let attempt = 1; ; attempt++) {
      try {
        return await runInWorld(ctx, () => resolved.run(...callArgs));
      } catch (error) {
        if (!isConflict(error) || resolved.noRetry || attempt >= ATTEMPTS) throw error;
      }
    }
  });
}
