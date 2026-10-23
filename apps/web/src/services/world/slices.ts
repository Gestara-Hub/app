import type { TenantWorld } from "./types";
import { WORLD_COLLECTIONS, type Row } from "./tables";

/**
 * Recorte do espaco por metodo (doc 19, fase 2). Em vez de carregar o espaco
 * inteiro, o metodo declara o que le: colecoes inteiras (pequenas: turmas,
 * modalidades) ou so as linhas de que precisa (as presencas daquela aula, os
 * pacotes daqueles alunos). O custo passa a seguir o tamanho do recorte, nao o
 * historico do espaco.
 *
 * Seguranca do recorte:
 * - coleção fora do recorte nao existe no espaco montado: ler ou gravar nela
 *   falha na hora (`SliceMissError`), nunca calcula com dado faltando;
 * - com `WORLD_SLICE_CHECK=1` (Vitest), cada chamada roda tambem com o espaco
 *   inteiro e o resultado e as gravacoes tem de ser iguais (`sliceCheck.ts`).
 */

export interface SliceLoader {
  /** Colecao inteira. */
  all(key: string): Promise<Row[]>;
  /** Linhas com `field` (nome do contrato) em `values`; soma as ja carregadas da colecao. */
  where(key: string, field: string, values: readonly (string | undefined | null)[]): Promise<Row[]>;
  /** Colecao vazia que aceita inclusoes (ex.: auditoria, so grava). */
  none(key: string): void;
}

/** Monta o recorte de uma chamada a partir dos argumentos dela. */
export type MethodSlice = (args: unknown[], load: SliceLoader) => Promise<void>;

export class SliceMissError extends Error {
  constructor(key: string) {
    super(`world: "${key}" fora do recorte deste método (declare em slices).`);
    this.name = "SliceMissError";
  }
}

/** Colecoes de uma linha so (organizacao, unidade, conexao do WhatsApp): sempre no recorte. */
export const SINGLE_KEYS = WORLD_COLLECTIONS.filter((c) => c.kind === "single").map((c) => c.key);

/** Chaves do espaco que nao vem do banco (agenda da barbearia, Pix Automatico no mock). */
const NON_DB_DEFAULTS: Record<string, unknown> = {
  services: [],
  appointments: [],
  timeBlocks: [],
  series: [],
  recurringAuthorizations: [],
};

/**
 * Espaco montado so com o recorte: as colecoes carregadas e, nas que ficaram
 * de fora, uma leitura ou gravacao que falha com `SliceMissError`.
 */
export function sliceWorld(loaded: Map<string, Row[] | Row | undefined>, extra: Record<string, unknown> = {}): TenantWorld {
  const world: Record<string, unknown> = { ...NON_DB_DEFAULTS, ...extra };
  for (const collection of WORLD_COLLECTIONS) {
    if (loaded.has(collection.key)) {
      world[collection.key] = loaded.get(collection.key);
      continue;
    }
    Object.defineProperty(world, collection.key, {
      enumerable: false,
      configurable: true,
      get() {
        throw new SliceMissError(collection.key);
      },
      set() {
        throw new SliceMissError(collection.key);
      },
    });
  }
  return world as unknown as TenantWorld;
}

/** Valores unicos e presentes (filtro `in`). */
export function presentValues(values: readonly (string | undefined | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => typeof v === "string" && v.length > 0))];
}
