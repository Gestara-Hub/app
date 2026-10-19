/**
/**
 * Parametros e estrutura padronizada para paginacao de dados.
 */

export interface PaginationParams {
  /** Pagina atual (1-indexed). Padrao: 1 */
  page?: number;
  /** Quantidade de itens por pagina. Padrao: 20 (max: 100) */
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export function paginateArray<T>(
  items: T[],
  page = 1,
  pageSize = 20,
): PaginatedResult<T> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, Math.min(100, pageSize));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const offset = (safePage - 1) * safePageSize;
  const paginatedItems = items.slice(offset, offset + safePageSize);

  return {
    items: paginatedItems,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    hasMore: safePage < totalPages,
  };
}
