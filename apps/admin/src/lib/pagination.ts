/** Paginação das listas do painel: 25 por página, página no endereço (`?page=`), total vindo do banco. */
export const LIST_PAGE_SIZE = 25;

export const parsePage = (value: string | undefined): number => Math.max(1, Number.parseInt(value ?? "1", 10) || 1);

export interface PageInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** Posição da primeira e da última linha mostrada (1-based); 0 e 0 se não há linhas. */
  from: number;
  to: number;
  hasNext: boolean;
}

export function pageInfo(page: number, total: number, pageSize = LIST_PAGE_SIZE): PageInfo {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return { page, pageSize, total, totalPages, from, to, hasNext: page < totalPages };
}

/** Texto da barra de resumo: "Mostrando 26 a 50 de 120 espaços". */
export function rangeLabel(info: PageInfo, singular: string, plural: string): string {
  if (info.total === 0) return `Nenhum ${singular}`;
  if (info.total <= info.pageSize && info.page === 1) return `${info.total} ${info.total === 1 ? singular : plural}`;
  return `Mostrando ${info.from} a ${info.to} de ${info.total} ${plural}`;
}
