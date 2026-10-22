import { afterEach, expect } from "vitest";
import { store } from "@/mocks/store";
import { WORLD_SCHEMA } from "@/services/world/schema.generated";
import { canonical, fromRow, toRow, WORLD_COLLECTIONS, type Row } from "@/services/world/tables";

/**
 * Ida e volta pelo banco (doc 15, fatia 5): ao fim de cada teste de regra, todo
 * registro do espaco precisa sobreviver a `toRow` -> `fromRow` sem perder
 * campo. Os testes de regra rodam em memoria (o mesmo codigo que o servidor
 * roda), e esta conferencia garante que o banco guarda tudo o que eles criam.
 */

/** As tarifas da subconta moram na coluna gateway_fees, gravada pela sincronizacao do gateway. */
function withoutGatewayFees(value: unknown): unknown {
  const settings = value as { onlinePayments?: Record<string, unknown> } | undefined;
  if (!settings?.onlinePayments || !("gatewayFees" in settings.onlinePayments)) return value;
  const online = { ...settings.onlinePayments };
  delete online.gatewayFees;
  return { ...settings, onlinePayments: online };
}

function sameValue(table: string, key: string, a: unknown, b: unknown): boolean {
  if (table === "organizations" && key === "settings") {
    a = withoutGatewayFees(a);
    b = withoutGatewayFees(b);
  }
  if (canonical(a) === canonical(b)) return true;
  // Data e hora: o banco devolve em ISO UTC; vale o mesmo instante.
  const column = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  if (WORLD_SCHEMA[table]?.columns[column]?.type === "timestamptz" && typeof a === "string" && typeof b === "string") {
    return Date.parse(a) === Date.parse(b);
  }
  return false;
}

afterEach(() => {
  let world: Record<string, unknown>;
  try {
    world = store as unknown as Record<string, unknown>;
    void world.organization;
  } catch {
    return;
  }
  const problems: string[] = [];
  for (const { key, table, kind } of WORLD_COLLECTIONS) {
    const value = world[key];
    const objects = (kind === "single" ? (value ? [value] : []) : ((value as Row[] | undefined) ?? [])) as Row[];
    for (const object of objects) {
      const back = fromRow(table, toRow(table, object, { organizationId: "org", unitId: "unit" }));
      for (const [field, original] of Object.entries(object)) {
        if (original === undefined) continue;
        if (!sameValue(table, field, original, back[field])) {
          problems.push(`${table}.${field}: ${canonical(original).slice(0, 80)} -> ${canonical(back[field]).slice(0, 80)}`);
        }
      }
    }
  }
  expect([...new Set(problems)], "campos que o banco nao guarda").toEqual([]);
});
