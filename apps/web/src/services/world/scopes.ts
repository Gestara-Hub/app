import { columnOf, type Row, type WorldCollection } from "./tables";

/**
 * Concorrencia pelo que a acao leu (doc 19, fase 2): em vez de uma versao do
 * espaco inteiro, a gravacao de uma acao com recorte so conflita quando outra
 * gravacao mudou algo DENTRO do que ela leu depois da leitura.
 *
 * O que se le e o que se grava viram "baldes" (numeros): ler as presencas da
 * aula X le o balde (presencas, aula, X); gravar uma presenca da aula X marca
 * esse balde e os dos outros campos de filtro (aluno), mais o da colecao
 * inteira (quem leu todas). No banco, cada balde guarda a versao do espaco da
 * ultima gravacao que o marcou (`world_buckets`); a gravacao com recorte exige
 * que nenhum balde lido tenha versao maior que a lida. Dois professores em
 * turmas diferentes nao dividem balde; duas reservas na mesma aula dividem.
 *
 * Baldes sao um hash (65.536 por espaco): dois escopos diferentes podem cair
 * no mesmo balde, o que so causa um conflito a mais (a acao tenta de novo),
 * nunca um a menos.
 */

const BUCKETS = 65_536;

/**
 * Campos pelos quais um recorte pode filtrar cada colecao (`load.where`). Quem
 * grava marca os baldes desses campos; filtrar por campo fora desta lista falha
 * na hora (o conflito nao seria visto).
 */
export const SCOPE_FIELDS: Record<string, readonly string[]> = {
  clients: ["id"],
  enrollments: ["id", "classGroupId", "studentId"],
  attendances: ["sessionId", "studentId"],
  reservations: ["sessionId", "classGroupId", "studentId"],
  charges: ["id", "studentId", "classGroupId"],
  studentPackages: ["status", "studentId"],
  sessionOverrides: ["sessionId"],
  waitlist: ["id", "classGroupId"],
  messageLogs: ["clientId", "trigger"],
  onlinePayments: ["chargeId"],
  assessments: ["classGroupId"],
  studentMeasurements: ["studentId"],
  // Carga parcial da auditoria (`partialLoad`): so a dos lancamentos.
  auditLog: ["target.type"],
};

export function assertScopeField(key: string, field: string): void {
  if (!SCOPE_FIELDS[key]?.includes(field)) {
    throw new Error(`world: filtro de "${key}" por "${field}" fora de SCOPE_FIELDS (declare em world/scopes.ts).`);
  }
}

/** FNV-1a de 32 bits. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function bucketOf(key: string, field: string, value: string): number {
  return hash(`${key}|${field}|${value}`) % BUCKETS;
}

/** Balde de quem le a colecao inteira. */
export function wholeBucket(key: string): number {
  return bucketOf(key, "*", "");
}

/** Valor de um campo de filtro numa linha do banco (`target.type` = coluna jsonb). */
function fieldValue(table: string, row: Row, field: string): string | undefined {
  const [head, ...rest] = field.split(".");
  let value: unknown = row[columnOf(table, head)];
  for (const part of rest) value = (value as Record<string, unknown> | null | undefined)?.[part];
  return value === null || value === undefined ? undefined : String(value);
}

/** Baldes que uma linha gravada (antes ou depois) marca. */
export function rowBuckets(collection: WorldCollection, row: Row, into: Set<number>): void {
  into.add(wholeBucket(collection.key));
  for (const field of SCOPE_FIELDS[collection.key] ?? []) {
    const value = fieldValue(collection.table, row, field);
    if (value !== undefined) into.add(bucketOf(collection.key, field, value));
  }
}

/** Baldes que a leitura de uma colecao inteira (ou da carga parcial) le. */
export function wholeReadBucket(collection: WorldCollection): number {
  if (collection.appendOnly && collection.partialLoad) {
    const [column, key] = collection.partialLoad.column.split("->>");
    return bucketOf(collection.key, key ? `${column}.${key}` : column, collection.partialLoad.value);
  }
  return wholeBucket(collection.key);
}
