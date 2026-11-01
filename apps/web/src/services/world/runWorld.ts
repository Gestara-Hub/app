import type { AuditActor, CertificateTemplate } from "@gestarahub/contracts";
import { apiError } from "@gestarahub/core/api-error";
import type { TenantWorld } from "./types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TenantContext } from "../server/tenant";
import type { WorldEffect } from "./effects";
import { runScoped } from "./scope";
import { presentValues, SINGLE_KEYS, SliceMissError, sliceWorld, type MethodSlice } from "./slices";
import { assertScopeField, bucketOf, rowBuckets, wholeBucket, wholeReadBucket } from "./scopes";
import { selectAllRows } from "@/lib/supabase/select-all";
import {
  canonical,
  columnOf,
  fromRow,
  matchesPartialLoad,
  sameRow,
  schemaOf,
  toRow,
  WORLD_COLLECTIONS,
  type Row,
  type WorldCollection,
} from "./tables";
import { logError, logWarn, dbError } from "@/lib/log";

/**
 * Roda um metodo de servico no servidor sobre o espaco carregado do banco e
 * grava so o que ele mudou (doc 15, fatia 2). A regra e a mesma da
 * demonstracao; muda a fonte dos dados. So do servidor.
 */

const PAGE = 1000;

interface LoadedCollection {
  collection: WorldCollection;
  /** Linhas carregadas, pela identidade. */
  raw: Map<string, Row>;
  /** Linhas carregadas normalizadas (para comparar com o que o servico deixou). */
  normalized: Map<string, Row>;
}

interface LoadedWorld {
  store: TenantWorld;
  /** Versao do espaco na leitura (world_versions); a gravacao confere. */
  version: number;
  /**
   * Baldes lidos (recorte, `scopes.ts`): a gravacao so conflita se um deles
   * mudou depois da leitura. Sem eles (espaco inteiro), qualquer gravacao conflita.
   */
  readBuckets?: number[];
  unitId: string;
  collections: LoadedCollection[];
  organizationRow: Row;
  /** De onde veio e quantas linhas (log de tempo por acao). */
  source: "recorte" | "cache" | "banco";
  rows: number;
}

/**
 * Mesma ordem das linhas em qualquer caminho (leitura do banco, cache
 * avancado depois de gravar, recorte): por identidade, comparando o texto.
 */
