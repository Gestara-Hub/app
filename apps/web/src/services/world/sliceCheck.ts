import type { AuditActor } from "@gestarahub/contracts";
import { getCurrentActor } from "./actor";
import { runScoped } from "./scope";
import { canonical, WORLD_COLLECTIONS, type Row } from "./tables";
import { presentValues, SINGLE_KEYS, sliceWorld, type MethodSlice, type SliceLoader } from "./slices";
import { store } from "./store";

/**
 * Conferencia do recorte nos testes (doc 19, fase 2; `WORLD_SLICE_CHECK=1`):
 * antes de cada chamada de um metodo com recorte, roda a mesma chamada duas
 * vezes sobre copias do espaco do teste, uma com o espaco inteiro e outra so
 * com o recorte, e exige o mesmo resultado (ou o mesmo erro) e as mesmas
 * gravacoes. Ids novos saem iguais nas duas (sequencia fixa). So dos testes.
 */

/** Chaves do espaco copiadas para a conferencia (as do mock alem das do banco). */
const WORLD_KEYS = [
  ...WORLD_COLLECTIONS.map((c) => c.key),
  "services",
  "appointments",
  "timeBlocks",
  "series",
  "recurringAuthorizations",
  "certificateTemplate",
];

const FALLBACK_ACTOR: AuditActor = { userId: "usr-slice-check", name: "Conferência", profile: "owner" };

function snapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of WORLD_KEYS) {
    const value = (store as unknown as Record<string, unknown>)[key];
    if (value !== undefined) out[key] = structuredClone(value);
  }
  return out;
}

function identityOf(key: string, row: Row): string {
  const collection = WORLD_COLLECTIONS.find((c) => c.key === key);
  return String(row[collection?.identity ?? "id"]);
}

/** Linhas novas, mudadas e apagadas de uma colecao (id -> texto canonico; null = apagada). */
function changesOf(key: string, before: unknown, after: unknown): Map<string, string | null> {
  const changes = new Map<string, string | null>();
  // Lista que ainda nao existia no mock (a regra cria na hora) conta como vazia.
  if (WORLD_COLLECTIONS.find((c) => c.key === key)?.kind === "list") {
    before = before ?? [];
    after = after ?? [];
  }
  if (!Array.isArray(before) || !Array.isArray(after)) {
    if (canonical(before ?? null) !== canonical(after ?? null)) changes.set("(linha única)", canonical(after ?? null));
    return changes;
  }
  const old = new Map((before as Row[]).map((row) => [identityOf(key, row), canonical(row)]));
  for (const row of after as Row[]) {
    const id = identityOf(key, row);
    const text = canonical(row);
    if (old.get(id) !== text) changes.set(id, text);
    old.delete(id);
  }
  for (const id of old.keys()) changes.set(id, null);
  return changes;
}

/** Carregador em memoria: filtra a copia do espaco inteiro como o banco filtraria. */
function memoryLoader(full: Record<string, unknown>, loaded: Map<string, Row[] | Row | undefined>): SliceLoader {
  const merge = (key: string, rows: Row[]) => {
    const current = (loaded.get(key) as Row[] | undefined) ?? [];
    const seen = new Set(current.map((row) => identityOf(key, row)));
    loaded.set(key, [...current, ...rows.filter((row) => !seen.has(identityOf(key, row)))]);
    return rows;
  };
  return {
    async all(key) {
      return merge(key, structuredClone((full[key] as Row[] | undefined) ?? []));
    },
    async where(key, field, values) {
      const wanted = new Set(presentValues(values));
      const rows = ((full[key] as Row[] | undefined) ?? []).filter((row) => wanted.has(String(row[field])));
      return merge(key, structuredClone(rows));
    },
    none(key) {
      if (!loaded.has(key)) loaded.set(key, []);
    },
  };
}

