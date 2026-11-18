import { isSupabaseOrganization } from "@/lib/session";
import { hasLocalWorld, inServerWorld, store } from "./store";
import { networkError } from "@gestarahub/core/api-error";
import { unwrap, type ActionResult } from "../server/action";
import { serviceAction } from "./serviceActions";
import { encodeArgs } from "./transport";

/**
 * Conta real no navegador: o servico nao roda aqui, vai para o servidor
 * (`serviceAction`), que roda a mesma regra sobre o banco. No servidor (dentro
 * do espaco da requisicao) e na demonstracao, roda local.
 */
export function delegatesToServer(): boolean {
  // Pagina publica aberta pela equipe logada (ingresso pela camera, doc 29 T4):
  // o navegador nao carrega espaco nenhum, entao nao da para perguntar qual e a
  // conta. O servidor sabe o espaco pela sessao (12/11/2026: antes o ingresso
  // mostrava "Sem espaço carregado").
  if (typeof window !== "undefined" && !inServerWorld() && !hasLocalWorld()) return true;
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

/**
 * Conferencia do recorte (doc 19, fase 2): os testes ligam com
 * `WORLD_SLICE_CHECK=1` (src/test/setup.ts). Antes de rodar um metodo local,
 * roda a mesma chamada com o espaco inteiro e com o recorte e compara.
 */
type SliceChecker = (name: string, args: unknown[], call: () => Promise<unknown>) => Promise<void>;
let sliceChecker: SliceChecker | null = null;

export function setSliceChecker(checker: SliceChecker | null): void {
  sliceChecker = checker;
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
    wrapped[name] = (...args: unknown[]) => {
      if (delegatesToServer()) {
        const encoded = encodeArgs(args) as unknown[];
        // Leitura em paralelo pela rota; gravacao pela action (uma por vez, na ordem).
        return unwrap(
          isReadMethod(name) ? fetchService(`${namespace}.${name}`, encoded) : serviceAction(`${namespace}.${name}`, encoded),
        );
      }
      if (sliceChecker && !inServerWorld()) {
        const call = () => Promise.resolve(method.apply(service, args));
        return sliceChecker(`${namespace}.${name}`, args, call).then(call);
      }
      return method.apply(service, args);
    };
  }
  return wrapped as T;
}

/**
 * Leitura pelo nome (11/11/2026): `get`, `list`, `search`, `count`, `preview`.
 * Uma leitura que tambem grava (ex.: expirar um Pix vencido) continua certa:
 * a rota roda o mesmo motor, com a mesma conferencia de versao.
 */
export function isReadMethod(name: string): boolean {
  return /^(get|list|search|count|preview)(?![a-z])/.test(name);
}

/**
 * Leituras pela rota `/api/svc`, nao pela server action: as actions de uma aba
 * rodam uma por vez e uma tela fazia ~18 leituras em fila (4 a 5 s no 4G fraco).
 */
export async function fetchService(method: string, args: unknown[]): Promise<ActionResult<unknown>> {
  const response = await fetch("/api/svc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ method, args }),
  });
  if (!response.ok) return { ok: false, error: networkError() };
  return (await response.json()) as ActionResult<unknown>;
}