function byIdentity<T>(map: Map<string, T>): Map<string, T> {
  return new Map([...map].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function identityOf(collection: WorldCollection, row: Row): string {
  const column = collection.identity
    ? collection.identity.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
    : schemaOf(collection.table).primaryKey;
  return String(row[column]);
}

function objectIdentity(collection: WorldCollection, object: Row): string | undefined {
  if (collection.identity) return object[collection.identity] as string | undefined;
  const pk = schemaOf(collection.table).primaryKey;
  const key = pk.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  return object[key] as string | undefined;
}

/**
 * Leitura com a chave de servico, sempre filtrada pelo espaco da sessao: a
 * sessao e a permissao do metodo ja foram conferidas, e o RLS de leitura fica
 * livre para restringir o acesso direto do navegador por perfil (fatia 3).
 */
async function loadRows(
  ctx: TenantContext,
  table: string,
  filter?: { column: string; value: string },
): Promise<Row[]> {
  const scopeColumn = table === "organizations" ? "id" : "organization_id";
  const pk = schemaOf(table).primaryKey;
  const admin = createSupabaseAdminClient();
  const rows: Row[] = [];
  // Pagina pela chave ("depois do ultimo id"), com o indice (organization_id, id)
  // da migracao 46: cada pagina custa o mesmo. Pular N linhas (`range`) fazia a
  // pagina 28 das presencas percorrer as 27 mil anteriores (doc 19, secao 13).
  for (let last: unknown = undefined; ; ) {
    let query = admin.from(table).select("*").eq(scopeColumn, ctx.organizationId);
    if (filter) query = query.eq(filter.column, filter.value);
    if (last !== undefined) query = query.gt(pk, last);
    const { data, error } = await query.order(pk, { ascending: true }).limit(PAGE);
    if (error) throw dbError(`world: leitura de ${table}`, error);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) return rows;
    last = (data[data.length - 1] as Row)[pk];
  }
}

async function loadVersion(ctx: TenantContext): Promise<number> {
  const { data, error } = await createSupabaseAdminClient()
    .from("world_versions")
    .select("version")
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (error) throw dbError(`world: leitura da versão`, error);
  return Number(data?.version ?? 0);
}

/**
 * Cache do servidor por (espaco, versao) (doc 19). A versao avanca em toda
 * gravacao nas tabelas do espaco (apply_world_changes e o gatilho da migracao
 * 40, que pega webhook, mensalidades, configuracoes...), entao versao igual =
 * banco igual. Guarda as linhas lidas e os mapas de comparacao, que ninguem
 * altera; cada requisicao monta a sua copia de trabalho a partir deles. Uma
 * leitura com o espaco em cache custa 1 consulta (a versao) em vez de 30 ou mais.
 * Conflito na gravacao descarta o espaco do cache. `WORLD_CACHE=off` desliga.
 */
interface CachedWorld {
  version: number;
  loadedAt: number;
  rows: number;
  unitId: string;
  organizationRow: Row;
  collections: LoadedCollection[];
}

const WORLD_CACHE_TTL_MS = 5 * 60_000;
/** Limite de linhas guardadas somando todos os espacos (sai o menos usado). */
const WORLD_CACHE_MAX_ROWS = 400_000;
const worldCache = new Map<string, CachedWorld>();
const worldCacheCounters = { hits: 0, misses: 0, advances: 0 };

/** Contadores do cache (acertos, cargas do banco, avancos depois de gravar): para medir. */
export function worldCacheStats(): { hits: number; misses: number; advances: number } {
  return { ...worldCacheCounters };
}

function worldCacheEnabled(): boolean {
  return process.env.WORLD_CACHE !== "off";
}

/** Tira o espaco do cache (conflito na gravacao ou leitura que precisa ser do banco). */
export function forgetCachedWorld(organizationId: string): void {
  worldCache.delete(organizationId);
}

function rememberWorld(organizationId: string, entry: CachedWorld): void {
  worldCache.delete(organizationId);
  worldCache.set(organizationId, entry);
  let total = 0;
  for (const cached of worldCache.values()) total += cached.rows;
  // Map guarda a ordem de uso: o primeiro e o menos usado.
  for (const [id, cached] of worldCache) {
    if (total <= WORLD_CACHE_MAX_ROWS || worldCache.size === 1) break;
    worldCache.delete(id);
    total -= cached.rows;
  }
}

async function loadCollections(ctx: TenantContext, version: number): Promise<CachedWorld> {
  const tables = await Promise.all(
    WORLD_COLLECTIONS.map(async (collection) =>
      collection.appendOnly
        ? collection.partialLoad
          ? loadRows(ctx, collection.table, collection.partialLoad)
          : []
        : loadRows(ctx, collection.table),
    ),
  );
  const collections: LoadedCollection[] = [];
  let organizationRow: Row | undefined;
  let unitId = "";
  let rows = 0;
  WORLD_COLLECTIONS.forEach((collection, index) => {
    const unordered = new Map<string, Row>();
    for (const row of tables[index]) unordered.set(identityOf(collection, row), row);
    const raw = byIdentity(unordered);
    rows += tables[index].length;
    if (collection.table === "organizations") organizationRow = tables[index][0];
    if (collection.table === "units") unitId = String(tables[index][0]?.id ?? "");
    collections.push({ collection, raw, normalized: new Map() });
  });
  if (!organizationRow) throw apiError("NOT_FOUND", "Espaço não encontrado.", { httpStatus: 404 });

  // Normaliza depois de conhecer a unidade (linhas sem unidade usam a do espaco).
  for (const loaded of collections) {
    for (const [id, row] of loaded.raw) {
      loaded.normalized.set(
        id,
        toRow(loaded.collection.table, fromRow(loaded.collection.table, row), {
          organizationId: ctx.organizationId,
          unitId,
          loaded: row,
        }),
      );
    }
  }
  return { version, loadedAt: Date.now(), rows, unitId, organizationRow, collections };
}

async function loadWorld(ctx: TenantContext): Promise<LoadedWorld> {
  // A versao e lida antes das tabelas: gravacao que entrar depois dela aborta.
  const version = await loadVersion(ctx);
  let entry = worldCacheEnabled() ? worldCache.get(ctx.organizationId) : undefined;
  const cached = Boolean(entry && entry.version === version && Date.now() - entry.loadedAt <= WORLD_CACHE_TTL_MS);
  if (!entry || !cached) {
    worldCacheCounters.misses += 1;
    entry = await loadCollections(ctx, version);
    if (worldCacheEnabled()) rememberWorld(ctx.organizationId, entry);
  } else {
    worldCacheCounters.hits += 1;
    rememberWorld(ctx.organizationId, entry);
  }

  const store: Record<string, unknown> = {
    services: [],
    appointments: [],
    timeBlocks: [],
    series: [],
    recurringAuthorizations: [],
  };
  for (const loaded of entry.collections) {
    const objects: Row[] = [];
    for (const row of loaded.raw.values()) {
      // Copia funda: o servico muda listas e objetos (jsonb) no lugar, e a
      // comparacao com a linha carregada (e o cache) nao pode ver a mesma mudanca.
      objects.push(structuredClone(fromRow(loaded.collection.table, row)));
    }
    store[loaded.collection.key] = loaded.collection.kind === "single" ? objects[0] : objects;
  }
  store.certificateTemplate = (entry.organizationRow.certificate_template as CertificateTemplate | null) ?? undefined;
  store.graduationCertificateTemplate = (entry.organizationRow.graduation_certificate_template as CertificateTemplate | null) ?? undefined;
  return {
    store: store as unknown as TenantWorld,
    version,
    unitId: entry.unitId,
    collections: entry.collections,
    organizationRow: entry.organizationRow,
    source: cached ? "cache" : "banco",
    rows: entry.rows,
  };
}

/**
 * Lotes do filtro `in`: a URL do PostgREST tem limite de tamanho, e o lote
 * conta caracteres, nao so valores (o id de uma aula, `turma~data~hora`, tem
 * mais de 50: 150 deles estouravam a URL).
 */
const IN_CHUNK = 150;
const IN_CHUNK_CHARS = 3000;

export function inChunks(values: string[]): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let chars = 0;
  for (const value of values) {
    const size = encodeURIComponent(value).length + 3;
    if (current.length > 0 && (current.length >= IN_CHUNK || chars + size > IN_CHUNK_CHARS)) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(value);
    chars += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Carrega so o recorte do metodo (doc 19, fase 2): as colecoes e linhas que ele
 * declarou, direto do banco, sempre filtradas pelo espaco da sessao. O custo
 * segue o tamanho do recorte, nao o historico. Colecao fora do recorte nao
 * existe no espaco montado (`SliceMissError`).
 */
async function loadSlicedWorld(ctx: TenantContext, slice: MethodSlice, args: unknown[]): Promise<LoadedWorld> {
  const version = await loadVersion(ctx);
  const admin = createSupabaseAdminClient();
  const raws = new Map<string, Map<string, Row>>();
  const collectionOf = (key: string) => {
    const collection = WORLD_COLLECTIONS.find((c) => c.key === key);
    if (!collection) throw new Error(`world: coleção desconhecida no recorte: ${key}`);
    return collection;
  };
  const keep = (key: string, rows: Row[]): Row[] => {
    const collection = collectionOf(key);
    const raw = raws.get(key) ?? new Map<string, Row>();
    for (const row of rows) raw.set(identityOf(collection, row), row);
    raws.set(key, raw);
    return rows.map((row) => fromRow(collection.table, row));
  };
  const scopeColumn = (table: string) => (table === "organizations" ? "id" : "organization_id");
  const readBuckets = new Set<number>(SINGLE_KEYS.map((key) => wholeBucket(key)));

  await Promise.all(
    SINGLE_KEYS.map(async (key) => keep(key, await loadRows(ctx, collectionOf(key).table))),
  );
  await slice(args, {
    async all(key) {
      // Colecao que so acrescenta: so a parte que uma regra le (ex.: auditoria dos lancamentos).
      const collection = collectionOf(key);
      readBuckets.add(wholeReadBucket(collection));
      return keep(key, await loadRows(ctx, collection.table, collection.appendOnly ? collection.partialLoad : undefined));
    },
    async where(key, field, values) {
      assertScopeField(key, field);
      const table = collectionOf(key).table;
      const column = columnOf(table, field);
      const wanted = presentValues(values);
      for (const value of wanted) readBuckets.add(bucketOf(key, field, value));
      const rows: Row[] = [];
      for (const chunk of inChunks(wanted)) {
        const { data, error } = await selectAllRows(
          () => admin.from(table).select("*").eq(scopeColumn(table), ctx.organizationId).in(column, chunk),
          { tieBreaker: schemaOf(table).primaryKey },
        );
        if (error) throw dbError(`world: leitura de ${table}`, error);
        rows.push(...(data as Row[]));
      }
      if (!raws.has(key)) raws.set(key, new Map());
      return keep(key, rows);
    },
    none(key) {
      if (!raws.has(key)) raws.set(key, new Map());
    },
  });

  const organizationRow = [...(raws.get("organization")?.values() ?? [])][0];
  if (!organizationRow) throw apiError("NOT_FOUND", "Espaço não encontrado.", { httpStatus: 404 });
  const unitId = String([...(raws.get("unit")?.values() ?? [])][0]?.id ?? "");
  const collections: LoadedCollection[] = [];
  const objects = new Map<string, Row[] | Row | undefined>();
  for (const collection of WORLD_COLLECTIONS) {
    const unordered = raws.get(collection.key);
    if (!unordered) continue;
    const raw = byIdentity(unordered);
    const normalized = new Map<string, Row>();
    const list: Row[] = [];
    for (const [id, row] of raw) {
      list.push(structuredClone(fromRow(collection.table, row)));
      normalized.set(
        id,
        toRow(collection.table, fromRow(collection.table, row), { organizationId: ctx.organizationId, unitId, loaded: row }),
      );
    }
    collections.push({ collection, raw, normalized });
    objects.set(collection.key, collection.kind === "single" ? list[0] : list);
  }
  const store = sliceWorld(objects, {
    certificateTemplate: (organizationRow.certificate_template as CertificateTemplate | null) ?? undefined,
    graduationCertificateTemplate: (organizationRow.graduation_certificate_template as CertificateTemplate | null) ?? undefined,
  });
  const rows = collections.reduce((total, loaded) => total + loaded.raw.size, 0);
  return { store, version, unitId, collections, organizationRow, readBuckets: [...readBuckets], source: "recorte", rows };
}

interface WorldChanges {
  /**
   * `op`: nova ou alterada. O banco grava em grupos seguidos da mesma tabela e
   * do mesmo `op` (migracao 45), na ordem desta lista.
   */
  upserts: { table: string; pk: string; op: "insert" | "update"; row: Row; expected?: string }[];
  deletes: { table: string; pk: string; key: string }[];
}

/** Mudancas e os baldes que elas marcam (linha antes e depois). */
function diffWorld(ctx: TenantContext, world: LoadedWorld): WorldChanges & { buckets: number[] } {
  const changes: WorldChanges = { upserts: [], deletes: [] };
  const buckets = new Set<number>();
  const store = world.store as unknown as Record<string, unknown>;
  for (const loaded of world.collections) {
    const { collection } = loaded;
    const table = collection.table;
    const schema = schemaOf(table);
    const value = store[collection.key];
    const objects = (collection.kind === "single" ? (value ? [value] : []) : ((value as Row[] | undefined) ?? [])) as Row[];
    const seen = new Set<string>();
    // Alteradas antes das novas (cancelar a mensalidade antiga libera o indice
    // unico para a nova), salvo a alterada que aponta para uma linha nova da
    // mesma tabela (pacote renovado -> renovacao): essa vai depois.
    const inserts: WorldChanges["upserts"] = [];
    const updates: WorldChanges["upserts"] = [];
    for (const object of objects) {
      const id = objectIdentity(collection, object);
      const loadedRow = id !== undefined ? loaded.raw.get(id) : undefined;
      const row = toRow(table, object, { organizationId: ctx.organizationId, unitId: world.unitId, loaded: loadedRow });
      if (table === "organizations") {
        row.certificate_template = world.store.certificateTemplate ?? null;
        row.graduation_certificate_template = world.store.graduationCertificateTemplate ?? null;
      }
      if (table === "online_payments" && row.client_id == null) {
        row.client_id = world.store.charges.find((c) => c.id === object.chargeId)?.studentId ?? null;
      }
      if (id !== undefined) seen.add(id);
      if (!loadedRow) {
        inserts.push({ table, pk: schema.primaryKey, op: "insert", row });
        rowBuckets(collection, row, buckets);
        continue;
      }
      const before = loaded.normalized.get(id!)!;
      const certificateChanged =
        table === "organizations" &&
        (canonical(world.organizationRow.certificate_template ?? null) !== canonical(row.certificate_template) ||
          canonical(world.organizationRow.graduation_certificate_template ?? null) !== canonical(row.graduation_certificate_template));
      if (!sameRow(table, before, row) || certificateChanged) {
        rowBuckets(collection, loadedRow, buckets);
        rowBuckets(collection, row, buckets);
        updates.push({
          table,
          pk: schema.primaryKey,
          op: "update",
          row,
          ...(loadedRow.updated_at ? { expected: String(loadedRow.updated_at) } : {}),
        });
      }
    }
    const insertedKeys = new Set(inserts.map((item) => String(item.row[schema.primaryKey])));
    const pointsToNew = (item: WorldChanges["upserts"][number]) =>
      Object.entries(item.row).some(
        ([column, value]) => column !== schema.primaryKey && typeof value === "string" && insertedKeys.has(value),
      );
    changes.upserts.push(
      ...updates.filter((item) => !pointsToNew(item)),
      ...inserts,
      ...updates.filter(pointsToNew),
    );
    if (collection.appendOnly || collection.kind === "single") continue;
    for (const [id, row] of loaded.raw) {
      if (!seen.has(id)) {
        changes.deletes.push({ table, pk: schema.primaryKey, key: String(row[schema.primaryKey]) });
        rowBuckets(collection, row, buckets);
      }
    }
  }
  changes.deletes.reverse();
  return { ...changes, buckets: [...buckets] };
}

const CONFLICT_MESSAGE = "Outra pessoa mudou esses dados agora. Atualize a tela e tente de novo.";

/**
 * Grava com a chave de servico: a sessao e a permissao do metodo ja foram
 * conferidas e cada linha segue presa ao espaco da sessao (doc 15, fatia 3).
 */
interface AppliedChanges {
  /** Versao do espaco depois desta gravacao. */
  version: number;
  /** Linhas gravadas como ficaram no banco (updated_at e padroes do banco). */
  rows: { table: string; row: Row | null }[];
}

async function applyChanges(
  ctx: TenantContext,
  changes: WorldChanges,
  world: LoadedWorld,
  writeBuckets: number[],
): Promise<AppliedChanges> {
  const { data, error } = await createSupabaseAdminClient().rpc("apply_world_changes_returning", {
    p_organization_id: ctx.organizationId,
    p_changes: { upserts: changes.upserts, deletes: changes.deletes },
    p_expected_version: world.version,
    p_read_buckets: world.readBuckets ?? null,
    p_write_buckets: writeBuckets,
  });
  if (!error) return data as AppliedChanges;
  if (error.code === "40001" || error.code === "23505") {
    // A tela so mostra "outra pessoa mudou"; o motivo fica no log do servidor.
    console.warn(`[world] conflito na gravação: ${error.code} ${error.message}`);
    throw apiError("CONFLICT", CONFLICT_MESSAGE, { httpStatus: 409 });
  }
  if (error.code === "42501") {
    throw apiError("FORBIDDEN", "Você não tem permissão para esta ação.", { httpStatus: 403 });
  }
  throw dbError("world: gravação", error);
}

async function actorOf(ctx: TenantContext): Promise<AuditActor> {
  const { data } = await createSupabaseAdminClient().from("users").select("name").eq("id", ctx.userId).maybeSingle();
  return { userId: ctx.userId, name: String(data?.name ?? "Usuário"), profile: ctx.profile };
}

/**
 * Tabelas cuja exclusao apaga ou limpa linhas filhas no banco (ON DELETE
 * CASCADE / SET NULL): o cache nao ve essas mudancas, entao excluir nelas
 * descarta o espaco do cache. Excluir presenca, lista de espera e afins avanca.
 */
const CASCADE_PARENTS = new Set([
  "categories", "charges", "class_groups", "clients", "enrollments", "financial_recurrences",
  "organizations", "plans", "professionals", "roles", "student_packages", "units", "users",
]);

/**
 * Depois de gravar: o espaco em cache passa para a versao nova com as linhas
 * que o banco devolveu, sem reler tudo (a gravacao mais comum e seguida de uma
 * leitura da mesma tela). So quando o cache e o da versao logo antes desta
 * gravacao (nenhuma outra entrou entre o cache e ela); senao descarta e a
 * proxima le do banco. Com recorte, a versao lida pode ser mais antiga que a do
 * cache (gravacoes que nao mexeram no que esta leu): vale a do cache.
 */
function advanceCachedWorld(ctx: TenantContext, changes: WorldChanges, applied: AppliedChanges): void {
  const entry = worldCache.get(ctx.organizationId);
  if (
    !entry ||
    entry.version !== Number(applied.version) - 1 ||
    changes.deletes.some((removed) => CASCADE_PARENTS.has(removed.table))
  ) {
    forgetCachedWorld(ctx.organizationId);
    return;
  }
  const touched = new Set([...changes.deletes.map((d) => d.table), ...applied.rows.map((r) => r.table)]);
  const collections = entry.collections.map((loaded) =>
    touched.has(loaded.collection.table)
      ? { collection: loaded.collection, raw: new Map(loaded.raw), normalized: new Map(loaded.normalized) }
      : loaded,
  );
  const byTable = new Map(collections.map((loaded) => [loaded.collection.table, loaded]));
  for (const removed of changes.deletes) {
    const loaded = byTable.get(removed.table);
    if (!loaded) continue;
    for (const [id, row] of loaded.raw) {
      if (String(row[removed.pk]) !== removed.key) continue;
      loaded.raw.delete(id);
      loaded.normalized.delete(id);
    }
  }
  let organizationRow = entry.organizationRow;
  for (const { table, row } of applied.rows) {
    const loaded = byTable.get(table);
    if (!loaded || !row) {
      forgetCachedWorld(ctx.organizationId);
      return;
    }
    if (!matchesPartialLoad(loaded.collection, row)) continue;
    const id = identityOf(loaded.collection, row);
    loaded.raw.set(id, row);
    loaded.normalized.set(
      id,
      toRow(table, fromRow(table, row), { organizationId: ctx.organizationId, unitId: entry.unitId, loaded: row }),
    );
    if (table === "organizations") organizationRow = row;
  }
  for (const loaded of collections) {
    if (!touched.has(loaded.collection.table)) continue;
    loaded.raw = byIdentity(loaded.raw);
    loaded.normalized = byIdentity(loaded.normalized);
  }
  const rows = collections.reduce((total, loaded) => total + loaded.raw.size, 0);
  // `loadedAt` fica o da carga: a validade curta continua valendo para a corrente de gravacoes.
  rememberWorld(ctx.organizationId, { ...entry, version: Number(applied.version), rows, organizationRow, collections });
  worldCacheCounters.advances += 1;
}

export function isConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "CONFLICT";
}

/**
 * Roda `fn` no espaco do banco e grava o que mudou. Com `slice`, carrega so o
 * recorte declarado do metodo (doc 19, fase 2); se o recorte faltar a alguma
 * regra (`SliceMissError`, um erro nosso), registra e refaz com o espaco inteiro.
 */
export async function runInWorld<T>(
  ctx: TenantContext,
  fn: () => Promise<T>,
  slice?: { fn: MethodSlice; args: unknown[]; name?: string } | { name: string },
): Promise<T> {
  if (slice && "fn" in slice) {
    try {
      return await runLoaded(ctx, fn, () => loadSlicedWorld(ctx, slice.fn, slice.args), slice.name);
    } catch (error) {
      if (!(error instanceof SliceMissError)) throw error;
      logWarn(`[world] recorte incompleto em ${slice.name ?? "método"}; refazendo com o espaço inteiro:`, error.message);
    }
  }
  return runLoaded(ctx, fn, () => loadWorld(ctx), slice?.name);
}

/** Acima disto a acao sai no log mesmo sem `WORLD_TIMING=1` (meta da doc 19). */
const SLOW_ACTION_MS = 300;

/**
 * Log de tempo por acao (doc 19, fase 3): metodo, de onde leu, linhas e as
 * tres etapas. Sai sempre que passa de 300 ms; com `WORLD_TIMING=1`, em toda acao.
 */
function logTiming(label: string | undefined, world: LoadedWorld, times: { load: number; run: number; write: number }, changed: number): void {
  const total = times.load + times.run + times.write;
  if (process.env.WORLD_TIMING !== "1" && total < SLOW_ACTION_MS) return;
  const line =
    `[world] ${label ?? "ação"} ${Math.round(total)} ms (${world.source}, ${world.rows} linhas; ` +
    `ler ${Math.round(times.load)}, regra ${Math.round(times.run)}, gravar ${Math.round(times.write)}; ${changed} mudanças)`;
  if (total >= SLOW_ACTION_MS) console.warn(line);
  else console.info(line);
}

async function runLoaded<T>(
  ctx: TenantContext,
  fn: () => Promise<T>,
  load: () => Promise<LoadedWorld>,
  label?: string,
): Promise<T> {
  const started = performance.now();
  const [world, actor] = await Promise.all([load(), actorOf(ctx)]);
  const loaded = performance.now();
  const effects: WorldEffect[] = [];
  const result = await runScoped({ store: world.store, actor, effects }, fn);
  const ran = performance.now();
  const { buckets, ...changes } = diffWorld(ctx, world);
  if (changes.upserts.length > 0 || changes.deletes.length > 0) {
    try {
      const applied = await applyChanges(ctx, changes, world, buckets);
      if (worldCacheEnabled()) advanceCachedWorld(ctx, changes, applied);
    } catch (error) {
      // Conflito: a proxima tentativa le do banco, nao do cache.
      if (isConflict(error)) forgetCachedWorld(ctx.organizationId);
      throw error;
    }
  }
  const changed = changes.upserts.length + changes.deletes.length;
  logTiming(label, world, { load: loaded - started, run: ran - loaded, write: performance.now() - ran }, changed);
  // Efeitos externos so depois de gravar; falha neles nao desfaz a gravacao.
  for (const effect of effects) {
    await effect().catch((err) => logError("[world] Efeito depois da gravação falhou:", err));
  }
  // Resultado sai como objeto simples (sem referencia ao mundo da requisicao).
  return result === undefined ? result : structuredClone(result);
}
