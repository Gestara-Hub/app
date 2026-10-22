import { isSupabaseOrganization } from "@/lib/session";
import { inServerWorld, store } from "./store";
import { unwrap } from "../server/action";
import { serviceAction } from "./serviceActions";
import { encodeArgs } from "./transport";

/**
 * Conta real no navegador: o servico nao roda aqui, vai para o servidor
 * (`serviceAction`), que roda a mesma regra sobre o banco. No servidor (dentro
 * do espaco da requisicao) e na demonstracao, roda local.
 */
export function delegatesToServer(): boolean {
  return realAccountInBrowser();
}

/**
 * Conta real fora do espaco da requisicao do servidor: e onde os caminhos
 * antigos de banco dos servicos ainda valem. Dentro do servidor, o servico
 * usa o `store` (o espaco ja carregado do banco).
 */
export function realAccountInBrowser(organizationId: string = store.organization.id): boolean {
  return isSupabaseOrganization(organizationId) && !inServerWorld();
}

/** Os metodos que vao para o servidor precisam ser assincronos. */
type AsyncOnly<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => unknown ? (...args: never[]) => Promise<unknown> : T[K];
};

/**
 * Embrulha os metodos do servico: na conta real no navegador, cada chamada
 * vira `serviceAction("<namespace>.<metodo>", args)`. `browserOnly` ficam no
 * navegador (arquivo, configuracao do gateway, metodos sincronos).
 */
export function delegateAll<T extends object, B extends keyof T & string = never>(
  namespace: string,
  service: T & AsyncOnly<Omit<T, B>>,
  browserOnly: B[] = [],
): T {
  const wrapped: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(service)) {
    if (typeof value !== "function" || (browserOnly as string[]).includes(name)) {
      wrapped[name] = value;
      continue;
    }
    const method = value as (...args: unknown[]) => unknown;
    wrapped[name] = (...args: unknown[]) =>
      delegatesToServer()
        ? unwrap(serviceAction(`${namespace}.${name}`, encodeArgs(args) as unknown[]))
        : method.apply(service, args);
  }
  return wrapped as T;
}
