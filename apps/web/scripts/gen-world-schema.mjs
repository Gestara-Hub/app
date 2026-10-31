#!/usr/bin/env node
/**
 * Gera services/world/schema.generated.ts a partir do banco local:
 *
 *   pnpm world:schema
 *
 * Lista colunas, tipo e chave das tabelas que o servidor carrega como "mundo"
 * do espaco (doc 15, fatia 2). Rode depois de cada migracao que mexa nelas; o
 * teste de banco `world.db.test.ts` acusa quando o arquivo ficou velho.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/services/world/schema.generated.ts");
const DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER || "supabase_db_gestarahub";
const TABLES = [
  "organizations", "units", "users", "roles", "categories", "professionals", "clients", "plans",
  "lesson_packages", "student_packages", "charges", "class_groups", "enrollments", "attendances",
  "waitlist", "class_reservations", "class_session_overrides", "assessments", "student_measurements",
  "issued_certificates", "financial_categories",
  "financial_recurrences", "financial_entries", "teacher_pay_rules", "teacher_payouts", "online_payments",
  "whatsapp_connections", "message_templates", "message_logs", "audit_logs",
];

const sql = `
select c.table_name, c.column_name, c.data_type, c.is_nullable, (c.column_default is not null)::text,
  coalesce((select 'pk' from information_schema.key_column_usage k
    join information_schema.table_constraints t on t.constraint_name = k.constraint_name and t.table_schema = k.table_schema
    where t.constraint_type = 'PRIMARY KEY' and k.table_schema = 'public' and k.table_name = c.table_name
      and k.column_name = c.column_name limit 1), '')
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = any(string_to_array('${TABLES.join(",")}', ','))
order by c.table_name, c.ordinal_position`;

const out = execFileSync(
  "docker",
  ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-At", "-F", "|", "-v", "ON_ERROR_STOP=1"],
  { input: sql, encoding: "utf8" },
);

const schema = {};
for (const line of out.trim().split("\n")) {
  const [table, column, type, nullable, hasDefault, pk] = line.split("|");
  schema[table] ??= { primaryKey: "id", columns: {} };
  if (pk === "pk") schema[table].primaryKey = column;
  schema[table].columns[column] = {
    type: type === "timestamp with time zone" ? "timestamptz" : type,
    nullable: nullable === "YES",
    hasDefault: hasDefault === "true",
  };
}
const missing = TABLES.filter((t) => !schema[t]);
if (missing.length) throw new Error(`Tabelas ausentes no banco: ${missing.join(", ")}`);

writeFileSync(
  OUT,
  `// Gerado por \`pnpm world:schema\` (scripts/gen-world-schema.mjs). Nao editar a mao.\n\n` +
    `export interface WorldColumn {\n  type: string;\n  nullable: boolean;\n  hasDefault: boolean;\n}\n\n` +
    `export interface WorldTableSchema {\n  primaryKey: string;\n  columns: Record<string, WorldColumn>;\n}\n\n` +
    `export const WORLD_SCHEMA: Record<string, WorldTableSchema> = ${JSON.stringify(schema, null, 2)};\n`,
);
console.log(`schema.generated.ts: ${Object.keys(schema).length} tabelas.`);
