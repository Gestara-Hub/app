/** Topo fixo do app (56 px) e uma folga, para o inicio da lista nao ficar atras dele. */
export const STICKY_TOP_OFFSET = 72;

/**
 * Para onde rolar ao trocar de pagina pela barra de baixo: o inicio da lista,
 * se ele ja saiu da tela por cima. Com o inicio a vista, nada (null).
 */
export function listStartScrollTop(listTopInPage: number, scrollY: number): number | null {
  const top = Math.max(0, Math.round(listTopInPage - STICKY_TOP_OFFSET));
  return scrollY > top ? top : null;
}

/**
 * Leva a tela ao inicio do bloco da lista (o pai da barra de paginacao, com a
 * busca e os filtros), sem animar para quem pediu menos movimento.
 */
export function scrollToListStart(bar: HTMLElement | null): void {
  const list = bar?.parentElement;
  if (!list || typeof window === "undefined") return;
  const top = listStartScrollTop(list.getBoundingClientRect().top + window.scrollY, window.scrollY);
  if (top === null) return;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
}
