/** Normalização dos filtros que chegam pelo endereço: tudo é validado no servidor antes de ir para a consulta. */
export const SEARCH_MAX = 100;

/** Texto de busca limpo: sem espaços nas pontas, no máximo 100 caracteres. Vazio vira "". */
export function normalizeSearch(value: string | undefined | null): string {
  return (value ?? "").trim().slice(0, SEARCH_MAX).trim();
}

/** Padrão para `ilike ... escape '\'`: `%`, `_` e `\` do texto digitado valem como letras. Vazio vira null (sem filtro). */
export function likePattern(search: string): string | null {
  if (!search) return null;
  return `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** Valor do endereço que está na lista de opções; qualquer outro vira undefined (sem filtro). */
export function pickOption<T extends string>(value: string | undefined | null, allowed: readonly T[]): T | undefined {
  return allowed.find((option) => option === value);
}

/** Página pedida limitada à última existente (página acima do total mostra a última). */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / pageSize)));
}
