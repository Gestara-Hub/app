import "server-only";
import { LIST_PAGE_SIZE } from "../pagination";
import { clampPage } from "../filter-input";

/**
 * Busca uma página de lista com o total filtrado. `run(page)` devolve as linhas da página com `total`
 * (`count(*) over()`). Página acima do total mostra a última existente (busca de novo, só nesse caso).
 */
export async function fetchPage<R extends { total: number }>(page: number, run: (page: number) => Promise<R[]>): Promise<{ rows: R[]; total: number; page: number }> {
  const first = await run(page);
  if (first.length > 0) return { rows: first, total: first[0].total, page };
  if (page === 1) return { rows: [], total: 0, page: 1 };
  const probe = await run(1);
  const total = probe[0]?.total ?? 0;
  const last = clampPage(page, total, LIST_PAGE_SIZE);
  if (last === 1) return { rows: probe, total, page: 1 };
  return { rows: await run(last), total, page: last };
}
