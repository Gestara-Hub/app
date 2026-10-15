/**
 * Modo de visualizacao (lista vs cards) antes da pintura. Modulo sem
 * "use client": o root layout (server) injeta o script no <head> e o
 * (app)/layout le o prefixo dos cookies como string de verdade.
 */

export type ListViewMode = "list" | "grid";

export const VIEW_MODE_STORAGE_PREFIX = "gestarahub_view_mode_";

/** Sem escolha do usuario, toda listagem abre em Lista. */
export const DEFAULT_VIEW_MODE: ListViewMode = "list";

/**
 * Modo da tela: o salvo (localStorage, a fonte de verdade) ou o padrao. Valor
 * desconhecido ou ausente nunca vira Cards.
 */
export function resolveViewMode(
  saved: string | null | undefined,
  fallback: ListViewMode = DEFAULT_VIEW_MODE,
): ListViewMode {
  return saved === "list" || saved === "grid" ? saved : fallback;
}

/** A dica "Lista ou cartões" aparece a partir do 1º registro da tela. */
export const VIEW_MODE_TIP_MIN_ITEMS = 1;

/** Chave de "dica ja vista" por tela (ex.: `gestarahub_coachmark_view_mode_clients`). */
export function viewModeTipSeenKey(storageKey: string): string {
  return `gestarahub_coachmark_view_mode_${storageKey}`;
}

/** Mostra a dica uma vez por tela, quando ela ja tem registro. */
export function shouldShowViewModeTip(
  itemCount: number,
  seen: boolean,
  threshold: number = VIEW_MODE_TIP_MIN_ITEMS,
): boolean {
  return !seen && itemCount >= Math.max(1, threshold);
}

/**
 * Copia os modos salvos no localStorage para `data-vm-*` no <html> (o CSS
 * esconde o skeleton do outro modo) e para cookie (SSR da proxima visita).
 * Cookie sem o valor no localStorage (dados do navegador limpos, demo
 * reiniciada) e apagado e a tela volta para Lista: senao um "grid" antigo
 * abriria a listagem em Cards sem o usuario ter escolhido.
 * Renderizado so pelo root layout: `<script>` dentro de componente client faz o
 * React 19 avisar ("Encountered a script tag while rendering React component").
 */
export const PRE_PAINT_VIEW_MODE_SCRIPT = `(function(){try{var p=${JSON.stringify(VIEW_MODE_STORAGE_PREFIX)},d=document.documentElement;for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf(p)===0){var v=localStorage.getItem(k);if(v==="list"||v==="grid"){d.setAttribute("data-vm-"+k.slice(p.length),v);document.cookie=k+"="+v+"; path=/; max-age=31536000; SameSite=Lax";}}}var c=document.cookie?document.cookie.split("; "):[];for(var j=0;j<c.length;j++){var n=c[j].split("=")[0];if(n.indexOf(p)===0){var s=localStorage.getItem(n);if(s!=="list"&&s!=="grid"){d.setAttribute("data-vm-"+n.slice(p.length),"list");document.cookie=n+"=; path=/; max-age=0; SameSite=Lax";}}}}catch(e){}})();`;
