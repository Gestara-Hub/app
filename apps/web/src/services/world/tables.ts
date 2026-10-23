import type { TenantWorld } from "./types";
import { WORLD_SCHEMA, type WorldTableSchema } from "./schema.generated";

/**
 * Colecoes do "mundo" do espaco (o `TenantWorld`) e as tabelas do banco (doc 15,
 * fatia 2). O contrato espelha as colunas: campo `fooBar` = coluna `foo_bar`.
 * As excecoes ficam aqui, perto da conversao.
 */

export type CollectionKey = {
  [K in keyof TenantWorld]: TenantWorld[K] extends unknown[] | undefined ? K : never;
}[keyof TenantWorld];

export interface WorldCollection {
  /** Chave no `TenantWorld`. */
  key: keyof TenantWorld;
  table: string;
  /** `single`: um objeto (organizacao, unidade, WhatsApp). */
  kind: "list" | "single";
  /**
   * So acrescenta: nao e carregada (pode ser grande) e o que o servico
   * acrescentar e inserido.
   */
  appendOnly?: boolean;
  /**
   * Parte que uma colecao `appendOnly` carrega mesmo assim, quando uma regra
   * le dela (filtro do PostgREST, ex.: `target->>type`).
   */
  partialLoad?: { column: string; value: string };
  /** Campo que identifica a linha quando difere da chave primaria. */
  identity?: string;
}

/** Ordem de gravacao (chaves estrangeiras): quem e referenciado vem antes. */
export const WORLD_COLLECTIONS: WorldCollection[] = [
  { key: "organization", table: "organizations", kind: "single" },
  { key: "unit", table: "units", kind: "single" },
  { key: "roles", table: "roles", kind: "list" },
  { key: "users", table: "users", kind: "list" },
  { key: "categories", table: "categories", kind: "list" },
  { key: "professionals", table: "professionals", kind: "list" },
  { key: "plans", table: "plans", kind: "list" },
  { key: "clients", table: "clients", kind: "list" },
  { key: "classGroups", table: "class_groups", kind: "list" },
  { key: "lessonPackages", table: "lesson_packages", kind: "list" },
  { key: "enrollments", table: "enrollments", kind: "list" },
  { key: "studentPackages", table: "student_packages", kind: "list" },
  { key: "charges", table: "charges", kind: "list" },
  { key: "attendances", table: "attendances", kind: "list" },
  { key: "waitlist", table: "waitlist", kind: "list" },
  { key: "reservations", table: "class_reservations", kind: "list" },
  { key: "sessionOverrides", table: "class_session_overrides", kind: "list", identity: "sessionId" },
  { key: "assessments", table: "assessments", kind: "list" },
  { key: "financialCategories", table: "financial_categories", kind: "list" },
  { key: "financialRecurrences", table: "financial_recurrences", kind: "list" },
  { key: "teacherPayRules", table: "teacher_pay_rules", kind: "list" },
  { key: "teacherPayouts", table: "teacher_payouts", kind: "list" },
  { key: "financialEntries", table: "financial_entries", kind: "list" },
  { key: "onlinePayments", table: "online_payments", kind: "list" },
  { key: "whatsAppConnection", table: "whatsapp_connections", kind: "single" },
  { key: "messageTemplates", table: "message_templates", kind: "list" },
  { key: "messageLogs", table: "message_logs", kind: "list" },
  // So a dos lancamentos: "ja foi pago uma vez" vem dela (financeAudit.wasEverPaid).
  {
    key: "auditLog",
    table: "audit_logs",
    kind: "list",
    appendOnly: true,
    partialLoad: { column: "target->>type", value: "financial_entry" },
  },
];

/**
 * Colunas que so o banco tem (o contrato nao): ficam com o valor carregado.
 * `organization_id`, `unit_id`, `created_at` e `updated_at` seguem a regra
 * geral em `toRow`.
 */
const DB_ONLY: Record<string, string[]> = {
  clients: ["gateway_customer_id"],
  users: ["auth_user_id"],
  online_payments: ["client_id", "gateway_cancel_pending", "receipt_url"],
  organizations: [
    "gateway_provider",
    "gateway_account_id",
    "gateway_wallet_id",
    "gateway_status",
    "gateway_api_key",
    "gateway_fees",
    "gateway_fees_synced_at",
    "gateway_webhook_url",
    "certificate_template",
  ],
};

export type Row = Record<string, unknown>;

export function schemaOf(table: string): WorldTableSchema {
  const schema = WORLD_SCHEMA[table];
  if (!schema) throw new Error(`Tabela fora do mundo: ${table}`);
  return schema;
}

