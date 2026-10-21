import type { TenantWorld } from "./types";

/**
 * O `store` dos servicos (doc 15): um proxy para o espaco em uso.
 * - No servidor, dentro de uma action, e o espaco carregado do banco para a
 *   requisicao (`scope.ts` registra o resolvedor com AsyncLocalStorage).
 * - Fora dela, e o mundo local registrado por `@/mocks/store`: so os testes de
 *   regra e a demonstracao da barbearia (modelo de agenda, ainda sem banco).
 * Sem nenhum dos dois, o servico nao tem onde rodar.
 */

let scoped: (() => TenantWorld | undefined) | null = null;
let local: (() => TenantWorld) | null = null;

export function setStoreScopeResolver(resolver: () => TenantWorld | undefined): void {
  scoped = resolver;
}

export function setLocalWorldResolver(resolver: () => TenantWorld): void {
  local = resolver;
}

/** Rodando dentro de uma action com o espaco carregado do banco? */
export function inServerWorld(): boolean {
  return scoped?.() !== undefined;
}

function current(): TenantWorld {
  const world = scoped?.() ?? local?.();
  if (!world) throw new Error("Sem espaço carregado: o serviço roda no servidor (services/world).");
  return world;
}

export const store: TenantWorld = new Proxy({} as TenantWorld, {
  get(_target, prop) {
    return current()[prop as keyof TenantWorld];
  },
  set(_target, prop, value) {
    return Reflect.set(current(), prop, value);
  },
  has(_target, prop) {
    return prop in current();
  },
  ownKeys() {
    return Reflect.ownKeys(current());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(current(), prop);
  },
});