let sequence = 0;
/** Ids iguais nas duas rodadas: troca o gerador por uma sequencia enquanto a rodada corre. */
async function withSequentialIds<T>(fn: () => Promise<T>): Promise<T> {
  const cryptoObject = globalThis.crypto as Crypto & { randomUUID: () => string };
  const original = cryptoObject.randomUUID;
  sequence = 0;
  Object.defineProperty(cryptoObject, "randomUUID", {
    configurable: true,
    value: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
  });
  try {
    return await fn();
  } finally {
    Object.defineProperty(cryptoObject, "randomUUID", { configurable: true, value: original });
  }
}

type Outcome = { ok: true; value: string } | { ok: false; error: string };

async function run(world: Record<string, unknown>, call: () => Promise<unknown>): Promise<Outcome> {
  const actor = getCurrentActor() ?? FALLBACK_ACTOR;
  return withSequentialIds(async () => {
    try {
      const value = await runScoped({ store: world as never, actor, effects: [] }, call);
      return { ok: true, value: canonical(value ?? null) };
    } catch (error) {
      const e = error as { code?: string; message?: string };
      return { ok: false, error: `${e.code ?? ""} ${e.message ?? String(error)}` };
    }
  });
}

/** Lanca se o recorte do metodo nao reproduz o espaco inteiro nesta chamada. */
export async function checkSlice(name: string, slice: MethodSlice, args: unknown[], call: () => Promise<unknown>): Promise<void> {
  const base = snapshot();

  const fullWorld = structuredClone(base);
  const fullOutcome = await run(fullWorld, call);

  const loaded = new Map<string, Row[] | Row | undefined>();
  for (const key of SINGLE_KEYS) loaded.set(key, structuredClone(base[key]) as Row | undefined);
  await slice(structuredClone(args), memoryLoader(base, loaded));
  const sliceBefore = new Map([...loaded].map(([key, value]) => [key, structuredClone(value)]));
  // Colecoes so do mock (agenda, Pix Automatico): iguais as do espaco inteiro (no servidor sao vazias).
  const mockOnly = Object.fromEntries(
    ["services", "appointments", "timeBlocks", "series", "recurringAuthorizations", "certificateTemplate"].map((key) => [key, structuredClone(base[key])]),
  );
  const slicedWorld = sliceWorld(loaded, mockOnly) as unknown as Record<string, unknown>;
  const sliceOutcome = await run(slicedWorld, call);

  const where = `[recorte] ${name}`;
  if (!sliceOutcome.ok && /fora do recorte/.test(sliceOutcome.error)) throw new Error(`${where}: ${sliceOutcome.error}`);
  if (fullOutcome.ok !== sliceOutcome.ok) {
    throw new Error(`${where}: espaço inteiro ${fullOutcome.ok ? "deu certo" : `falhou (${(fullOutcome as { error: string }).error})`}, recorte ${sliceOutcome.ok ? "deu certo" : `falhou (${(sliceOutcome as { error: string }).error})`}`);
  }
  if (fullOutcome.ok && sliceOutcome.ok && fullOutcome.value !== sliceOutcome.value) {
    throw new Error(`${where}: resultado diferente do espaço inteiro`);
  }
  if (!fullOutcome.ok && !sliceOutcome.ok && fullOutcome.error !== sliceOutcome.error) {
    throw new Error(`${where}: erro diferente (inteiro: ${fullOutcome.error} | recorte: ${sliceOutcome.error})`);
  }
  for (const collection of WORLD_COLLECTIONS) {
    const key = collection.key;
    const full = changesOf(key, base[key], fullWorld[key]);
    if (!loaded.has(key)) {
      if (full.size > 0) throw new Error(`${where}: grava em "${key}", que ficou fora do recorte`);
      continue;
    }
    const sliced = changesOf(key, sliceBefore.get(key), slicedWorld[key]);
    const fullText = canonical(Object.fromEntries(full));
    const slicedText = canonical(Object.fromEntries(sliced));
    if (fullText !== slicedText) throw new Error(`${where}: gravações diferentes em "${key}"`);
  }
}
