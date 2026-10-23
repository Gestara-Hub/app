/**
 * Leitura de todas as linhas, de pagina em pagina. O PostgREST devolve no
 * maximo `max_rows` linhas (1.000) por consulta e corta o resto SEM erro: uma
 * lista que pode passar disso (alunos, matriculas, cobrancas, lancamentos,
 * pagamentos online) passa por aqui. Doc 19, fase 0.
 */

/** Mesmo limite do `max_rows` do Supabase (local e hospedado). */
export const SUPABASE_MAX_ROWS = 1000;

interface PagedQuery<T> {
  order(column: string, options?: { ascending?: boolean }): PagedQuery<T>;
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}

/**
 * `build` monta a consulta do zero a cada pagina (filtros e ordem da tela);
 * a coluna `tieBreaker` (padrao `id`) entra por ultimo na ordem para nenhuma
 * linha pular ou repetir entre paginas.
 */
export async function selectAllRows<T>(
  build: () => PagedQuery<T>,
  options: { tieBreaker?: string; pageSize?: number } = {},
): Promise<{ data: T[]; error: { message: string } | null }> {
  const pageSize = options.pageSize ?? SUPABASE_MAX_ROWS;
  const tieBreaker = options.tieBreaker ?? "id";
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build()
      .order(tieBreaker, { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
}
