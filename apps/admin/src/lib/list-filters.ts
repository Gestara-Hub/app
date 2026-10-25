import { SEARCH_MAX, likePattern as likePatternOf, normalizeSearch as normalizeText, pickOption } from "./filter-input";

/**
 * Filtros do endereço no formato "sem filtro = undefined" (Auditoria, Equipe, Espaços). A lógica
 * (limite de 100 caracteres, LIKE escapado, lista de opções) é a de `filter-input.ts`.
 */
export const SEARCH_MAX_LENGTH = SEARCH_MAX;

/** Texto de busca: sem espaços nas pontas, até 100 caracteres; vazio vira "sem filtro". */
export function normalizeSearch(value: string | undefined | null): string | undefined {
  return normalizeText(value) || undefined;
}

/** Valor dentro da lista permitida; qualquer outro vira "sem filtro". */
export const pickOne = pickOption;

/** Escapa `%`, `_` e `\` para o termo valer como texto no LIKE. */
export const escapeLike = (value: string) => value.replace(/[%_\\]/g, "\\$&");

/** Padrão `%termo%` pronto para ILIKE (parâmetro do SQL), ou null sem termo. */
export function likePattern(value: string | undefined | null): string | null {
  return likePatternOf(normalizeText(value));
}
