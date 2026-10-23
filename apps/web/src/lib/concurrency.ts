/**
 * Roda `fn` sobre os itens com no maximo `limit` ao mesmo tempo, na ordem.
 * Para as rotinas (cron) que chamam o Asaas ou percorrem os espacos: em
 * sequencia o tempo cresce com a fila; tudo de uma vez estoura o parceiro.
 * Com `deadline` (instante em ms), para de comecar itens novos depois dele e
 * devolve so o que rodou.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  options: { deadline?: number } = {},
): Promise<{ results: R[]; skipped: number }> {
  const results: R[] = [];
  let next = 0;
  let skipped = 0;
  const worker = async () => {
    while (next < items.length) {
      if (options.deadline !== undefined && Date.now() >= options.deadline) {
        skipped = items.length - next;
        next = items.length;
        return;
      }
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return { results: results.filter((_, i) => i in results), skipped };
}
