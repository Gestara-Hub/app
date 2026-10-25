import "server-only";
import { clampPage, likePattern, normalizeSearch } from "../filter-input";
import { sql } from "./db";
import type { Macro } from "./support";

/** Tamanho da página das respostas prontas (lista curta: 50 por página). */
export const MACRO_PAGE_SIZE = 50;

/** Respostas prontas com busca no título e no texto (já normalizada) e total; paginadas de 50 em 50. */
export async function searchMacros(query: { q?: string; page?: number }): Promise<{ rows: Macro[]; total: number; page: number }> {
  const pattern = likePattern(normalizeSearch(query.q));
  const where = sql()`(${pattern}::text is null or title ilike ${pattern}::text escape '\\' or body ilike ${pattern}::text escape '\\')`;
  const [{ total }] = await sql()<{ total: number }[]>`select count(*)::int as total from platform.support_macros where ${where}`;
  const page = clampPage(query.page ?? 1, total, MACRO_PAGE_SIZE);
  const rows = await sql()<Macro[]>`
    select id, title, body from platform.support_macros where ${where} order by title, id
     limit ${MACRO_PAGE_SIZE} offset ${(page - 1) * MACRO_PAGE_SIZE}`;
  return { rows, total, page };
}
