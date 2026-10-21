"use server";

import { forbiddenError } from "@gestarahub/core/api-error";
import { runAction, type ActionResult } from "../server/action";
import { requireTenant } from "../server/tenant";
import { resolveServiceMethod } from "./registry";
import { runInWorld } from "./runWorld";

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
    return runInWorld(ctx, () => resolved.run(...(Array.isArray(args) ? args : [])));
  });
}
