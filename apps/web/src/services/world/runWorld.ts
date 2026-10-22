import type { AuditActor, CertificateTemplate } from "@gestarahub/contracts";
import { apiError } from "@gestarahub/core/api-error";
import type { TenantWorld } from "./types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TenantContext } from "../server/tenant";
import type { WorldEffect } from "./effects";
import { runScoped } from "./scope";
import {
  canonical,
  fromRow,
  sameRow,
  schemaOf,
  toRow,
  WORLD_COLLECTIONS,
  type Row,
  type WorldCollection,
} from "./tables";

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
  unitId: string;
  collections: LoadedCollection[];
  organizationRow: Row;
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
  const admin = createSupabaseAdminClient();
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = admin.from(table).select("*").eq(scopeColumn, ctx.organizationId);
    if (filter) query = query.eq(filter.column, filter.value);
    const { data, error } = await query
      .order(schemaOf(table).primaryKey, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`world: leitura de ${table}: ${error.message}`);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
}

async function loadVersion(ctx: TenantContext): Promise<number> {
  const { data, error } = await createSupabaseAdminClient()
    .from("world_versions")
    .select("version")
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (error) throw new Error(`world: leitura da versão: ${error.message}`);
  return Number(data?.version ?? 0);
}

async function loadWorld(ctx: TenantContext): Promise<LoadedWorld> {
  // A versao e lida antes das tabelas: gravacao que entrar depois dela aborta.
  const version = await loadVersion(ctx);
  const tables = await Promise.all(
    WORLD_COLLECTIONS.map(async (collection) =>
      collection.appendOnly
        ? collection.partialLoad
          ? loadRows(ctx, collection.table, collection.partialLoad)
          : []
        : loadRows(ctx, collection.table),
    ),
  );
  const store: Record<string, unknown> = {
    services: [],
    appointments: [],
    timeBlocks: [],
    series: [],
    recurringAuthorizations: [],
  };
  const collections: LoadedCollection[] = [];
  let organizationRow: Row | undefined;
  let unitId = "";
  WORLD_COLLECTIONS.forEach((collection, index) => {
    const rows = tables[index];
    const raw = new Map<string, Row>();
    const normalized = new Map<string, Row>();
    const objects: Row[] = [];
    for (const row of rows) {
      const id = identityOf(collection, row);
      const object = fromRow(collection.table, row);
      raw.set(id, row);
      objects.push(object);
    }
    if (collection.table === "organizations") organizationRow = rows[0];
    if (collection.table === "units") unitId = String(rows[0]?.id ?? "");
    collections.push({ collection, raw, normalized });
    store[collection.key] = collection.kind === "single" ? objects[0] : objects;
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
  store.certificateTemplate = (organizationRow.certificate_template as CertificateTemplate | null) ?? undefined;
  return { store: store as unknown as TenantWorld, version, unitId, collections, organizationRow };
}

interface WorldChanges {
  upserts: { table: string; pk: string; row: Row; expected?: string }[];
  deletes: { table: string; pk: string; key: string }[];
}

function diffWorld(ctx: TenantContext, world: LoadedWorld): WorldChanges {
  const changes: WorldChanges = { upserts: [], deletes: [] };
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
      }
      if (table === "online_payments" && row.client_id == null) {
        row.client_id = world.store.charges.find((c) => c.id === object.chargeId)?.studentId ?? null;
      }
      if (id !== undefined) seen.add(id);
      if (!loadedRow) {
        inserts.push({ table, pk: schema.primaryKey, row });
        continue;
      }
      const before = loaded.normalized.get(id!)!;
      const certificateChanged =
        table === "organizations" &&
        canonical(world.organizationRow.certificate_template ?? null) !== canonical(row.certificate_template);
      if (!sameRow(table, before, row) || certificateChanged) {
        updates.push({
          table,
          pk: schema.primaryKey,
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
      if (!seen.has(id)) changes.deletes.push({ table, pk: schema.primaryKey, key: String(row[schema.primaryKey]) });
    }
  }
  changes.deletes.reverse();
  return changes;
}

const CONFLICT_MESSAGE = "Outra pessoa mudou esses dados agora. Atualize a tela e tente de novo.";

/**
 * Grava com a chave de servico: a sessao e a permissao do metodo ja foram
 * conferidas e cada linha segue presa ao espaco da sessao (doc 15, fatia 3).
 */
async function applyChanges(ctx: TenantContext, changes: WorldChanges, version: number): Promise<void> {
  const { error } = await createSupabaseAdminClient().rpc("apply_world_changes", {
    p_organization_id: ctx.organizationId,
    p_changes: changes,
    p_expected_version: version,
  });
  if (!error) return;
  if (error.code === "40001" || error.code === "23505") {
    // A tela so mostra "outra pessoa mudou"; o motivo fica no log do servidor.
    console.warn(`[world] conflito na gravação: ${error.code} ${error.message}`);
    throw apiError("CONFLICT", CONFLICT_MESSAGE, { httpStatus: 409 });
  }
  if (error.code === "42501") {
    throw apiError("FORBIDDEN", "Você não tem permissão para esta ação.", { httpStatus: 403 });
  }
  throw new Error(`world: gravação: ${error.code} ${error.message}`);
}

async function actorOf(ctx: TenantContext): Promise<AuditActor> {
  const { data } = await createSupabaseAdminClient().from("users").select("name").eq("id", ctx.userId).maybeSingle();
  return { userId: ctx.userId, name: String(data?.name ?? "Usuário"), profile: ctx.profile };
}

export function isConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "CONFLICT";
}

/** Roda `fn` no espaco do banco e grava o que mudou. */
export async function runInWorld<T>(ctx: TenantContext, fn: () => Promise<T>): Promise<T> {
  const [world, actor] = await Promise.all([loadWorld(ctx), actorOf(ctx)]);
  const effects: WorldEffect[] = [];
  const result = await runScoped({ store: world.store, actor, effects }, fn);
  const changes = diffWorld(ctx, world);
  if (changes.upserts.length > 0 || changes.deletes.length > 0) await applyChanges(ctx, changes, world.version);
  // Efeitos externos so depois de gravar; falha neles nao desfaz a gravacao.
  for (const effect of effects) {
    await effect().catch((err) => console.error("[world] Efeito depois da gravação falhou:", err));
  }
  // Resultado sai como objeto simples (sem referencia ao mundo da requisicao).
  return result === undefined ? result : structuredClone(result);
}
