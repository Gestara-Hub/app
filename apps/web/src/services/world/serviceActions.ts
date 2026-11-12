"use server";

import type { ActionResult } from "../server/action";
import { runServiceMethod } from "./serviceRunner";

/**
 * Porta unica da conta real para os servicos migrados (doc 15, fatia 2): o
 * metodo roda no servidor sobre o espaco da sessao, carregado do banco, e so
 * o que ele mudou e gravado. Metodo fora do registro e recusado. As leituras
 * vao pela rota `/api/svc` (em paralelo); as gravacoes, por aqui.
 */
export async function serviceAction(method: string, args: unknown[]): Promise<ActionResult<unknown>> {
  return runServiceMethod(method, args);
}
