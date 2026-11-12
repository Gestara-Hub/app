import { forbiddenError } from "@gestarahub/core/api-error";
import { runAction, type ActionResult } from "../server/action";
import { requireTenant } from "../server/tenant";
import { resolveServiceMethod } from "./registry";
import { isConflict, runInWorld } from "./runWorld";
import { decodeArgs } from "./transport";

/** Tentativas quando outra gravacao entrou no meio (doc 15, fatia 3). */
const ATTEMPTS = 3;

function retryDelayMs(attempt: number): number {
  return Math.round(25 * attempt + Math.random() * 75 * attempt);
}

/**
 * Roda um metodo de servico do registro no servidor, sobre o espaco da sessao.
 * Porta comum da server action (`serviceAction`) e da rota `/api/svc` (leituras
 * em paralelo, 11/11/2026): mesma sessao, permissao, recorte e repeticao.
 */
export async function runServiceMethod(method: string, args: unknown[]): Promise<ActionResult<unknown>> {
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
        // Espera curta e aleatoria (11/11/2026): duas gravacoes que bateram e
        // repetem juntas na hora batem de novo (pico na chamada, varios
        // professores ao mesmo tempo). 25 a 150 ms, maior a cada tentativa.
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt)));
      }
    }
  }, method);
}