function camel(column: string): string {
  return column.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** Coluna do banco de um campo do contrato ("classGroupId" -> "class_group_id"). */
export function columnOf(table: string, field: string): string {
  const column = Object.keys(schemaOf(table).columns).find((c) => camel(c) === field);
  if (!column) throw new Error(`world: ${table} não tem o campo ${field}`);
  return column;
}

/** Linha do banco -> objeto do contrato (null some, data e hora em ISO). */
export function fromRow(table: string, row: Row): Row {
  const schema = schemaOf(table);
  const dbOnly = new Set(DB_ONLY[table] ?? []);
  const out: Row = {};
  for (const [column, meta] of Object.entries(schema.columns)) {
    if (dbOnly.has(column)) continue;
    const value = row[column];
    if (value === null || value === undefined) continue;
    out[camel(column)] = meta.type === "timestamptz" ? new Date(String(value)).toISOString() : value;
  }
  if (table === "organizations") {
    // Tarifas da subconta vivem em coluna propria; a tela le em settings.
    const fees = row.gateway_fees;
    if (fees) {
      const settings = (out.settings ?? {}) as Row;
      out.settings = {
        ...settings,
        onlinePayments: { ...((settings.onlinePayments as Row | undefined) ?? {}), gatewayFees: fees },
      };
    }
    // Organizacao no contrato nao tem datas de registro.
    delete out.createdAt;
    delete out.updatedAt;
  }
  if (table === "units") {
    delete out.createdAt;
    delete out.updatedAt;
  }
  if (table === "class_reservations" && out.chargeId) out.cobrancaId = out.chargeId;
  return out;
}

export interface RowContext {
  organizationId: string;
  unitId: string;
  /** Linha carregada (para as colunas so do banco e as datas de registro). */
  loaded?: Row;
}

/** Objeto do contrato -> linha completa da tabela. */
export function toRow(table: string, object: Row, ctx: RowContext): Row {
  const schema = schemaOf(table);
  const dbOnly = new Set(DB_ONLY[table] ?? []);
  const row: Row = {};
  for (const column of Object.keys(schema.columns)) {
    if (dbOnly.has(column)) {
      if (ctx.loaded && column in ctx.loaded) row[column] = ctx.loaded[column];
      continue;
    }
    const value = object[camel(column)];
    if (value !== undefined) {
      row[column] = value;
      continue;
    }
    if (column === schema.primaryKey && ctx.loaded?.[column] != null) row[column] = ctx.loaded[column];
    else if (column === "organization_id") row[column] = ctx.organizationId;
    else if (column === "unit_id") {
      row[column] = ctx.loaded?.unit_id ?? (schema.columns[column].nullable ? null : ctx.unitId);
    } else if (column === "created_at" || column === "updated_at") {
      if (ctx.loaded?.[column] !== undefined) row[column] = ctx.loaded[column];
    } else if (!schema.columns[column].nullable) {
      // Campo apagado em coluna obrigatoria: lista ou objeto vazio (jsonb), e
      // nos outros tipos fica o valor atual (linha nova: o padrao do banco).
      const current = ctx.loaded?.[column];
      if (Array.isArray(current)) row[column] = [];
      else if (current && typeof current === "object") row[column] = {};
    } else if (ctx.loaded || !schema.columns[column].hasDefault) {
      // Linha nova: coluna com padrao no banco fica com o padrao.
      row[column] = null;
    }
  }
  if (table === "organizations") {
    const settings = row.settings as Row | undefined;
    const online = settings?.onlinePayments as Row | undefined;
    if (online && "gatewayFees" in online) {
      const rest = { ...online };
      delete rest.gatewayFees;
      row.settings = { ...settings, onlinePayments: rest };
    }
  }
  if (table === "class_reservations" && row.charge_id == null && object.cobrancaId) {
    row.charge_id = object.cobrancaId;
  }
  // Linha nova sem id: a sobreposicao de aula e identificada pela aula.
  if (table === "class_session_overrides" && row.id == null) row.id = crypto.randomUUID();
  return row;
}

/** JSON com chaves ordenadas (o jsonb do Postgres reordena as chaves). */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Row)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** As linhas tem o mesmo conteudo (fora as datas de registro)? */
export function sameRow(table: string, a: Row, b: Row): boolean {
  return Object.keys(schemaOf(table).columns)
    .filter((c) => c !== "updated_at" && c !== "created_at")
    .every((c) => canonical(a[c]) === canonical(b[c]));
}
