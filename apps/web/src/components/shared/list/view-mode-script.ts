/**
 * Modo de visualizacao (lista vs cards) antes da pintura. Modulo sem
 * "use client": o root layout (server) injeta o script no <head> e o
 * (app)/layout le o prefixo dos cookies como string de verdade.
 */

export const VIEW_MODE_STORAGE_PREFIX = "gestarahub_view_mode_";

/**
 * Copia os modos salvos no localStorage para `data-vm-*` no <html> (o CSS
 * esconde o skeleton do outro modo) e para cookie (SSR da proxima visita).
 * Renderizado so pelo root layout: `<script>` dentro de componente client faz o
 * React 19 avisar ("Encountered a script tag while rendering React component").
 */
export const PRE_PAINT_VIEW_MODE_SCRIPT = `(function(){try{var p=${JSON.stringify(VIEW_MODE_STORAGE_PREFIX)};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf(p)===0){var v=localStorage.getItem(k);if(v==="list"||v==="grid"){var n=k.slice(p.length);document.documentElement.setAttribute("data-vm-"+n,v);document.cookie=k+"="+v+"; path=/; max-age=31536000; SameSite=Lax";}}}}catch(e){}})();`;
