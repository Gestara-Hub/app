import { AsyncLocalStorage } from "node:async_hooks";
import type { AuditActor } from "@gestarahub/contracts";
import { resolveSpaceTimeZone, setSpaceTimeZoneProvider } from "@gestarahub/core/date";
import { requestTimeZone } from "@/lib/log/server-sink";
import { setActorScopeResolver } from "./actor";
import { setStoreScopeResolver } from "./store";
import type { TenantWorld } from "./types";
import { setEffectsResolver, type WorldEffect } from "./effects";

/**
 * Espaco da requisicao no servidor (doc 15, fatia 2). Dentro de `runScoped`,
 * o `store` dos servicos e o espaco carregado do banco e o ator e o usuario da
 * sessao; fora, tudo segue como no navegador. So do servidor.
 */

interface WorldScope {
  store: TenantWorld;
  actor: AuditActor;
  /** Efeitos externos para depois da gravacao (`afterWorldCommit`). */
  effects: WorldEffect[];
}

const scope = new AsyncLocalStorage<WorldScope>();

setStoreScopeResolver(() => scope.getStore()?.store);
setActorScopeResolver(() => scope.getStore()?.actor);
setEffectsResolver(() => scope.getStore()?.effects);
// Fuso do espaco: o do espaco carregado (vale tambem para rotas e rotinas, que
// nao abrem o escopo da acao), senao o anotado pela sessao.
setSpaceTimeZoneProvider(() => {
  const world = scope.getStore()?.store;
  return world ? resolveSpaceTimeZone(world.organization?.settings, world.unit?.address) : requestTimeZone();
});

// Reserva para o que ainda le o relogio local (date-fns): Brasilia, nao o UTC
// do servidor. O "hoje" das regras sai do fuso do espaco (`@gestarahub/core/date`).
process.env.TZ = "America/Sao_Paulo";

export function runScoped<T>(world: WorldScope, fn: () => Promise<T>): Promise<T> {
  return scope.run(world, fn);
}
